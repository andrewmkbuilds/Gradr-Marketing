/**
 * One-click unsubscribe for Gradr marketing emails.
 *
 * The link in every newsletter email carries an opaque per-subscriber token.
 *  - POST { token }                  → validates the token, returns the address
 *  - POST { token, confirm: true }   → marks the subscriber unsubscribed
 *
 * The confirmation step exists so that link scanners and inbox prefetchers
 * cannot unsubscribe someone by merely fetching the URL.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/** Never expose the full address back to an unauthenticated caller. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '•••'
  const head = local.slice(0, 1)
  return `${head}${'•'.repeat(Math.max(local.length - 1, 1))}@${domain}`
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
    return json({ valid: false, reason: 'invalid_token' }, 400)
  }

  const token = String(payload.token ?? '').trim()
  const confirm = payload.confirm === true
  if (!token || token.length > 128) return json({ valid: false, reason: 'invalid_token' }, 400)

  const { data: row, error } = await db
    .from('newsletter_subscribers')
    .select('id, email, status')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (error) {
    console.error('handle-email-unsubscribe: lookup failed', error)
    return json({ error: 'Lookup failed' }, 500)
  }
  if (!row) return json({ valid: false, reason: 'invalid_token' }, 404)
  if (row.status === 'unsubscribed') {
    return json({ valid: false, reason: 'already_unsubscribed', email: maskEmail(row.email as string) })
  }

  if (!confirm) {
    return json({ valid: true, email: maskEmail(row.email as string) })
  }

  const { error: updateError } = await db
    .from('newsletter_subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
      confirm_token_hash: null,
    })
    .eq('id', row.id)
  if (updateError) {
    console.error('handle-email-unsubscribe: update failed', updateError)
    return json({ error: 'We could not update your preferences.' }, 500)
  }

  // Stop any scheduled opt-in follow-ups for this address.
  await db
    .from('newsletter_followups')
    .update({ status: 'canceled' })
    .eq('subscriber_id', row.id)
    .eq('status', 'scheduled')

  return json({ valid: true, success: true, email: maskEmail(row.email as string) })
})
