/**
 * Admin decision endpoint for eligibility verification requests.
 *
 * The decision itself still runs through `admin_review_verification_request`
 * (RLS + admin role + rate limit + audit trail live in the database). This
 * function exists so the *notification* side-effects happen server-side:
 *  - a branded status email to the applicant
 *  - an `email_sent` entry appended to the request's audit trail
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const TEMPLATE: Record<string, string> = {
  approved: 'verification-approved',
  rejected: 'verification-rejected',
  needs_more_information: 'verification-needs-info',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !serviceKey || !anonKey) return json({ error: 'Server configuration error' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData } = await userClient.auth.getUser()
  const actor = userData?.user
  if (!actor || actor.is_anonymous) return json({ error: 'Authentication required' }, 401)

  let payload: {
    requestId?: string
    decision?: string
    notes?: string
    discountPercentage?: number
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const requestId = (payload.requestId ?? '').trim()
  const decision = (payload.decision ?? '').trim()
  const notes = (payload.notes ?? '').trim().slice(0, 2000)

  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: 'Invalid request id' }, 400)
  if (!TEMPLATE[decision]) return json({ error: 'Invalid decision' }, 400)

  const admin = createClient(url, serviceKey)

  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: actor.id, _role: 'admin' })
  if (!isAdmin) return json({ error: 'Admin role required' }, 403)

  // Decision + audit trail. The RPC is backend-only (service_role EXECUTE); the
  // verified admin id is passed explicitly so the DB still records the actor.
  const { error: rpcError } = await admin.rpc('admin_review_verification_request', {
    _request_id: requestId,
    _decision: decision,
    _notes: notes || undefined,
    _discount_percentage:
      typeof payload.discountPercentage === 'number' ? payload.discountPercentage : undefined,
    _actor_id: actor.id,
  })
  if (rpcError) {
    console.error('verification-review: decision failed', rpcError)
    return json({ error: rpcError.message }, 400)
  }

  // Notify the applicant.
  const { data: request } = await admin
    .from('verification_requests')
    .select('user_id, category, full_name, email, personal_email, discount_percentage, reviewed_at')
    .eq('id', requestId)
    .maybeSingle()

  let emailed = false
  if (request) {
    const { data: category } = await admin
      .from('eligibility_categories')
      .select('label')
      .eq('key', request.category)
      .maybeSingle()

    const recipient = request.personal_email || request.email
    const firstName = (request.full_name ?? '').split(' ')[0] || undefined
    const reviewedAt = new Date(request.reviewed_at ?? Date.now()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Verification decision emails are owned by app.gradr.me. The decision and
    // its audit trail still happen here; the notification does not.
    console.info('verification-review: decision email delegated to app.gradr.me', {
      requestId,
      decision,
    })
    emailed = false

    await admin.rpc('log_verification_event', {
      _request_id: requestId,
      _event: emailed ? 'email_sent' : 'email_delegated',
      _actor_role: 'system',
      _to_status: decision,
      _notes: emailed
        ? `Status email sent to ${recipient}.`
        : `Status email for ${recipient} is sent by app.gradr.me.`,
      _metadata: { template: TEMPLATE[decision], decision },
    })
  }

  return json({ ok: true, emailed })
})
