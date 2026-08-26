/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Bullets, Cta, EmailLayout, Paragraph, SecondaryLink, greeting, marketingLink } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  /** Optional topic the reader opted into, shown in the intro. */
  topic?: string
}

const Email = ({ firstName, topic }: Props) => (
  <EmailLayout
    preview="You're on the Gradr list — here's what lands in your inbox"
    eyebrow="Newsletter"
    headline="Welcome to the Gradr newsletter"
    campaign="newsletter-welcome"
    audience="marketing"
    footerNote="You received this because you subscribed to the Gradr newsletter on gradr.me."
  >
    <Paragraph>{greeting(firstName)}</Paragraph>
    <Paragraph>
      Thanks for subscribing{topic ? ` to ${topic}` : ''}. Once or twice a month we send the
      practical parts of a modern job search — nothing else.
    </Paragraph>
    <Bullets
      items={[
        'What actually moves an ATS score, with before/after examples',
        'Interview patterns we see working right now, by role and seniority',
        'Short product notes when we ship something worth your time',
      ]}
    />
    <Cta href={marketingLink('/career-advice', 'newsletter-welcome')}>Read the latest guides</Cta>
    <SecondaryLink href={marketingLink('/ats-resume-checker', 'newsletter-welcome')}>
      Check a resume against an ATS
    </SecondaryLink>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'Welcome to the Gradr newsletter',
  displayName: 'Newsletter welcome',
  category: 'marketing',
  version: '1.0.0',
  previewData: { firstName: 'Amara', topic: 'career guides' },
} satisfies TemplateEntry
