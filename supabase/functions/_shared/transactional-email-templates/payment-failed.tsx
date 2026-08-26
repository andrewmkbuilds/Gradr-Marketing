/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Card, Cta, DetailTable, EmailLayout, Paragraph, appLink, greeting, link } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  amount?: string
  planName?: string
  failedAt?: string
  reason?: string
  cardBrand?: string
  cardLast4?: string
  gracePeriodEnds?: string
  updatePaymentUrl?: string
}

const Email = ({
  firstName,
  amount,
  planName,
  failedAt,
  reason,
  cardBrand,
  cardLast4,
  gracePeriodEnds,
  updatePaymentUrl,
}: Props) => {
  const href = updatePaymentUrl || appLink('/billing', 'payment-failed')
  return (
    <EmailLayout
      preview="We couldn't process your Gradr payment."
      eyebrow="Action needed"
      headline="We couldn't process your payment"
      tone="danger"
      campaign="payment-failed"
    >
      <Paragraph>{greeting(firstName)}</Paragraph>
      <Paragraph>
        Your {planName || 'Pro'} renewal of {amount || '$19.00'} was declined. Your account stays active for now — we'll
        retry automatically, but updating your card is the fastest fix.
      </Paragraph>
      <DetailTable
        rows={[
          { label: 'Plan', value: planName || 'Pro' },
          { label: 'Amount due', value: amount || '$19.00' },
          { label: 'Attempted', value: failedAt || 'Today' },
          { label: 'Payment method', value: cardLast4 ? `${cardBrand || 'Card'} •••• ${cardLast4}` : 'Card on file' },
          { label: 'Decline reason', value: reason || 'Declined by issuer' },
        ]}
      />
      <Card tone="danger" title="What happens next">
        <Paragraph>
          We retry the charge over the next few days. If it still fails
          {gracePeriodEnds ? ` by ${gracePeriodEnds}` : ''}, your plan drops to the free tier — your data is never
          deleted.
        </Paragraph>
      </Card>
      <Cta href={href} tone="mahogany">
        Update payment method
      </Cta>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: 'Action needed: your Gradr payment failed',
  displayName: 'Payment failed',
  previewData: {
    firstName: 'Andrew',
    amount: '$19.00',
    planName: 'Pro',
    failedAt: '13 Aug 2026',
    reason: 'Insufficient funds',
    cardBrand: 'Visa',
    cardLast4: '4242',
    gracePeriodEnds: '20 Aug 2026',
  },
} satisfies TemplateEntry
