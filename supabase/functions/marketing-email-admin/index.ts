import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { MARKETING_TEMPLATES, TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

/**
 * Admin-only read surface for the marketing email programme.
 *
 * - `previews`: renders every marketing-category template with its preview data.
 * - `log`: deduplicated send log (latest row per message_id) with recipient,
 *   template version and delivery status.
 *
 * Access: an authenticated caller holding the `admin` role. The role check runs
 * server-side against public.user_roles via has_role(); nothing here trusts the
 * client. Recipient addresses are sensitive, so the function fails closed.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('marketing-email-admin: missing environment configuration')
    return json({ error: 'Server configuration error' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  const user = userData?.user
  if (userError || !user) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: isAdmin, error: roleError } = await admin.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin',
  })
  if (roleError) {
    console.error('marketing-email-admin: role check failed', roleError)
    return json({ error: 'Failed to verify access' }, 500)
  }
  if (!isAdmin) return json({ error: 'Forbidden' }, 403)

  let action = 'log'
  let days = 30
  let templateFilter: string | null = null
  let statusFilter: string | null = null
  try {
    const body = req.method === 'POST' ? await req.json() : {}
    if (typeof body.action === 'string') action = body.action
    if (Number.isFinite(body.days)) days = Math.min(365, Math.max(1, Number(body.days)))
    if (typeof body.templateName === 'string' && body.templateName) templateFilter = body.templateName
    if (typeof body.status === 'string' && body.status) statusFilter = body.status
  } catch {
    // defaults are fine
  }

  if (action === 'previews') {
    const templates = []
    for (const name of MARKETING_TEMPLATES) {
      const entry = TEMPLATES[name]
      const displayName = entry.displayName ?? name
      const version = entry.version ?? 'unversioned'
      try {
        const data = entry.previewData ?? {}
        const html = await renderAsync(React.createElement(entry.component, data))
        const subject = typeof entry.subject === 'function' ? entry.subject(data) : entry.subject
        templates.push({ templateName: name, displayName, version, subject, html, status: 'ready' })
      } catch (err) {
        console.error('marketing-email-admin: render failed', { name, err })
        templates.push({
          templateName: name,
          displayName,
          version,
          subject: '',
          html: '',
          status: 'render_failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return json({ templates })
  }

  if (action === 'log') {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    let query = admin
      .from('email_send_log')
      .select('message_id, template_name, recipient_email, status, error_message, metadata, created_at')
      .in('template_name', MARKETING_TEMPLATES)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (templateFilter) query = query.eq('template_name', templateFilter)

    const { data, error } = await query
    if (error) {
      console.error('marketing-email-admin: log query failed', error)
      return json({ error: 'Failed to load send log' }, 500)
    }

    // One email produces several rows (pending → sent/dlq) sharing a message_id.
    // Keep only the newest row per message_id so counts reflect real emails.
    const latest = new Map<string, Record<string, unknown>>()
    for (const row of data ?? []) {
      const key = row.message_id ?? `${row.template_name}:${row.created_at}`
      if (!latest.has(key)) latest.set(key, row)
    }
    let rows = Array.from(latest.values())
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter)

    const stats = rows.reduce<Record<string, number>>((acc, r) => {
      const s = String(r.status ?? 'unknown')
      acc[s] = (acc[s] ?? 0) + 1
      return acc
    }, {})

    return json({
      rows,
      stats: { total: rows.length, ...stats },
      templates: MARKETING_TEMPLATES.map((name) => ({
        templateName: name,
        displayName: TEMPLATES[name].displayName ?? name,
        version: TEMPLATES[name].version ?? 'unversioned',
      })),
    })
  }

  return json({ error: `Unknown action '${action}'` }, 400)
})
