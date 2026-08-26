/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Cta, EmailLayout, Paragraph, SecondaryLink, greeting, marketingLink } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  /** Opaque, single-use confirmation token minted by `newsletter-subscribe`. */
  confirmToken?: string
  /** Optional topic the reader opted into, echoed back for clarity. */
  topic?: string
}

const Email = ({ firstName, confirmToken, topic }: Props) => {
  const confirmUrl = marketingLink(
    `/newsletter/confirm?token=${encodeURIComponent(confirmToken ?? '')}`,
    'newsletter-confirm',
  )
  return (
    <EmailLayout
      preview="One click to confirm your Gradr newsletter subscription"
      eyebrow="Newsletter"
      headline="Confirm your subscription"
      campaign="newsletter-confirm"
      audience="marketing"
      footerNote="You received this because this address was entered on gradr.me. If that wasn't you, ignore this email and nothing happens."
    >
      <Paragraph>{greeting(firstName)}</Paragraph>
      <Paragraph>
        Please confirm you want the Gradr newsletter{topic ? ` on ${topic}` : ''}. We only add
        an address after it has been confirmed, so this is the last email you get unless you
        click below.
      </Paragraph>
      <Cta href={confirmUrl}>Confirm subscription</Cta>
      <Paragraph>This link expires in 7 days and can only be used once.</Paragraph>
      <SecondaryLink href={marketingLink('/career-advice', 'newsletter-confirm')}>
        Meanwhile, read the latest guides
      </SecondaryLink>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: 'Confirm your Gradr newsletter subscription',
  displayName: 'Newsletter confirmation (double opt-in)',
  category: 'marketing',
  version: '1.0.0',
  previewData: { firstName: 'Amara', confirmToken: 'preview-token', topic: 'career guides' },
} satisfies TemplateEntry
