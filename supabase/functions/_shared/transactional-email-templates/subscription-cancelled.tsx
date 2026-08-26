/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Bullets, Card, Cta, DetailTable, EmailLayout, Paragraph, SecondaryLink, appLink, greeting, link } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  planName?: string
  accessUntil?: string
  cancelledAt?: string
  reason?: string
}

const Email = ({ firstName, planName, accessUntil, cancelledAt, reason }: Props) => (
  <EmailLayout
    preview="Your Gradr subscription has been cancelled."
    eyebrow="Subscription cancelled"
    headline="Your subscription has been cancelled"
    tone="mahogany"
    campaign="subscription-cancelled"
  >
    <Paragraph>{greeting(firstName)}</Paragraph>
    <Paragraph>
      Your {planName || 'Pro'} plan is cancelled and will not renew. You keep full access until the end of the paid
      period, then the account moves to the free tier.
    </Paragraph>
    <DetailTable
      rows={[
        { label: 'Plan', value: planName || 'Pro' },
        { label: 'Cancelled on', value: cancelledAt || 'Today' },
        { label: 'Access until', value: accessUntil || 'End of current period' },
        ...(reason ? [{ label: 'Reason', value: reason }] : []),
      ]}
    />
    <Card title="Your data is safe">
      <Bullets
        items={[
          'Resumes, versions and ATS history stay in your account.',
          'Tracked applications and interview reports remain accessible.',
          'Export everything any time from Settings → Data & privacy.',
        ]}
      />
    </Card>
    <Cta href={link('/pricing', 'subscription-cancelled')} tone="mahogany">
      Reactivate my plan
    </Cta>
    <SecondaryLink href={appLink('/settings', 'subscription-cancelled')}>Export my data</SecondaryLink>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'Your Gradr subscription has been cancelled',
  displayName: 'Subscription cancelled',
  previewData: { firstName: 'Andrew', planName: 'Pro', cancelledAt: '13 Aug 2026', accessUntil: '13 Sep 2026' },
} satisfies TemplateEntry
