/**
 * Server-side helper for dispatching transactional email from other edge
 * functions (webhooks, cron, admin actions).
 *
 * Email is delivered synchronously through Lovable's managed email API.
 * Delivery, retries, rate limiting, suppression and unsubscribe handling all
 * run on Lovable's side — this module only renders the registered template,
 * applies the marketing surface's own open/click instrumentation, and records
 * the outcome in `email_send_log`.
 *
 * Failures are logged and swallowed: email is never allowed to break the
 * business flow that triggered it (a Paddle webhook must still return 200).
 */
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  AUTH_TEMPLATE_NAMES,
  RETIRED_TO_APP_TEMPLATES,
  TEMPLATES,
  TRACKED_TEMPLATES,
} from './transactional-email-templates/registry.ts'
import { withEngagementTracking } from './emailTracking.ts'

// Display name shown in the inbox "From" column.
const FROM_NAME = 'Gradr'
// Verified sender subdomain FQDN — must match the delegated subdomain.
const SENDER_DOMAIN = 'notify.marketing.gradr.me'
// Domain shown in the From: header (cosmetic only).
const FROM_DOMAIN = 'marketing.gradr.me'

type LogStatus = 'sent' | 'suppressed' | 'failed'

function db() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

async function logSend(params: {
  messageId: string
  templateName: string
  recipientEmail: string
  status: LogStatus
  errorMessage?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const client = db()
  if (!client) return
  const { error } = await client.from('email_send_log').insert({
    message_id: params.messageId,
    template_name: params.templateName,
    recipient_email: params.recipientEmail,
    status: params.status,
    error_message: params.errorMessage ?? null,
    metadata: params.metadata ?? null,
  })
  if (error) {
    console.error('email_send_log write failed', {
      status: params.status,
      code: error.code,
      message: error.message,
    })
  }
}

function isRateLimited(error: unknown): error is EmailAPIError {
  return error instanceof EmailAPIError && error.status === 429
}

/**
 * Transient = worth retrying. Managed delivery surfaces upstream hiccups as
 * 5xx (502/503/504) or 408; network hiccups arrive as TypeError.
 */
function isTransient(error: unknown): boolean {
  if (error instanceof EmailAPIError) {
    const status = error.status ?? 0
    return status === 408 || status === 425 || (status >= 500 && status <= 599)
  }
  return error instanceof TypeError || /network|fetch failed|timed? ?out/i.test(String(error))
}

export interface TemplatePreflight {
  allowed: boolean
  /** Machine-readable reason when `allowed` is false. */
  code?: 'app_owned_template' | 'template_not_registered' | 'missing_api_key'
  reason?: string
}

/**
 * Verifies a template can actually be sent by this function's configuration
 * before any state is written or any network call is made: the template must
 * be registered here, must not be owned by app.gradr.me, and the managed email
 * API key must be present.
 */
export function preflightTemplate(templateName: string): TemplatePreflight {
  if (
    (RETIRED_TO_APP_TEMPLATES as readonly string[]).includes(templateName) ||
    (AUTH_TEMPLATE_NAMES as readonly string[]).includes(templateName)
  ) {
    return {
      allowed: false,
      code: 'app_owned_template',
      reason: `Template "${templateName}" is owned by the app surface and cannot be sent from marketing.`,
    }
  }
  if (!TEMPLATES[templateName]) {
    return {
      allowed: false,
      code: 'template_not_registered',
      reason: `Template "${templateName}" is not registered in the marketing template registry.`,
    }
  }
  if (!Deno.env.get('LOVABLE_API_KEY')) {
    return {
      allowed: false,
      code: 'missing_api_key',
      reason: 'LOVABLE_API_KEY is not configured for this function.',
    }
  }
  return { allowed: true }
}

export interface SendOutcome {
  ok: boolean
  reason?:
    | 'app_owned_template'
    | 'template_not_registered'
    | 'missing_api_key'
    | 'no_recipient'
    | 'render_failed'
    | 'recipient_suppressed'
    | 'send_failed'
  error?: string
  attempts: number
  messageId?: string
  /** True when the failure looked retryable (5xx/timeout/network). */
  transient?: boolean
}

const DEFAULT_MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 600

/** Full-detail send. `sendTransactionalEmail` wraps this for boolean callers. */
export async function sendTransactionalEmailDetailed(params: {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, unknown>
  /** Total attempts for transient failures (default 3, retried with backoff). */
  maxAttempts?: number
}): Promise<SendOutcome> {
  const { templateName, idempotencyKey } = params
  const log = createLogger('send-transactional-email')
  const maxAttempts = Math.max(1, params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)

  const preflight = preflightTemplate(templateName)
  if (!preflight.allowed) {
    await log.alert({
      event: 'template_rejected',
      severity: preflight.code === 'missing_api_key' ? 'critical' : 'error',
      message: preflight.reason ?? 'Template rejected by preflight',
      context: { templateName, code: preflight.code, recipientEmail: params.recipientEmail },
    })
    return { ok: false, reason: preflight.code, error: preflight.reason, attempts: 0 }
  }

  const template = TEMPLATES[templateName]
  const apiKey = Deno.env.get('LOVABLE_API_KEY') as string

  const recipient = template.to || params.recipientEmail
  if (!recipient) {
    log.error({ event: 'no_recipient', templateName })
    return { ok: false, reason: 'no_recipient', error: 'No recipient for template', attempts: 0 }
  }

  const messageId = crypto.randomUUID()
  const templateData = params.templateData ?? {}

  let html: string
  let text: string
  try {
    const element = React.createElement(template.component, templateData)
    html = await renderAsync(element)
    text = await renderAsync(element, { plainText: true })
  } catch (err) {
    await log.alert({
      event: 'template_render_failed',
      message: `Render failed for "${templateName}": ${String(err)}`,
      context: { templateName, recipientEmail: recipient, messageId },
    })
    await logSend({
      messageId,
      templateName,
      recipientEmail: recipient,
      status: 'failed',
      errorMessage: `Render failed: ${String(err)}`.slice(0, 1000),
    })
    return { ok: false, reason: 'render_failed', error: String(err), attempts: 0, messageId }
  }

  // The email API rejects a send with `missing_parameter: text`, so never let
  // an empty plain-text part through.
  if (!text || !text.trim()) {
    text = html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  if (!text) text = 'View this message in an HTML-capable email client.'

  // Open/click instrumentation for opt-in landing mail. Applied after render so
  // templates stay free of tracking concerns; the unsubscribe footer is
  // appended downstream by the email API and is never rewritten here.
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const trackedHtml = (TRACKED_TEMPLATES as readonly string[]).includes(templateName)
    ? withEngagementTracking(html, messageId, supabaseUrl)
    : html

  const subject =
    typeof template.subject === 'function' ? template.subject(templateData) : template.subject

  const send = () =>
    sendLovableEmail(
      {
        to: recipient,
        from: `${FROM_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html: trackedHtml,
        text,
        purpose: 'transactional',
        label: templateName,
        idempotency_key: idempotencyKey,
        message_id: messageId,
      },
      // sendUrl is optional — when LOVABLE_SEND_URL is not set the library
      // falls back to the default Lovable API endpoint.
      { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') },
    )

  let attempts = 0
  let lastError: unknown = null

  while (attempts < maxAttempts) {
    attempts++
    try {
      await send()
      lastError = null
      break
    } catch (error) {
      lastError = error
      if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') break

      const retryable = isRateLimited(error) || isTransient(error)
      if (!retryable || attempts >= maxAttempts) break

      // 429 carries an explicit wait; transient errors use exponential backoff
      // with jitter (~0.6s, 1.2s, 2.4s …).
      const waitMs = isRateLimited(error)
        ? ((error as EmailAPIError).retryAfterSeconds ?? 60) * 1000
        : BASE_BACKOFF_MS * 2 ** (attempts - 1) + Math.floor(Math.random() * 250)
      log.warn({
        event: 'send_retry_scheduled',
        templateName,
        attempt: attempts,
        maxAttempts,
        waitMs,
        status: error instanceof EmailAPIError ? error.status : undefined,
        error: String(error instanceof Error ? error.message : error),
      })
      await new Promise((r) => setTimeout(r, waitMs))
    }
  }

  if (lastError) {
    const error = lastError
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      await logSend({
        messageId,
        templateName,
        recipientEmail: recipient,
        status: 'suppressed',
        errorMessage: 'Recipient is suppressed',
      })
      log.info({ event: 'recipient_suppressed', templateName, recipientEmail: recipient })
      return { ok: false, reason: 'recipient_suppressed', attempts, messageId }
    }
    const errorMsg = error instanceof Error ? error.message : String(error)
    const transient = isTransient(error) || isRateLimited(error)
    await log.alert({
      event: 'email_send_failed',
      severity: transient ? 'error' : 'critical',
      message: `Send failed for "${templateName}" after ${attempts} attempt(s): ${errorMsg}`,
      context: {
        templateName,
        recipientEmail: recipient,
        messageId,
        attempts,
        transient,
        status: error instanceof EmailAPIError ? error.status : undefined,
        code: error instanceof EmailAPIError ? error.code : undefined,
      },
    })
    await logSend({
      messageId,
      templateName,
      recipientEmail: recipient,
      status: 'failed',
      errorMessage: errorMsg.slice(0, 1000),
      metadata: { attempts, transient },
    })
    return { ok: false, reason: 'send_failed', error: errorMsg, attempts, messageId, transient }
  }


  await logSend({
    messageId,
    templateName,
    recipientEmail: recipient,
    status: 'sent',
    metadata: {
      template_version: template.version ?? 'unversioned',
      category: template.category ?? 'lifecycle',
      idempotency_key: idempotencyKey,
      attempts,
    },
  })

  log.info({ event: 'email_sent', templateName, recipientEmail: recipient, attempts, messageId })
  return { ok: true, attempts, messageId }
}

/** Boolean-returning wrapper kept for existing callers. */
export async function sendTransactionalEmail(params: {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, unknown>
  maxAttempts?: number
}): Promise<boolean> {
  const result = await sendTransactionalEmailDetailed(params)
  return result.ok
}


/** Money formatting shared by the billing emails (Paddle sends minor units). */
export function formatMoney(minorUnits: unknown, currency = "USD"): string {
  const n = Number(minorUnits);
  if (!Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n / 100);
  } catch {
    return `${(n / 100).toFixed(2)} ${currency}`;
  }
}

/** Human date for email bodies, e.g. "12 March 2026". */
export function formatDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}
