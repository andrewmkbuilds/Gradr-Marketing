/**
 * Managed-sending payload guard.
 *
 * Lovable's managed email API owns the unsubscribe footer and the unsubscribe
 * link end-to-end. A payload that carries its own `unsubscribe_token` is
 * rejected upstream with `400 missing_unsubscribe`, which surfaces as a silent
 * newsletter-confirmation failure. Rather than discover that from a provider
 * error, fail fast here with an unambiguous log line.
 */

/** Keys that must never appear in a payload handed to the managed email API. */
const FORBIDDEN_KEYS = ['unsubscribe_token', 'unsubscribetoken', 'unsubscribe-token']

export class ManagedSendGuardError extends Error {
  readonly code = 'unsubscribe_token_forbidden'
  readonly offendingKeys: string[]
  constructor(offendingKeys: string[]) {
    super(
      `Managed email sending forbids setting the unsubscribe token manually; ` +
        `remove ${offendingKeys.join(', ')} from the send payload. ` +
        `Lovable appends the unsubscribe footer for every email.`,
    )
    this.name = 'ManagedSendGuardError'
    this.offendingKeys = offendingKeys
  }
}

function findForbidden(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((key) =>
    FORBIDDEN_KEYS.includes(key.toLowerCase().replace(/\s+/g, '')),
  )
}

/**
 * Throws {@link ManagedSendGuardError} when the outgoing send payload sets an
 * unsubscribe token. Call immediately before `sendLovableEmail`.
 */
export function assertManagedSendPayload(
  payload: Record<string, unknown>,
  context: { templateName: string; messageId?: string },
): void {
  const offending = findForbidden(payload)
  if (offending.length === 0) return

  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      event: 'managed_send_guard_violation',
      alert: true,
      severity: 'critical',
      templateName: context.templateName,
      messageId: context.messageId,
      offendingKeys: offending,
      message:
        'Blocked an email send that set unsubscribe_token manually. Managed sending ' +
        'appends the unsubscribe footer itself and rejects payloads that set it.',
    }),
  )
  throw new ManagedSendGuardError(offending)
}
