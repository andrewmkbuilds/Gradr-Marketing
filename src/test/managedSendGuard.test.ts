/**
 * Managed-sending payload guard.
 *
 * Lovable's managed email API owns the unsubscribe footer. A send payload that
 * carries its own `unsubscribe_token` is rejected upstream with
 * `400 missing_unsubscribe`, which shows up as a silent newsletter failure.
 * The guard must fail fast *before* the network call and emit one exact,
 * machine-parseable log line that alerting keys off.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertManagedSendPayload,
  ManagedSendGuardError,
} from '../../supabase/functions/_shared/managedSendGuard'

const basePayload = {
  to: 'reader@example.com',
  subject: 'Confirm your subscription',
  html: '<p>hi</p>',
  text: 'hi',
  idempotency_key: 'newsletter-confirm:abc',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('assertManagedSendPayload', () => {
  it('allows a payload that leaves unsubscribe handling to managed sending', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      assertManagedSendPayload(basePayload, { templateName: 'newsletter-confirm' }),
    ).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it.each([
    'unsubscribe_token',
    'unsubscribeToken',
    'Unsubscribe-Token',
  ])('fails fast when the payload sets %s', (key) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const payload = { ...basePayload, [key]: 'tok_123' }
    expect(() =>
      assertManagedSendPayload(payload, { templateName: 'newsletter-confirm' }),
    ).toThrow(ManagedSendGuardError)
  })

  it('throws before any send with the documented error code and offending keys', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let thrown: unknown
    try {
      assertManagedSendPayload(
        { ...basePayload, unsubscribe_token: 'tok_123' },
        { templateName: 'newsletter-confirm', messageId: 'msg-1' },
      )
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(ManagedSendGuardError)
    const error = thrown as ManagedSendGuardError
    expect(error.code).toBe('unsubscribe_token_forbidden')
    expect(error.name).toBe('ManagedSendGuardError')
    expect(error.offendingKeys).toEqual(['unsubscribe_token'])
    expect(error.message).toContain('unsubscribe_token')
  })

  it('emits exactly one structured critical log line', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      assertManagedSendPayload(
        { ...basePayload, unsubscribe_token: 'tok_123' },
        { templateName: 'newsletter-confirm', messageId: 'msg-1' },
      ),
    ).toThrow()

    expect(spy).toHaveBeenCalledTimes(1)
    const [raw] = spy.mock.calls[0] as [string]
    expect(typeof raw).toBe('string')
    const logged = JSON.parse(raw)
    expect(logged).toMatchObject({
      level: 'error',
      event: 'managed_send_guard_violation',
      alert: true,
      severity: 'critical',
      templateName: 'newsletter-confirm',
      messageId: 'msg-1',
      offendingKeys: ['unsubscribe_token'],
      message:
        'Blocked an email send that set unsubscribe_token manually. Managed sending ' +
        'appends the unsubscribe footer itself and rejects payloads that set it.',
    })
    expect(Date.parse(logged.ts)).not.toBeNaN()
  })

  it('reports every offending key when several variants are present', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      assertManagedSendPayload(
        { ...basePayload, unsubscribe_token: 'a', unsubscribeToken: 'b' },
        { templateName: 'newsletter-welcome' },
      ),
    ).toThrow(ManagedSendGuardError)
    const logged = JSON.parse((spy.mock.calls[0] as [string])[0])
    expect(logged.offendingKeys).toEqual(['unsubscribe_token', 'unsubscribeToken'])
  })
})
