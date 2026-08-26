/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Bullets, Cta, EmailLayout, Paragraph, SecondaryLink, greeting, marketingLink } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * Day-3 follow-up — the final email in the opt-in welcome sequence.
 *
 * Same guarantees as day 1: one recipient, opt-in verified at send time, and
 * the sequence ends here. Nothing else is scheduled automatically.
 */
interface Props {
  firstName?: string
  topic?: string
}

const Email = ({ firstName, topic }: Props) => (
  <EmailLayout
    preview="How to get an interview-ready answer in one sitting"
    eyebrow="Day 3"
    headline="Practise the answer you keep fumbling"
    campaign="newsletter-followup-day3"
    audience="marketing"
    footerNote="Last email in the welcome sequence. You'll only hear from us once or twice a month after this."
  >
    <Paragraph>{greeting(firstName)}</Paragraph>
    <Paragraph>
      Most rejections we see are not skill problems — they are unrehearsed answers. This is the
      routine that fixes it{topic ? `, applied to ${topic}` : ''}.
    </Paragraph>
    <Bullets
      items={[
        'Pick the one question you dread and write the first 20 seconds only',
        'Say it out loud twice, then cut anything that is not evidence',
        'Repeat with a second question — two per session is plenty',
      ]}
    />
    <Cta href={marketingLink('/interview-preparation', 'newsletter-followup-day3')}>
      See the interview playbook
    </Cta>
    <SecondaryLink href={marketingLink('/career-advice', 'newsletter-followup-day3')}>
      Browse all career guides
    </SecondaryLink>
    <Paragraph muted>
      That is the whole welcome sequence. From here it is the monthly newsletter only, and you can
      leave any time with the link below.
    </Paragraph>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'The 10-minute interview drill that actually works',
  displayName: 'Newsletter follow-up (day 3)',
  category: 'marketing',
  version: '1.0.0',
  previewData: { firstName: 'Amara', topic: 'product roles' },
} satisfies TemplateEntry
