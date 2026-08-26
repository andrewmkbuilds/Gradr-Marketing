/**
 * Student verification by academic email ownership.
 *
 * There is no third-party verification vendor and no document review in this
 * flow: the user proves they can receive mail at a recognised academic domain
 * and the student discount is granted on success.
 *
 * Actions:
 *  - status:  is this address on a recognised academic domain?
 *  - start:   generate + email a one-time 6-digit code
 *  - confirm: check the code and grant the student eligibility
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const CODE_TTL_MINUTES = 15
const MAX_ATTEMPTS = 5
const RESEND_COOLDOWN_SECONDS = 60
const MAX_SENDS_PER_HOUR = 5

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return n.toString().padStart(6, '0')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !serviceKey || !anonKey) return json({ error: 'Server configuration error' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData } = await userClient.auth.getUser()
  const user = userData?.user
  if (!user || user.is_anonymous) return json({ error: 'Sign in to verify your student status' }, 401)

  const admin = createClient(url, serviceKey)

  let payload: {
    action?: string
    email?: string
    code?: string
    purpose?: string
    category?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const action = payload.action ?? 'status'
  const email = (payload.email ?? '').trim().toLowerCase()
  // 'eligibility' grants the student discount straight away; 'domain_proof'
  // only proves mailbox ownership so a reviewed category (educator) can be
  // submitted to the manual queue.
  const purpose = payload.purpose === 'domain_proof' ? 'domain_proof' : 'eligibility'
  const category = payload.category === 'educator' ? 'educator' : 'student'

  try {
    if (action === 'proof_status') {
      const { data: proven, error: proofError } = await admin.rpc('has_domain_proof', {
        _user: user.id,
        _email: email,
      })
      if (proofError) throw proofError
      return json({ ok: true, proven: Boolean(proven), email })
    }

    if (action === 'status' || action === 'start') {
      const { data: status, error: statusError } = await admin.rpc('academic_domain_status', {
        _email: email,
      })
      if (statusError) throw statusError
      const info = status as Record<string, unknown>

      if (!info?.valid) return json({ ok: false, ...info, error: 'Enter a valid email address' }, 400)
      if (action === 'status') return json({ ok: true, ...info })
      if (!info.recognized) {
        return json(
          {
            ok: false,
            ...info,
            error:
              "We don't recognise that domain as an academic one yet. Request your school below and we'll review it.",
          },
          400,
        )
      }

      // One academic address can only ever unlock one account.
      const { data: claimed } = await admin
        .from('verification_email_claims')
        .select('user_id')
        .eq('email', email)
        .maybeSingle()
      if (claimed && claimed.user_id !== user.id) {
        return json({ ok: false, error: 'That school email is already linked to another Gradr account.' }, 409)
      }

      const { data: recent } = await admin
        .from('academic_email_verifications')
        .select('id, last_sent_at, created_at')
        .eq('user_id', user.id)
        .is('consumed_at', null)
        .order('created_at', { ascending: false })
        .limit(10)

      const last = recent?.[0]
      if (last && Date.now() - new Date(last.last_sent_at).getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
        return json({ ok: false, error: 'Please wait a minute before requesting another code.' }, 429)
      }
      const hourAgo = Date.now() - 3_600_000
      const sentThisHour = (recent ?? []).filter((r) => new Date(r.created_at).getTime() > hourAgo).length
      if (sentThisHour >= MAX_SENDS_PER_HOUR) {
        return json({ ok: false, error: 'Too many codes requested. Try again in an hour.' }, 429)
      }

      const code = generateCode()
      const { error: insertError } = await admin.from('academic_email_verifications').insert({
        user_id: user.id,
        email,
        domain: String(info.domain ?? email.split('@')[1]),
        code_hash: await sha256(`${user.id}:${email}:${code}`),
        purpose,
        category,
        expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
      })
      if (insertError) throw insertError

      // The student verification code email is sent by app.gradr.me, which owns
      // every verification flow. This surface must not mail product codes.
      console.error('verify-academic-email invoked on the marketing surface', { userId: user.id })
      const sent = false
      if (!sent) {
        return json({ ok: false, error: "We couldn't send the code. Please try again shortly." }, 502)
      }

      return json({ ok: true, sent: true, email, expiresInMinutes: CODE_TTL_MINUTES, ...info })
    }

    if (action === 'confirm') {
      const code = (payload.code ?? '').replace(/\D/g, '')
      if (code.length !== 6) return json({ ok: false, error: 'Enter the 6-digit code from your email.' }, 400)

      const { data: row } = await admin
        .from('academic_email_verifications')
        .select('id, email, domain, attempts, expires_at, code_hash')
        .eq('user_id', user.id)
        .eq('email', email)
        .is('consumed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!row) return json({ ok: false, error: 'Request a new code to continue.' }, 400)
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return json({ ok: false, error: 'That code expired. Send yourself a new one.' }, 400)
      }
      if (row.attempts >= MAX_ATTEMPTS) {
        return json({ ok: false, error: 'Too many incorrect attempts. Request a new code.' }, 429)
      }

      const expected = await sha256(`${user.id}:${row.email}:${code}`)
      if (expected !== row.code_hash) {
        await admin
          .from('academic_email_verifications')
          .update({ attempts: row.attempts + 1 })
          .eq('id', row.id)
        return json(
          { ok: false, error: 'That code is incorrect.', attemptsLeft: MAX_ATTEMPTS - row.attempts - 1 },
          400,
        )
      }

      const consumedAt = new Date().toISOString()
      await admin
        .from('academic_email_verifications')
        .update({ consumed_at: consumedAt })
        .eq('id', row.id)

      // Bind the address to this account for good.
      await admin.from('verification_email_claims').upsert(
        {
          email: row.email,
          user_id: user.id,
          domain: row.domain,
          last_verified_at: consumedAt,
        },
        { onConflict: 'email' },
      )

      if (purpose === 'domain_proof') {
        // Ownership proven — the request itself still goes to a human reviewer.
        return json({ ok: true, verified: true, proofOnly: true, email: row.email })
      }

      const { data: category } = await admin
        .from('eligibility_categories')
        .select('verification_validity_days, default_discount_percent')
        .eq('key', 'student')
        .maybeSingle()

      const validityDays = category?.verification_validity_days ?? 365
      const now = new Date()
      const { error: upsertError } = await admin.from('eligibility_verifications').upsert(
        {
          user_id: user.id,
          eligibility_type: 'student',
          provider: 'academic_email',
          provider_reference_id: row.email,
          status: 'verified',
          verified_at: now.toISOString(),
          last_checked_at: now.toISOString(),
          expires_at: new Date(now.getTime() + validityDays * 86_400_000).toISOString(),
          failure_reason: null,
          metadata: { email: row.email, domain: row.domain, method: 'academic_email_code' },
        },
        { onConflict: 'user_id,eligibility_type' },
      )
      if (upsertError) throw upsertError

      return json({
        ok: true,
        verified: true,
        email: row.email,
        discountPercent: Number(category?.default_discount_percent ?? 0),
      })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    console.error('verify-academic-email failed', err)
    return json({ error: err instanceof Error ? err.message : 'Verification failed' }, 500)
  }
})
