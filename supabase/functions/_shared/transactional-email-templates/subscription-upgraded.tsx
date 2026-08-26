/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Bullets, Card, Cta, DetailTable, EmailLayout, Paragraph, appLink, greeting, link } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  previousPlan?: string
  planName?: string
  amount?: string
  interval?: string
  effectiveDate?: string
  nextBillingDate?: string
  unlocked?: string[]
}

const Email = ({
  firstName,
  previousPlan,
  planName,
  amount,
  interval,
  effectiveDate,
  nextBillingDate,
  unlocked,
}: Props) => (
  <EmailLayout
    preview={`You're now on Gradr ${planName || 'Pro'}.`}
    eyebrow="Subscription upgraded"
    headline={`You've moved up to ${planName || 'Pro'}`}
    campaign="subscription-upgraded"
  >
    <Paragraph>{greeting(firstName)}</Paragraph>
    <Paragraph>
      Your upgrade from {previousPlan || 'your previous plan'} is complete and the new limits are already applied to
      your account.
    </Paragraph>
    <DetailTable
      rows={[
        { label: 'Previous plan', value: previousPlan || '—' },
        { label: 'New plan', value: planName || 'Pro' },
        { label: 'Price', value: `${amount || '$19.00'} / ${interval || 'month'}` },
        { label: 'Effective', value: effectiveDate || 'Immediately' },
        { label: 'Next billing date', value: nextBillingDate || '—' },
      ]}
    />
    <Card tone="mahogany" title="Newly unlocked">
      <Bullets
        tone="mahogany"
        items={
          unlocked?.length
            ? unlocked
            : ['Higher interview and analysis limits', 'Advanced ATS rewrites', 'Priority job matching refreshes']
        }
      />
    </Card>
    <Cta href={appLink('/', 'subscription-upgraded')}>Use my new limits</Cta>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `You're now on Gradr ${d?.planName || 'Pro'}`,
  displayName: 'Subscription upgraded',
  previewData: {
    firstName: 'Andrew',
    previousPlan: 'Starter',
    planName: 'Pro',
    amount: '$19.00',
    interval: 'month',
    effectiveDate: 'Immediately',
    nextBillingDate: '13 Sep 2026',
  },
} satisfies TemplateEntry
