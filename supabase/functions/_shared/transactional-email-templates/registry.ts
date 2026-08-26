/// <reference types="npm:@types/react@18.3.1" />
import type * as React from 'npm:react@18.3.1'

import { template as subscriptionUpgraded } from './subscription-upgraded.tsx'
import { template as subscriptionDowngraded } from './subscription-downgraded.tsx'
import { template as newsletterWelcome } from './newsletter-welcome.tsx'
import { template as contactFormReceived } from './contact-form-received.tsx'
import { template as marketingAnnouncement } from './marketing-announcement.tsx'

export interface TemplateEntry {
  // deno-lint-ignore no-explicit-any
  component: React.ComponentType<any>
  // deno-lint-ignore no-explicit-any
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  /**
   * `marketing` templates are owned by the gradr.me surface and may only link
   * to public marketing pages. `lifecycle` templates are service-role sends
   * about an existing account. Auth emails (signup, magic link, recovery,
   * invite, email change, reauthentication) are NEVER registered here — they
   * belong to the app.gradr.me project.
   */
  category?: 'marketing' | 'lifecycle'
  /** Bumped whenever the rendered content changes; recorded on every send. */
  version?: string
  // deno-lint-ignore no-explicit-any
  previewData?: Record<string, any>
  to?: string
}

/**
 * Registry of every Gradr lifecycle email.
 * Add a new template by creating a `.tsx` file that exports
 * `template satisfies TemplateEntry` and registering it here.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'subscription-upgraded': subscriptionUpgraded,
  'subscription-downgraded': subscriptionDowngraded,
  'newsletter-welcome': newsletterWelcome,
  'contact-form-received': contactFormReceived,
  'marketing-announcement': marketingAnnouncement,
}

/** Template names owned by the marketing surface. */
export const MARKETING_TEMPLATES = Object.keys(TEMPLATES).filter(
  (name) => TEMPLATES[name].category === 'marketing'
)

/**
 * Auth email actions. This project must never register a template for any of
 * them — Supabase auth mail is rendered and sent by the app.gradr.me project.
 */
/**
 * Billing, payment, verification and security emails were retired from this
 * marketing project on 2026-08-26: app.gradr.me owns every live send. They are
 * kept here only so `send-transactional-email` can reject a stale caller with a
 * clear message instead of a generic "unknown template".
 */
export const RETIRED_TO_APP_TEMPLATES = [
  'security-alert',
  'subscription-started',
  'subscription-cancelled',
  'payment-successful',
  'payment-failed',
  'verification-approved',
  'verification-rejected',
  'verification-needs-info',
  'student-verification-code',
] as const

export const AUTH_TEMPLATE_NAMES = [
  'signup',
  'magiclink',
  'magic-link',
  'recovery',
  'invite',
  'email-change',
  'email_change',
  'reauthentication',
  'confirmation',
  'verification-code',
] as const

export type TemplateName = keyof typeof TEMPLATES
