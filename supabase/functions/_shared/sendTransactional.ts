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

export async function sendTransactionalEmail(params: {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, unknown>
}): Promise<boolean> {
  const { templateName, idempotencyKey } = params
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    console.error('sendTransactionalEmail: LOVABLE_API_KEY is not configured')
    return false
  }

  // Billing, payment, verification, security and auth mail is owned by the
  // app.gradr.me project — never send it from the marketing surface.
  const appOwned =
    (RETIRED_TO_APP_TEMPLATES as readonly string[]).includes(templateName) ||
    (AUTH_TEMPLATE_NAMES as readonly string[]).includes(templateName)
  if (appOwned) {
    console.error('Refusing app-owned template on the marketing surface', { templateName })
    return false
  }

  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('Template not found in registry', { templateName })
    return false
  }

  const recipient = template.to || params.recipientEmail
  if (!recipient) {
    console.error('No recipient for template', { templateName })
    return false
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
    console.error('Template render failed', { templateName, err: String(err) })
    await logSend({
      messageId,
      templateName,
      recipientEmail: recipient,
      status: 'failed',
      errorMessage: `Render failed: ${String(err)}`.slice(0, 1000),
    })
    return false
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

  try {
    try {
      await send()
    } catch (error) {
      if (!isRateLimited(error)) throw error
      // Managed delivery asks callers to wait before retrying a 429.
      const waitSeconds = error.retryAfterSeconds ?? 60
      console.warn('Email rate limited — waiting before one retry', {
        templateName,
        waitSeconds,
      })
      await new Promise((r) => setTimeout(r, waitSeconds * 1000))
      await send()
    }
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      await logSend({
        messageId,
        templateName,
        recipientEmail: recipient,
        status: 'suppressed',
        errorMessage: 'Recipient is suppressed',
      })
      console.log('Email suppressed', { templateName })
      return false
    }
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Email send failed', { templateName, error: errorMsg })
    await logSend({
      messageId,
      templateName,
      recipientEmail: recipient,
      status: 'failed',
      errorMessage: errorMsg.slice(0, 1000),
    })
    return false
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
    },
  })

  console.log('Transactional email sent', { templateName })
  return true
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
