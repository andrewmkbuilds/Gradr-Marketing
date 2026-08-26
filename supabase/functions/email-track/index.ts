/**
 * Open / click tracking endpoint for opt-in landing emails.
 *
 * GET ?m=<message_id>&t=open           → 1x1 transparent GIF
 * GET ?m=<message_id>&t=click&u=<url>  → 302 to the original marketing URL
 *
 * The message id is the `message_id` already recorded in `email_send_log`, so
 * every event joins straight onto a real send. No cookies are set, no raw IP or
 * user agent is stored: a short hash is kept only to fold repeated fetches by
 * the same client (image proxies) into one row per minute.
 *
 * Only destinations on gradr.me (or its subdomains) are followed — an open
 * redirect in an email link would be a phishing gift.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TRACKED_TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const PIXEL = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (c) => c.charCodeAt(0),
)

const ALLOWED_HOSTS = /(^|\.)gradr\.me$/i

const pixelResponse = () =>
  new Response(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.byteLength),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    },
  })

async function shortHash(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  return Array.from(bytes.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function safeTarget(raw: string | null): string {
  if (!raw) return 'https://gradr.me/'
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.test(url.hostname)) return 'https://gradr.me/'
    return url.toString()
  } catch {
    return 'https://gradr.me/'
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const url = new URL(req.url)
  const messageId = (url.searchParams.get('m') ?? '').trim().slice(0, 64)
  const eventType = url.searchParams.get('t') === 'click' ? 'click' : 'open'
  const target = eventType === 'click' ? safeTarget(url.searchParams.get('u')) : null

  const redirect = () =>
    new Response(null, { status: 302, headers: { Location: target!, 'Cache-Control': 'no-store' } })
  const respond = () => (eventType === 'click' ? redirect() : pixelResponse())

  // A malformed pixel must never look broken in a mail client, and a click must
  // always reach the page — record what we can, then always respond normally.
  if (!/^[0-9a-fA-F-]{16,64}$/.test(messageId)) return respond()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return respond()

  try {
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const { data: send } = await db
      .from('email_send_log')
      .select('template_name, recipient_email')
      .eq('message_id', messageId)
      .limit(1)
      .maybeSingle()

    // Only tracked, opt-in landing templates are recorded.
    if (send && (TRACKED_TEMPLATES as readonly string[]).includes(send.template_name)) {
      const minute = new Date().toISOString().slice(0, 16)
      const clientHash = await shortHash(
        [
          (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim(),
          req.headers.get('user-agent') ?? '',
          messageId,
          eventType,
          target ?? '',
          minute,
        ].join('|'),
      )

      // Fold repeated fetches by the same client within the same minute
      // (Gmail's image proxy re-requests aggressively) into a single event.
      const { data: duplicate } = await db
        .from('email_engagement_events')
        .select('id')
        .eq('client_hash', clientHash)
        .limit(1)
        .maybeSingle()
      if (duplicate) return respond()

      const { error } = await db.from('email_engagement_events').insert({
        message_id: messageId,
        template_name: send.template_name,
        recipient_email: send.recipient_email,
        event_type: eventType,
        target_url: target,
        client_hash: clientHash,
      })
      if (error) console.error('email-track: insert failed', error)
    }
  } catch (err) {
    console.error('email-track: unexpected failure', String(err))
  }

  return respond()
})
