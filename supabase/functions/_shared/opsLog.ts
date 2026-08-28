/**
 * Structured logging + alerting for edge functions.
 *
 * Every line is a single JSON object so log search can filter on
 * `fn`, `event`, `level` and `template` instead of grepping prose.
 * `raiseAlert` additionally persists the incident to `public.ops_alerts`
 * (admin-readable) so template rejections and delivery failures surface in the
 * ops console immediately rather than being buried in function logs.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type AlertSeverity = 'warn' | 'error' | 'critical'

export interface LogFields {
  event: string
  [key: string]: unknown
}

const REDACT = /(^|[_.])(token|secret|key|password|authorization)($|[_.])/i

function scrub(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT.test(k)) {
      out[k] = '[redacted]'
      continue
    }
    // Email addresses are logged as a masked form only.
    if (typeof v === 'string' && k.toLowerCase().includes('email')) {
      out[k] = maskEmail(v)
      continue
    }
    out[k] = v instanceof Error ? v.message : v
  }
  return out
}

export function maskEmail(email: string): string {
  const [local, domain] = String(email).split('@')
  if (!domain) return '***'
  const head = local.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`
}

export function createLogger(fn: string) {
  const emit = (level: LogLevel, fields: LogFields) => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      fn,
      ...scrub(fields),
    })
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  }

  return {
    debug: (fields: LogFields) => emit('debug', fields),
    info: (fields: LogFields) => emit('info', fields),
    warn: (fields: LogFields) => emit('warn', fields),
    error: (fields: LogFields) => emit('error', fields),
    /**
     * Logs at error level and records an alert row. Alerting never throws —
     * a failed alert write must not break the flow that raised it.
     */
    alert: async (params: {
      event: string
      message: string
      severity?: AlertSeverity
      context?: Record<string, unknown>
    }): Promise<void> => {
      const severity = params.severity ?? 'error'
      const context = scrub(params.context ?? {})
      emit(severity === 'warn' ? 'warn' : 'error', {
        event: params.event,
        alert: true,
        severity,
        message: params.message,
        ...context,
      })
      try {
        const url = Deno.env.get('SUPABASE_URL')
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (!url || !serviceKey) return
        const db = createClient(url, serviceKey, { auth: { persistSession: false } })
        await db.from('ops_alerts').insert({
          source: fn,
          event: params.event,
          severity,
          message: params.message.slice(0, 1000),
          context,
        })
      } catch (err) {
        console.error(
          JSON.stringify({ ts: new Date().toISOString(), level: 'error', fn, event: 'ops_alert_write_failed', error: String(err) }),
        )
      }
    },
  }
}

export type Logger = ReturnType<typeof createLogger>
