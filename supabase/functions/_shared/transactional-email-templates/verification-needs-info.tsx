/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Bullets, Card, Cta, DetailTable, EmailLayout, Paragraph, appLink, greeting } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  verificationType?: string
  reviewerNotes?: string
  reviewedAt?: string
}

const Email = ({ firstName, verificationType, reviewerNotes, reviewedAt }: Props) => (
  <EmailLayout
    preview="A reviewer needs a little more information."
    eyebrow="Verification update"
    headline="We need a bit more information"
    tone="mahogany"
    campaign="verification-needs-info"
  >
    <Paragraph>{greeting(firstName)}</Paragraph>
    <Paragraph>
      A Gradr reviewer looked at your {verificationType || 'eligibility'} verification and needs one more
      detail before making a decision.
    </Paragraph>
    <DetailTable
      rows={[
        { label: 'Verification type', value: verificationType || 'Eligibility' },
        { label: 'Reviewed', value: reviewedAt || 'Today' },
        { label: 'What we need', value: reviewerNotes || 'Additional proof of your current status.' },
      ]}
    />
    <Card tone="mahogany" title="How to respond">
      <Bullets
        tone="mahogany"
        items={[
          'Open Gradr and go to Settings → Discounts & eligibility.',
          'Add the extra evidence to your request — a document or a short explanation is enough.',
          'Your request goes straight back to a reviewer, usually answered within 1–2 business days.',
        ]}
      />
    </Card>
    <Cta href={appLink('/settings#eligibility', 'verification-needs-info')}>Update my request</Cta>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'We need a bit more information for your Gradr verification',
  displayName: 'Verification — more information needed',
  previewData: {
    firstName: 'Alex',
    verificationType: 'Educator',
    reviewerNotes: 'Please share a staff page or faculty directory link.',
    reviewedAt: 'March 4, 2026',
  },
} satisfies TemplateEntry
