/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Card, Cta, DetailTable, EmailLayout, Paragraph, SecondaryLink, appLink, greeting, link } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  previousPlan?: string
  planName?: string
  amount?: string
  interval?: string
  effectiveDate?: string
  retainedUntil?: string
}

const Email = ({ firstName, previousPlan, planName, amount, interval, effectiveDate, retainedUntil }: Props) => (
  <EmailLayout
    preview={`Your plan changes to ${planName || 'Starter'}.`}
    eyebrow="Subscription updated"
    headline={`Your plan now moves to ${planName || 'Starter'}`}
    tone="mahogany"
    campaign="subscription-downgraded"
  >
    <Paragraph>{greeting(firstName)}</Paragraph>
    <Paragraph>
      We've recorded your change from {previousPlan || 'your previous plan'}. Nothing is deleted — your resumes,
      applications and interview reports stay exactly where they are.
    </Paragraph>
    <DetailTable
      rows={[
        { label: 'Previous plan', value: previousPlan || 'Pro' },
        { label: 'New plan', value: planName || 'Starter' },
        { label: 'New price', value: `${amount || '$0.00'} / ${interval || 'month'}` },
        { label: 'Effective', value: effectiveDate || 'End of current period' },
        { label: 'Current features until', value: retainedUntil || effectiveDate || '—' },
      ]}
    />
    <Card tone="mahogany" title="Changed your mind?">
      <Paragraph>Reactivating takes one click and restores your previous limits immediately.</Paragraph>
    </Card>
    <Cta href={link('/pricing', 'subscription-downgraded')} tone="mahogany">
      Compare plans
    </Cta>
    <SecondaryLink href={appLink('/billing', 'subscription-downgraded')}>Manage billing</SecondaryLink>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Your Gradr plan changes to ${d?.planName || 'Starter'}`,
  displayName: 'Subscription downgraded',
  previewData: {
    firstName: 'Andrew',
    previousPlan: 'Pro',
    planName: 'Starter',
    amount: '$0.00',
    interval: 'month',
    effectiveDate: '13 Sep 2026',
    retainedUntil: '13 Sep 2026',
  },
} satisfies TemplateEntry
