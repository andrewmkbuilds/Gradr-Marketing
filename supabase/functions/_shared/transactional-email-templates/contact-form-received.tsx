/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Card, DetailTable, EmailLayout, Paragraph, SecondaryLink, greeting, marketingLink } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  subject?: string
  message?: string
  reference?: string
  submittedAt?: string
}

const Email = ({ firstName, subject, message, reference, submittedAt }: Props) => (
  <EmailLayout
    preview="We received your message — here's a copy for your records"
    eyebrow="Contact"
    headline="Thanks — we have your message"
    campaign="contact-form-received"
    audience="marketing"
    footerNote="This is a confirmation of a message you sent through the contact form on gradr.me."
  >
    <Paragraph>{greeting(firstName)}</Paragraph>
    <Paragraph>
      Your message reached the Gradr team. A human replies to everything, usually within one
      business day.
    </Paragraph>
    <DetailTable
      rows={[
        { label: 'Reference', value: reference || '—' },
        { label: 'Subject', value: subject || 'General enquiry' },
        { label: 'Received', value: submittedAt || 'Just now' },
      ]}
    />
    {message ? (
      <Card title="What you sent" tone="neutral">
        <Paragraph muted>{message}</Paragraph>
      </Card>
    ) : null}
    <SecondaryLink href={marketingLink('/support', 'contact-form-received')}>
      Browse help articles while you wait
    </SecondaryLink>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `We received your message${d?.reference ? ` (${d.reference})` : ''}`,
  displayName: 'Contact form received',
  category: 'marketing',
  version: '1.0.0',
  previewData: {
    firstName: 'Ben',
    subject: 'Question about student pricing',
    message: 'Hi — I am a final-year student, does the discount apply to the annual plan too?',
    reference: 'GR-4821',
    submittedAt: '26 Aug 2026, 09:12 UTC',
  },
} satisfies TemplateEntry
