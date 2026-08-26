/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Bullets, Cta, EmailLayout, Paragraph, SecondaryLink, greeting, marketingLink } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  eyebrow?: string
  headline?: string
  intro?: string
  highlights?: string[]
  ctaLabel?: string
  /** Public marketing path on gradr.me, e.g. "/blog/ai-resume-optimization". */
  ctaPath?: string
}

const Email = ({ firstName, eyebrow, headline, intro, highlights, ctaLabel, ctaPath }: Props) => {
  const title = headline || 'Something new from Gradr'
  return (
    <EmailLayout
      preview={intro || title}
      eyebrow={eyebrow || 'Announcement'}
      headline={title}
      campaign="marketing-announcement"
      audience="marketing"
      footerNote="You received this because you subscribed to Gradr updates on gradr.me."
    >
      <Paragraph>{greeting(firstName)}</Paragraph>
      <Paragraph>{intro || 'Here is what we shipped and why it matters for your job search.'}</Paragraph>
      {highlights?.length ? <Bullets items={highlights} /> : null}
      <Cta href={marketingLink(ctaPath || '/', 'marketing-announcement')}>
        {ctaLabel || 'Read the announcement'}
      </Cta>
      <SecondaryLink href={marketingLink('/career-advice', 'marketing-announcement')}>
        More from the Gradr blog
      </SecondaryLink>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => d?.headline || 'Something new from Gradr',
  displayName: 'Marketing announcement',
  category: 'marketing',
  version: '1.0.0',
  previewData: {
    firstName: 'Priya',
    eyebrow: 'Product news',
    headline: 'The ATS Resume Checker is now free for everyone',
    intro:
      'We opened up the deterministic ATS checker — paste a resume, get a parse report and the three fixes that matter most.',
    highlights: [
      'Deterministic scoring, no black-box guesswork',
      'Severity-ranked fixes you can apply in minutes',
      'Works on PDF and DOCX exports from any builder',
    ],
    ctaLabel: 'Try the ATS checker',
    ctaPath: '/ats-resume-checker',
  },
} satisfies TemplateEntry
