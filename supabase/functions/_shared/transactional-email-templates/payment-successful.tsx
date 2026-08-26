/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Cta, DetailTable, EmailLayout, Paragraph, SecondaryLink, appLink, greeting, link } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  amount?: string
  planName?: string
  interval?: string
  paidAt?: string
  cardBrand?: string
  cardLast4?: string
  nextBillingDate?: string
  invoiceUrl?: string
}

const Email = ({
  firstName,
  amount,
  planName,
  interval,
  paidAt,
  cardBrand,
  cardLast4,
  nextBillingDate,
  invoiceUrl,
}: Props) => (
  <EmailLayout
    preview={`Payment of ${amount || '$19.00'} received — thank you.`}
    eyebrow="Payment received"
    headline={`Payment of ${amount || '$19.00'} received`}
    campaign="payment-successful"
  >
    <Paragraph>{greeting(firstName)}</Paragraph>
    <Paragraph>Thanks — your payment went through and your plan continues without interruption.</Paragraph>
    <DetailTable
      rows={[
        { label: 'Plan', value: `${planName || 'Pro'} (${interval || 'monthly'})` },
        { label: 'Amount', value: amount || '$19.00' },
        { label: 'Paid on', value: paidAt || 'Today' },
        { label: 'Payment method', value: cardLast4 ? `${cardBrand || 'Card'} •••• ${cardLast4}` : 'Card on file' },
        { label: 'Next billing date', value: nextBillingDate || '—' },
      ]}
    />
    <Cta href={invoiceUrl || appLink('/billing', 'payment-successful')}>View receipt</Cta>
    <SecondaryLink href={appLink('/billing', 'payment-successful')}>Manage subscription</SecondaryLink>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Payment received — ${d?.amount || '$19.00'}`,
  displayName: 'Payment successful',
  previewData: {
    firstName: 'Andrew',
    amount: '$19.00',
    planName: 'Pro',
    interval: 'monthly',
    paidAt: '13 Aug 2026',
    cardBrand: 'Visa',
    cardLast4: '4242',
    nextBillingDate: '13 Sep 2026',
  },
} satisfies TemplateEntry
