/**
 * Dead-letter dispatcher for failed marketing/transactional sends.
 *
 * `sendTransactionalEmailDetailed` parks any send that exhausted its inline
 * retries in `public.email_dead_letters`. This function is invoked on a
 * schedule (pg_cron) and, for each row that is due:
 *
 *  1. re-sends the exact same template + recipient + idempotency key, so a
 *     delivery that actually went out can never be duplicated,
 *  2. marks the row resolved on success, or reschedules it with escalating
 *     backoff (5m, 15m, 1h, 6h, 24h),
 *  3. abandons the row after `max_retries`, leaving it visible for diagnosis.
 *
 * It also returns queue metrics so the ops console can chart backlog health.
 *
 * Auth: service-role JWT, or the shared `x-cron-secret` header used by the
 * scheduler.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import {
  deadLetterNextRetryAt,
  sendTransactionalEmailDetailed,
} from '../_shared/sendTransactional.ts'
import { createLogger } from '../_shared/opsLog.ts'

const MAX_PER_RUN = 50
const log = createLogger('email-dead-letter-retry')

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function isAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get('EMAIL_CRON_SECRET')
  const provided = req.headers.get('x-cron-secret')
  if (cronSecret && provided && provided === cronSecret) return true

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return claims?.role === 'service_role'
  } catch {
    return false
  }
}

interface QueueMetrics {
  pending: number
  retrying: number
  resolved: number
  abandoned: number
  due_now: number
  oldest_pending_at: string | null
}

async function queueMetrics(
  db: ReturnType<typeof createClient>,
): Promise<QueueMetrics> {
  const counts: Record<string, number> = {}
  for (const status of ['pending', 'retrying', 'resolved', 'abandoned']) {
    const { count } = await db
      .from('email_dead_letters')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
    counts[status] = count ?? 0
  }
  const { count: dueNow } = await db
    .from('email_dead_letters')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'retrying'])
    .lte('next_retry_at', new Date().toISOString())
  const { data: oldest } = await db
    .from('email_dead_letters')
    .select('created_at')
    .in('status', ['pending', 'retrying'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    pending: counts.pending,
    retrying: counts.retrying,
    resolved: counts.resolved,
    abandoned: counts.abandoned,
    due_now: dueNow ?? 0,
    oldest_pending_at: (oldest?.created_at as string | undefined) ?? null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  if (!isAuthorized(req)) return json({ error: 'Forbidden' }, 403)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Server configuration error' }, 500)
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })

  // GET is a metrics-only probe for the ops console.
  if (req.method === 'GET') {
    return json({ ok: true, metrics: await queueMetrics(db) })
  }

  const { data: due, error: dueError } = await db
    .from('email_dead_letters')
    .select('id, template_name, recipient_email, idempotency_key, template_data, retry_count, max_retries')
    .in('status', ['pending', 'retrying'])
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (dueError) {
    log.error({ event: 'due_query_failed', error: dueError.message })
    return json({ error: 'Failed to read dead-letter queue' }, 500)
  }

  let retried = 0
  let resolved = 0
  let abandoned = 0
  let rescheduled = 0

  for (const row of due ?? []) {
    // Claim the row so overlapping cron runs cannot both retry it.
    const { data: claimed } = await db
      .from('email_dead_letters')
      .update({ status: 'retrying', retry_count: (row.retry_count ?? 0) + 1 })
      .eq('id', row.id)
      .lte('retry_count', row.retry_count ?? 0)
      .in('status', ['pending', 'retrying'])
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    retried += 1
    const result = await sendTransactionalEmailDetailed({
      templateName: row.template_name as string,
      recipientEmail: row.recipient_email as string,
      // Same key as the original send: managed delivery dedupes a retry of a
      // message that actually made it out.
      idempotencyKey: row.idempotency_key as string,
      templateData: (row.template_data as Record<string, unknown>) ?? {},
      maxAttempts: 2,
      skipDeadLetter: true,
    })

    if (result.ok || result.reason === 'recipient_suppressed') {
      await db
        .from('email_dead_letters')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          last_error: result.ok ? null : 'Recipient suppressed — no further delivery attempted',
        })
        .eq('id', row.id)
      resolved += 1
      continue
    }

    const nextRetryCount = (row.retry_count ?? 0) + 1
    const exhausted = nextRetryCount >= (row.max_retries ?? 5)
    await db
      .from('email_dead_letters')
      .update({
        status: exhausted ? 'abandoned' : 'pending',
        next_retry_at: deadLetterNextRetryAt(nextRetryCount),
        last_error: (result.error ?? result.reason ?? 'unknown').slice(0, 1000),
      })
      .eq('id', row.id)

    if (exhausted) {
      abandoned += 1
      await log.alert({
        event: 'dead_letter_abandoned',
        severity: 'critical',
        message: `Gave up delivering "${row.template_name}" after ${nextRetryCount} retries.`,
        context: {
          templateName: row.template_name,
          recipientEmail: row.recipient_email,
          reason: result.reason,
        },
      })
    } else {
      rescheduled += 1
    }
  }

  const metrics = await queueMetrics(db)
  log.info({ event: 'dead_letter_run', retried, resolved, abandoned, rescheduled, ...metrics })
  return json({ ok: true, retried, resolved, abandoned, rescheduled, metrics })
})
