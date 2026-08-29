/**
 * Minimal Sentry reporter for edge functions.
 *
 * Server-side failures used to live only in function logs and `ops_alerts`,
 * which nothing pages on. This posts the same incidents to Sentry as real
 * events, so frontend and backend errors land in one project with one alert
 * rule ("Gradr reliability alert").
 *
 * Deliberately dependency-free: it speaks the Sentry envelope protocol over
 * fetch. Configure with the SENTRY_DSN secret; without it every call is a
 * no-op, and a failed report never breaks the request that raised it.
 */

const DSN = Deno.env.get('SENTRY_DSN') ?? ''
const ENVIRONMENT = Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production'
const RELEASE = Deno.env.get('SENTRY_RELEASE') ?? undefined

interface ParsedDsn {
  endpoint: string
  publicKey: string
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace(/^\//, '')
    if (!projectId || !url.username) return null
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
    }
  } catch {
    return null
  }
}

const parsed = parseDsn(DSN)

export function sentryEdgeEnabled(): boolean {
  return parsed !== null
}

export type EdgeSeverity = 'warning' | 'error' | 'fatal'

/**
 * Report a server-side incident. Only ids, codes, enums and short messages —
 * never tokens, request bodies or full email addresses.
 */
export async function reportEdgeError(params: {
  fn: string
  event: string
  message: string
  level?: EdgeSeverity
  tags?: Record<string, string>
  context?: Record<string, unknown>
}): Promise<void> {
  if (!parsed) return
  const eventId = crypto.randomUUID().replace(/-/g, '')
  const timestamp = new Date().toISOString()

  const body = {
    event_id: eventId,
    timestamp,
    platform: 'javascript',
    level: params.level ?? 'error',
    environment: ENVIRONMENT,
    release: RELEASE,
    server_name: params.fn,
    logger: `edge.${params.fn}`,
    transaction: params.fn,
    message: { formatted: params.message.slice(0, 1000) },
    tags: {
      fn: params.fn,
      event: params.event,
      runtime: 'supabase-edge',
      ...(params.tags ?? {}),
    },
    extra: params.context ?? {},
    // Groups every occurrence of one failure mode into a single issue.
    fingerprint: [params.fn, params.event],
  }

  const envelope =
    JSON.stringify({ event_id: eventId, sent_at: timestamp, dsn: DSN }) +
    '\n' +
    JSON.stringify({ type: 'event' }) +
    '\n' +
    JSON.stringify(body) +
    '\n'

  try {
    await fetch(parsed.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=gradr-edge/1.0, sentry_key=${parsed.publicKey}`,
      },
      body: envelope,
    })
  } catch (err) {
    // Monitoring must never take down the thing it monitors.
    console.error(
      JSON.stringify({
        ts: timestamp,
        level: 'warn',
        fn: params.fn,
        event: 'sentry_report_failed',
        error: String(err),
      }),
    )
  }
}
