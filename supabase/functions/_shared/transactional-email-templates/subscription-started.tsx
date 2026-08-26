/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Bullets, Card, Cta, DetailTable, EmailLayout, Paragraph, SecondaryLink, appLink, greeting, link } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  planName?: string
  amount?: string
  interval?: string
  nextBillingDate?: string
  features?: string[]
}

const Email = ({ firstName, planName, amount, interval, nextBillingDate, features }: Props) => (
  <EmailLayout
    preview={`Your Gradr ${planName || 'Pro'} plan is active.`}
    eyebrow="Subscription"
    headline={`${planName || 'Pro'} is active — everything is unlocked`}
    campaign="subscription-started"
  >
    <Paragraph>{greeting(firstName)}</Paragraph>
    <Paragraph>
      Thank you for subscribing. Your plan is live now, so every gated engine is available on your next page load.
    </Paragraph>
    <DetailTable
      rows={[
        { label: 'Plan', value: planName || 'Pro' },
        { label: 'Price', value: `${amount || '$19.00'} / ${interval || 'month'}` },
        { label: 'Next billing date', value: nextBillingDate || '—' },
        { label: 'Status', value: 'Active' },
      ]}
    />
    <Card tone="mahogany" title="What just unlocked">
      <Bullets
        tone="mahogany"
        items={
          features?.length
            ? features
            : [
                'Unlimited AI mock interviews with scored reports',
                'Unlimited resume analyses and ATS rewrites',
                'Full job matching with tailored application packs',
                'Daily Career Briefing and 3-day action plans',
              ]
        }
      />
    </Card>
    <Cta href={appLink('/', 'subscription-started')}>Open my dashboard</Cta>
    <SecondaryLink href={appLink('/billing', 'subscription-started')}>Manage billing and invoices</SecondaryLink>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Your Gradr ${d?.planName || 'Pro'} plan is active`,
  displayName: 'Subscription started',
  previewData: {
    firstName: 'Andrew',
    planName: 'Pro',
    amount: '$19.00',
    interval: 'month',
    nextBillingDate: '13 Sep 2026',
  },
} satisfies TemplateEntry
