/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Bullets, Cta, EmailLayout, Paragraph, SecondaryLink, greeting, marketingLink } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * Day-1 orientation follow-up.
 *
 * Sent once, to a single recipient, only after that person completed double
 * opt-in on gradr.me. It is scheduled by `newsletter-subscribe` and dispatched
 * by `newsletter-followups`, which re-checks opt-in state and the suppression
 * list immediately before sending. The platform appends the unsubscribe footer.
 */
interface Props {
  firstName?: string
  topic?: string
}

const Email = ({ firstName }: Props) => (
  <EmailLayout
    preview="Start here: the three guides subscribers read first"
    eyebrow="Day 1"
    headline="Start with these three guides"
    campaign="newsletter-followup-day1"
    audience="marketing"
    footerNote="You received this because you confirmed your subscription to the Gradr newsletter on gradr.me."
  >
    <Paragraph>{greeting(firstName)}</Paragraph>
    <Paragraph>
      Yesterday you confirmed your subscription. Here is the short list new subscribers find most
      useful — each one is a read, not a pitch.
    </Paragraph>
    <Bullets
      items={[
        'How ATS parsing really works, and the formatting that quietly breaks it',
        'The resume scoring rubric we use, so you can grade your own draft',
        'A one-page tracker for keeping applications and follow-ups honest',
      ]}
    />
    <Cta href={marketingLink('/blog/ai-resume-optimization', 'newsletter-followup-day1')}>
      Read the resume guide
    </Cta>
    <SecondaryLink href={marketingLink('/ats-resume-checker', 'newsletter-followup-day1')}>
      Check a resume against an ATS
    </SecondaryLink>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'Start with these three Gradr guides',
  displayName: 'Newsletter follow-up (day 1)',
  category: 'marketing',
  version: '1.0.0',
  previewData: { firstName: 'Amara' },
} satisfies TemplateEntry
