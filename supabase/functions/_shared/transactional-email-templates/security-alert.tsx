/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Badge, Bullets, Cta, DetailTable, EmailLayout, Paragraph, appLink, link } from './components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  title?: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
  summary?: string
  detectedAt?: string
  source?: string
  affected?: string
  actions?: string[]
  reviewUrl?: string
}

const toneFor = (s?: string) => (s === 'critical' || s === 'high' ? 'danger' : s === 'medium' ? 'warning' : 'teal')

const Email = ({ title, severity, summary, detectedAt, source, affected, actions, reviewUrl }: Props) => {
  const href = reviewUrl || appLink('/admin/security', 'security-alert')
  return (
    <EmailLayout
      preview={title || 'Security alert from Gradr'}
      eyebrow="Security operations"
      headline={title || 'Security alert'}
      tone={toneFor(severity) as 'danger' | 'warning' | 'teal'}
      campaign="security-alert"
      footerNote="Operational security alert — sent to Gradr administrators only."
    >
      <Paragraph>
        <Badge tone={toneFor(severity) as 'danger'}>{severity || 'medium'} severity</Badge>
      </Paragraph>
      <Paragraph>{summary || 'A security finding requires review.'}</Paragraph>
      <DetailTable
        rows={[
          { label: 'Detected', value: detectedAt || 'Just now' },
          { label: 'Source', value: source || 'Automated scan' },
          { label: 'Affected surface', value: affected || 'Not specified' },
        ]}
      />
      {actions?.length ? <Bullets tone="mahogany" items={actions} /> : null}
      <Cta href={href} tone="mahogany">
        Open Security Center
      </Cta>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => `[Gradr ${(d?.severity || 'medium').toUpperCase()}] ${d?.title || 'Security alert'}`,
  displayName: 'Admin security alert',
  previewData: {
    title: 'RLS policy regression detected',
    severity: 'high',
    summary: 'A nightly scan found a public-role policy on affiliate_campaigns that allows unscoped reads.',
    detectedAt: '13 Aug 2026, 03:00 UTC',
    source: 'security-scan-cron',
    affected: 'public.affiliate_campaigns',
    actions: ['Review the failing policy', 'Re-run the scan after patching', 'Update the security baseline'],
  },
} satisfies TemplateEntry
