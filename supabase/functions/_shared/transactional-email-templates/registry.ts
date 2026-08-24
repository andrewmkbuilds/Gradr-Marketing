/// <reference types="npm:@types/react@18.3.1" />
import type * as React from 'npm:react@18.3.1'

import { template as securityAlert } from './security-alert.tsx'
import { template as subscriptionStarted } from './subscription-started.tsx'
import { template as subscriptionUpgraded } from './subscription-upgraded.tsx'
import { template as subscriptionDowngraded } from './subscription-downgraded.tsx'
import { template as subscriptionCancelled } from './subscription-cancelled.tsx'
import { template as paymentSuccessful } from './payment-successful.tsx'
import { template as paymentFailed } from './payment-failed.tsx'
import { template as verificationApproved } from './verification-approved.tsx'
import { template as verificationRejected } from './verification-rejected.tsx'
import { template as verificationNeedsInfo } from './verification-needs-info.tsx'
import { template as studentVerificationCode } from './student-verification-code.tsx'

export interface TemplateEntry {
  // deno-lint-ignore no-explicit-any
  component: React.ComponentType<any>
  // deno-lint-ignore no-explicit-any
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
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
  'security-alert': securityAlert,
  'subscription-started': subscriptionStarted,
  'subscription-upgraded': subscriptionUpgraded,
  'subscription-downgraded': subscriptionDowngraded,
  'subscription-cancelled': subscriptionCancelled,
  'payment-successful': paymentSuccessful,
  'payment-failed': paymentFailed,
  'verification-approved': verificationApproved,
  'verification-rejected': verificationRejected,
  'verification-needs-info': verificationNeedsInfo,
  'student-verification-code': studentVerificationCode,
}

export type TemplateName = keyof typeof TEMPLATES
