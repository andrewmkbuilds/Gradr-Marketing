/**
 * Dispatcher for the finite, opt-in welcome sequence on the landing list.
 *
 * `newsletter-subscribe` schedules one row per step in `newsletter_followups`
 * when a subscriber completes double opt-in. This function is invoked on a
 * schedule (pg_cron) and, for each row that is due:
 *
 *  1. re-reads the subscriber and skips anything not still `confirmed`,
 *  2. lets `send-transactional-email` re-check the suppression list,
 *  3. sends ONE email to ONE recipient with an idempotency key derived from the
 *     row id, so a retry can never double-send.
 *
 * It never reads a list of addresses to broadcast to, and it never schedules
 * anything new — the sequence ends after the last configured step.
 *
 * Auth: service-role only (verify_jwt = true plus an explicit role check).
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTransactionalEmail } from '../_shared/sendTransactional.ts'
import { NEWSLETTER_FOLLOWUPS } from '../_shared/transactional-email-templates/registry.ts'
import { unsubscribeUrl } from '../_shared/transactional-email-templates/theme.ts'

const MAX_PER_RUN = 100
const MAX_ATTEMPTS = 3

const VALID_STEPS = new Set(NEWSLETTER_FOLLOWUPS.map((s) => s.templateName))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function isServiceRole(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return claims?.role === 'service_role'
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!isServiceRole(req)) return json({ error: 'Forbidden' }, 403)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Server configuration error' }, 500)
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: due, error: dueError } = await db
    .from('newsletter_followups')
    .select('id, subscriber_id, template_name, attempts')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (dueError) {
    console.error('newsletter-followups: due query failed', dueError)
    return json({ error: 'Failed to read schedule' }, 500)
  }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const row of due ?? []) {
    if (!VALID_STEPS.has(row.template_name)) {
      await db
        .from('newsletter_followups')
        .update({ status: 'canceled', last_error: 'Unknown follow-up step' })
        .eq('id', row.id)
      skipped += 1
      continue
    }

    const { data: subscriber } = await db
      .from('newsletter_subscribers')
      .select('id, email, first_name, topic, status, unsubscribe_token')
      .eq('id', row.subscriber_id)
      .maybeSingle()

    // Opt-in is re-verified at send time: anyone who unsubscribed or was reset
    // to pending between scheduling and now is dropped from the sequence.
    if (!subscriber || subscriber.status !== 'confirmed') {
      await db
        .from('newsletter_followups')
        .update({
          status: 'skipped',
          last_error: subscriber ? `Subscriber status is ${subscriber.status}` : 'Subscriber removed',
        })
        .eq('id', row.id)
      skipped += 1
      continue
    }

    // Claim the row before sending so two overlapping cron runs cannot both
    // dispatch it; the idempotency key is a second line of defence.
    const { data: claimed } = await db
      .from('newsletter_followups')
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq('id', row.id)
      .eq('status', 'scheduled')
      .eq('attempts', row.attempts ?? 0)
      .select('id')
      .maybeSingle()
    if (!claimed) {
      skipped += 1
      continue
    }

    const ok = await sendTransactionalEmail({
      templateName: row.template_name,
      recipientEmail: subscriber.email as string,
      idempotencyKey: `${row.template_name}:${row.id}`,
      templateData: {
        firstName: (subscriber.first_name as string | null) ?? undefined,
        topic: (subscriber.topic as string | null) ?? undefined,
        unsubscribeUrl: unsubscribeUrl(subscriber.unsubscribe_token as string | null),
      },
    })

    if (ok) {
      await db
        .from('newsletter_followups')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id)
      sent += 1
    } else {
      const attempts = (row.attempts ?? 0) + 1
      await db
        .from('newsletter_followups')
        .update({
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'scheduled',
          last_error: 'Send failed',
        })
        .eq('id', row.id)
      failed += 1
    }
  }

  console.log('newsletter-followups run complete', { due: due?.length ?? 0, sent, skipped, failed })
  return json({ ok: true, due: due?.length ?? 0, sent, skipped, failed })
})
