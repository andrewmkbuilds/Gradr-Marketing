/**
 * Landing-list opt-in for the marketing surface (gradr.me).
 *
 * Double opt-in only:
 *  - `subscribe` stores a `pending` row and mails a single-use confirm link.
 *  - `confirm` validates the token, flips the row to `confirmed` and sends the
 *    welcome email.
 *
 * This is a per-recipient transactional flow triggered by that recipient's own
 * action. It never sends to a list.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import {
  preflightTemplate,
  sendTransactionalEmail,
  sendTransactionalEmailDetailed,
} from '../_shared/sendTransactional.ts'
import { NEWSLETTER_FOLLOWUPS } from '../_shared/transactional-email-templates/registry.ts'
import { unsubscribeUrl } from '../_shared/transactional-email-templates/theme.ts'
import { createLogger } from '../_shared/opsLog.ts'

const CONFIRM_TTL_DAYS = 7
const MAX_SIGNUPS_PER_IP_PER_HOUR = 5
const CONFIRM_TEMPLATE = 'newsletter-confirm'
const log = createLogger('newsletter-subscribe')


const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function sha256(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Server configuration error' }, 500)
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const action = String(payload.action ?? 'subscribe')

  /* ---------------------------------------------------------------- */
  /* subscribe                                                         */
  /* ---------------------------------------------------------------- */
  if (action === 'subscribe') {
    const email = String(payload.email ?? '').trim().toLowerCase()
    const firstName = String(payload.firstName ?? '').trim().slice(0, 80) || null
    const topic = String(payload.topic ?? '').trim().slice(0, 80) || null
    const source = String(payload.source ?? 'landing').trim().slice(0, 40) || 'landing'

    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return json({ error: 'Enter a valid email address.' }, 400)
    }

    // Preflight: the confirm template must be registered and allowed for this
    // function's configuration before we take a signup we cannot confirm.
    const preflight = preflightTemplate(CONFIRM_TEMPLATE)
    if (!preflight.allowed) {
      await log.alert({
        event: 'confirm_template_preflight_failed',
        severity: 'critical',
        message: preflight.reason ?? 'Confirmation template is not sendable',
        context: { templateName: CONFIRM_TEMPLATE, code: preflight.code },
      })
      return json(
        { error: 'Newsletter signup is temporarily unavailable. Please try again later.' },
        503,
      )
    }



    const ipHash = await sha256(`newsletter:${clientIp(req)}`)
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const { count } = await db
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', hourAgo)
    if ((count ?? 0) >= MAX_SIGNUPS_PER_IP_PER_HOUR) {
      return json({ error: 'Too many signups from this network. Try again in an hour.' }, 429)
    }

    // Never reveal whether the address already exists — the response is the
    // same either way, and a confirmed subscriber is not re-mailed.
    const { data: existing } = await db
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', email)
      .maybeSingle()

    if (existing?.status === 'confirmed') {
      return json({ ok: true, status: 'pending' })
    }

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const tokenHash = await sha256(token)
    // Opaque, stable per subscriber: this is what the unsubscribe link in
    // every marketing email carries.
    const unsubscribeToken =
      crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const now = new Date().toISOString()

    const row = {
      email,
      first_name: firstName,
      topic,
      source,
      status: 'pending',
      confirm_token_hash: tokenHash,
      confirm_sent_at: now,
      unsubscribe_token: unsubscribeToken,
      unsubscribed_at: null,
      ip_hash: ipHash,
    }

    const { error: writeError } = existing
      ? await db.from('newsletter_subscribers').update(row).eq('id', existing.id)
      : await db.from('newsletter_subscribers').insert(row)
    if (writeError) {
      await log.alert({
        event: 'subscriber_write_failed',
        message: `Could not persist newsletter subscription: ${writeError.message}`,
        context: { code: writeError.code, email },
      })
      return json({ error: 'We could not save your subscription. Please try again.' }, 500)
    }

    // The subscription itself is now recorded; delivery state is tracked
    // separately so a failed confirmation email never loses the signup.
    const result = await sendTransactionalEmailDetailed({
      templateName: CONFIRM_TEMPLATE,
      recipientEmail: email,
      idempotencyKey: `newsletter-confirm:${tokenHash.slice(0, 24)}`,
      templateData: { firstName: firstName ?? undefined, confirmToken: token, topic: topic ?? undefined },
      maxAttempts: 3,
    })

    const deliveryStatus = result.ok
      ? 'sent'
      : result.reason === 'recipient_suppressed'
        ? 'suppressed'
        : 'failed'

    const { error: stateError } = await db
      .from('newsletter_subscribers')
      .update({
        confirm_delivery_status: deliveryStatus,
        confirm_delivery_error: result.ok ? null : (result.error ?? result.reason ?? 'unknown').slice(0, 500),
        confirm_attempts: result.attempts,
        confirm_last_attempt_at: new Date().toISOString(),
      })
      .eq('email', email)
    if (stateError) {
      log.warn({ event: 'delivery_state_write_failed', error: stateError.message, email })
    }

    if (!result.ok) {
      await log.alert({
        event: 'confirmation_email_failed',
        severity: result.transient ? 'error' : 'critical',
        message: `Newsletter confirmation email failed (${result.reason ?? 'unknown'}) after ${result.attempts} attempt(s).`,
        context: {
          templateName: CONFIRM_TEMPLATE,
          reason: result.reason,
          transient: result.transient ?? false,
          attempts: result.attempts,
          email,
        },
      })
      // The signup is stored — report a degraded success so the reader knows
      // their address is on file and the email is delayed, not lost.
      return json({
        ok: true,
        status: 'pending',
        emailDelivered: false,
        deliveryStatus,
        message:
          'You are on the list, but we could not deliver the confirmation email just yet. We will retry shortly — check back or contact support if it does not arrive.',
      })
    }

    log.info({ event: 'subscribe_ok', email, attempts: result.attempts, source })
    return json({ ok: true, status: 'pending', emailDelivered: true, deliveryStatus })
  }


  /* ---------------------------------------------------------------- */
  /* confirm                                                           */
  /* ---------------------------------------------------------------- */
  if (action === 'confirm') {
    const token = String(payload.token ?? '').trim()
    if (!token || token.length > 128) return json({ error: 'This confirmation link is invalid.' }, 400)

    const tokenHash = await sha256(token)
    const { data: row } = await db
      .from('newsletter_subscribers')
      .select('id, email, first_name, topic, status, confirm_sent_at, unsubscribe_token')
      .eq('confirm_token_hash', tokenHash)
      .maybeSingle()

    if (!row) return json({ error: 'This confirmation link is invalid or has already been used.' }, 404)
    if (row.status === 'confirmed') return json({ ok: true, status: 'confirmed', alreadyConfirmed: true })

    const sentAt = row.confirm_sent_at ? new Date(row.confirm_sent_at).getTime() : 0
    if (!sentAt || Date.now() - sentAt > CONFIRM_TTL_DAYS * 86_400_000) {
      return json({ error: 'This confirmation link has expired. Please subscribe again.' }, 410)
    }

    const { error: updateError } = await db
      .from('newsletter_subscribers')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirm_token_hash: null,
      })
      .eq('id', row.id)
    if (updateError) {
      console.error('newsletter-subscribe: confirm failed', updateError)
      return json({ error: 'We could not confirm your subscription. Please try again.' }, 500)
    }

    // Schedule the finite opt-in welcome sequence (day 1, day 3). Rows are only
    // ever created here, i.e. after this recipient completed double opt-in, and
    // the dispatcher re-checks opt-in state before each send.
    const scheduled = NEWSLETTER_FOLLOWUPS.map((step) => ({
      subscriber_id: row.id,
      template_name: step.templateName,
      scheduled_at: new Date(Date.now() + step.delayHours * 3_600_000).toISOString(),
      status: 'scheduled',
    }))
    const { error: scheduleError } = await db
      .from('newsletter_followups')
      .upsert(scheduled, { onConflict: 'subscriber_id,template_name', ignoreDuplicates: true })
    if (scheduleError) {
      // A missing follow-up must not fail the confirmation itself.
      console.error('newsletter-subscribe: follow-up scheduling failed', scheduleError)
    }

    await sendTransactionalEmail({
      templateName: 'newsletter-welcome',
      recipientEmail: row.email as string,
      idempotencyKey: `newsletter-welcome:${row.id}`,
      templateData: {
        firstName: (row.first_name as string | null) ?? undefined,
        topic: (row.topic as string | null) ?? undefined,
        unsubscribeUrl: unsubscribeUrl(row.unsubscribe_token as string | null),
      },
    })

    return json({ ok: true, status: 'confirmed' })
  }

  return json({ error: 'Unknown action' }, 400)
})
