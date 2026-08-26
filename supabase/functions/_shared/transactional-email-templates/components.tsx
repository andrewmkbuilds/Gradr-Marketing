/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import {
  LOGO_URL,
  SITE_URL,
  SUPPORT_EMAIL,
  appLink,
  brand,
  displayStack,
  fontStack,
  link,
  marketingLink,
  Tone,
  tonePalette,
} from './theme.ts'


/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export interface LayoutProps {
  preview: string
  /** Small uppercase label above the headline, e.g. "Resume Intelligence". */
  eyebrow?: string
  headline: string
  /** Accent used by the eyebrow rule and header strip. */
  tone?: Tone
  campaign: string
  children: React.ReactNode
  /** Rendered under the body, above the footer. */
  outro?: React.ReactNode
  footerNote?: string
  /**
   * `product` footers point at the authenticated app (app.gradr.me).
   * `marketing` footers stay entirely on the public site.
   */
  audience?: 'product' | 'marketing'
}

export const EmailLayout = ({
  preview,
  eyebrow,
  headline,
  tone = 'teal',
  campaign,
  children,
  outro,
  footerNote,
  audience = 'product',
}: LayoutProps) => {

  const accent = tonePalette[tone]
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{RESPONSIVE_CSS}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.outer} className="sm-px">
          {/* Header */}
          <Section style={styles.header}>
            <Row>
              <Column style={{ width: '44px', verticalAlign: 'middle' }}>
                <Link href={link('/', campaign)}>
                  <Img
                    src={LOGO_URL}
                    width="36"
                    height="36"
                    alt="Gradr logo"
                    style={{
                      display: 'block',
                      width: '36px',
                      height: '36px',
                      maxWidth: '36px',
                      borderRadius: '9px',
                      border: '0',
                      outline: 'none',
                      textDecoration: 'none',
                    }}
                  />
                </Link>
              </Column>
              <Column style={{ verticalAlign: 'middle' }}>
                <Text style={styles.wordmark}>Gradr</Text>
              </Column>
              <Column style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                <Text style={styles.headerMeta}>AI Career Copilot</Text>
              </Column>
            </Row>
          </Section>

          {/* Card */}
          <Section style={styles.card} className="sm-p">
            <div style={{ ...styles.accentStrip, backgroundColor: accent.fg }} />
            {eyebrow ? <Text style={{ ...styles.eyebrow, color: accent.fg }}>{eyebrow}</Text> : null}
            <Heading as="h1" style={styles.h1}>
              {headline}
            </Heading>
            {children}
          </Section>

          {outro ? <Section style={styles.outro}>{outro}</Section> : null}

          {/* Footer */}
          <Section style={styles.footer}>
            <Hr style={styles.hr} />
            {footerNote ? <Text style={styles.footerNote}>{footerNote}</Text> : null}
            <Text style={styles.footerLinks}>
              {audience === 'marketing' ? (
                <>
                  <Link style={styles.footerLink} href={marketingLink('/', campaign)}>
                    Gradr
                  </Link>
                  <span style={styles.dot}>·</span>
                  <Link style={styles.footerLink} href={marketingLink('/career-advice', campaign)}>
                    Blog
                  </Link>
                </>
              ) : (
                <>
                  <Link style={styles.footerLink} href={appLink('/', campaign)}>
                    Dashboard
                  </Link>
                  <span style={styles.dot}>·</span>
                  <Link style={styles.footerLink} href={appLink('/settings', campaign)}>
                    Email preferences
                  </Link>
                </>
              )}
              <span style={styles.dot}>·</span>
              <Link style={styles.footerLink} href={`mailto:${SUPPORT_EMAIL}`}>
                Support
              </Link>
            </Text>

            <Text style={styles.footerLinks}>
              <Link style={styles.footerLinkMuted} href={link('/privacy', campaign)}>
                Privacy
              </Link>
              <span style={styles.dot}>·</span>
              <Link style={styles.footerLinkMuted} href={link('/terms', campaign)}>
                Terms
              </Link>
            </Text>
            <Text style={styles.legal}>
              Gradr — AI career copilot for resumes, jobs and interviews.
              <br />
              {SITE_URL.replace('https://', '')} · © {new Date().getFullYear()} Gradr. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/* Content primitives                                                  */
/* ------------------------------------------------------------------ */

export const Paragraph = ({ children, muted }: { children: React.ReactNode; muted?: boolean }) => (
  <Text style={muted ? styles.pMuted : styles.p}>{children}</Text>
)

export const Cta = ({
  href,
  children,
  tone = 'teal',
}: {
  href: string
  children: React.ReactNode
  tone?: 'teal' | 'mahogany'
}) => (
  <Section style={{ margin: '26px 0 6px' }}>
    <Button
      href={href}
      style={{
        ...styles.button,
        backgroundColor: tone === 'mahogany' ? brand.mahogany : brand.teal,
      }}
    >
      {children}
    </Button>
  </Section>
)

export const SecondaryLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Text style={styles.secondaryLinkWrap}>
    <Link href={href} style={styles.secondaryLink}>
      {children} →
    </Link>
  </Text>
)

export const Card = ({
  title,
  tone = 'neutral',
  children,
}: {
  title?: string
  tone?: Tone
  children: React.ReactNode
}) => {
  const t = tonePalette[tone]
  return (
    <Section
      style={{
        ...styles.innerCard,
        backgroundColor: t.bg,
        borderColor: t.border,
        borderLeft: `3px solid ${t.fg}`,
      }}
    >
      {title ? <Text style={{ ...styles.innerCardTitle, color: t.fg }}>{title}</Text> : null}
      {children}
    </Section>
  )
}

export const Badge = ({ children, tone = 'mahogany' }: { children: React.ReactNode; tone?: Tone }) => {
  const t = tonePalette[tone]
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        borderRadius: '999px',
        padding: '3px 10px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  )
}

/** Big single score block — used by resume/ATS/interview emails. */
export const ScoreBlock = ({
  score,
  label,
  caption,
  tone = 'teal',
  max = 100,
}: {
  score: number | string
  label: string
  caption?: string
  tone?: Tone
  max?: number
}) => {
  const t = tonePalette[tone]
  const numeric = typeof score === 'number' ? score : Number(score) || 0
  const pct = Math.max(0, Math.min(100, Math.round((numeric / max) * 100)))
  return (
    <Section style={{ ...styles.scoreWrap, backgroundColor: t.bg, borderColor: t.border }}>
      <Text style={{ ...styles.scoreValue, color: t.fg }}>
        {score}
        <span style={styles.scoreMax}>/{max}</span>
      </Text>
      <Text style={styles.scoreLabel}>{label}</Text>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: t.fg }} />
      </div>
      {caption ? <Text style={styles.scoreCaption}>{caption}</Text> : null}
    </Section>
  )
}

/** Compact metric row: label left, value right, optional bar. */
export const MetricRow = ({
  label,
  value,
  max = 100,
  tone = 'teal',
  showBar = true,
}: {
  label: string
  value: number | string
  max?: number
  tone?: Tone
  showBar?: boolean
}) => {
  const t = tonePalette[tone]
  const numeric = typeof value === 'number' ? value : Number(value) || 0
  const pct = Math.max(0, Math.min(100, Math.round((numeric / max) * 100)))
  return (
    <Section style={{ marginBottom: '12px' }}>
      <Row>
        <Column>
          <Text style={styles.metricLabel}>{label}</Text>
        </Column>
        <Column style={{ textAlign: 'right' }}>
          <Text style={{ ...styles.metricValue, color: t.fg }}>{value}</Text>
        </Column>
      </Row>
      {showBar ? (
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: t.fg }} />
        </div>
      ) : null}
    </Section>
  )
}

/** Key/value detail table — receipts, subscription changes, security events. */
export const DetailTable = ({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) => (
  <Section style={styles.table}>
    {rows.map((r, i) => (
      <Row key={i} style={i === rows.length - 1 ? undefined : styles.tableRow}>
        <Column style={{ verticalAlign: 'top', width: '50%' }}>
          <Text style={styles.tableLabel}>{r.label}</Text>
        </Column>
        <Column style={{ verticalAlign: 'top', textAlign: 'right' }}>
          <Text style={styles.tableValue}>{r.value}</Text>
        </Column>
      </Row>
    ))}
  </Section>
)

/** Several metrics stacked together. */
export const MetricList = ({
  items,
}: {
  items: Array<{ label: string; value: number | string; max?: number; tone?: Tone; raw?: boolean }>
}) => (
  <Section>
    {items.map((m, i) => (
      <MetricRow key={i} label={m.label} value={m.value} max={m.max} tone={m.tone} showBar={!m.raw} />
    ))}
  </Section>
)

/** Ordered priority list — Daily Briefing, career plan, next steps. */
export const PriorityList = ({
  items,
}: {
  items: Array<{
    title: string
    detail?: string
    meta?: string
    href?: string
    priority?: 'high' | 'medium' | 'low'
  }>
}) => (
  <Section style={{ marginTop: '4px' }}>
    {items.map((item, i) => (
      <Section key={i} style={styles.priorityItem}>
        <Row>
          <Column style={{ width: '34px', verticalAlign: 'top' }}>
            <div style={styles.priorityIndex}>{i + 1}</div>
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text style={styles.priorityTitle}>
              {item.href ? (
                <Link href={item.href} style={styles.priorityLink}>
                  {item.title}
                </Link>
              ) : (
                item.title
              )}
            </Text>
            {item.detail ? <Text style={styles.priorityDetail}>{item.detail}</Text> : null}
            {item.priority ? (
              <Text style={{ margin: '6px 0 0' }}>
                <Badge tone={item.priority === 'high' ? 'mahogany' : item.priority === 'medium' ? 'warning' : 'neutral'}>
                  {item.priority} priority
                </Badge>
              </Text>
            ) : null}
            {item.meta ? <Text style={styles.priorityMeta}>{item.meta}</Text> : null}
          </Column>
        </Row>
      </Section>
    ))}
  </Section>
)

export const Bullets = ({ items, tone = 'teal' }: { items: string[]; tone?: Tone }) => {
  const t = tonePalette[tone]
  return (
    <Section style={{ marginTop: '6px' }}>
      {items.map((item, i) => (
        <Row key={i} style={{ marginBottom: '6px' }}>
          <Column style={{ width: '16px', verticalAlign: 'top' }}>
            <div style={{ ...styles.bulletDot, backgroundColor: t.fg }} />
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text style={styles.bulletText}>{item}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  )
}

export const Chips = ({ items, tone = 'teal' }: { items: string[]; tone?: Tone }) => {
  const t = tonePalette[tone]
  return (
    <Text style={{ margin: '8px 0 0' }}>
      {items.map((item, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            margin: '0 6px 6px 0',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: t.bg,
            border: `1px solid ${t.border}`,
            color: t.fg,
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {item}
        </span>
      ))}
    </Text>
  )
}

/** Fallback URL line so the CTA still works when buttons are stripped. */
export const FallbackUrl = ({ href }: { href: string }) => (
  <Text style={styles.fallback}>
    Button not working? Copy this link:
    <br />
    <Link href={href} style={styles.fallbackLink}>
      {href}
    </Link>
  </Text>
)

export const greeting = (firstName?: string) => (firstName ? `Hi ${firstName},` : 'Hi there,')

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const RESPONSIVE_CSS = `
  @media only screen and (max-width: 600px) {
    .sm-px { padding-left: 12px !important; padding-right: 12px !important; }
    .sm-p { padding: 24px 20px !important; }
  }
  a { text-decoration: none; }
`

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: '#ffffff',
    margin: 0,
    padding: '0 0 32px',
    fontFamily: fontStack,
    WebkitFontSmoothing: 'antialiased',
  },
  outer: {
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '24px 16px 0',
  },
  header: {
    padding: '4px 4px 18px',
  },
  wordmark: {
    margin: 0,
    fontFamily: displayStack,
    fontSize: '19px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: brand.teal,
  },
  headerMeta: {
    margin: 0,
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: brand.muted,
  },
  card: {
    position: 'relative',
    backgroundColor: '#ffffff',
    border: `1px solid ${brand.hairline}`,
    borderRadius: '14px',
    padding: '32px 32px 30px',
    overflow: 'hidden',
  },
  accentStrip: {
    height: '3px',
    width: '52px',
    borderRadius: '999px',
    marginBottom: '18px',
  },
  eyebrow: {
    margin: '0 0 8px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  h1: {
    margin: '0 0 14px',
    fontFamily: displayStack,
    fontSize: '25px',
    lineHeight: '32px',
    fontWeight: 700,
    letterSpacing: '-0.015em',
    color: brand.ink,
  },
  p: {
    margin: '0 0 14px',
    fontSize: '15px',
    lineHeight: '24px',
    color: brand.body,
  },
  pMuted: {
    margin: '0 0 12px',
    fontSize: '13px',
    lineHeight: '21px',
    color: brand.muted,
  },
  button: {
    display: 'inline-block',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    lineHeight: '20px',
    padding: '14px 26px',
    borderRadius: '10px',
    textAlign: 'center',
    minWidth: '180px',
  },
  secondaryLinkWrap: { margin: '10px 0 0' },
  secondaryLink: {
    color: brand.mahogany,
    fontSize: '14px',
    fontWeight: 600,
  },
  innerCard: {
    borderRadius: '10px',
    borderStyle: 'solid',
    borderWidth: '1px',
    padding: '16px 18px',
    margin: '18px 0',
  },
  innerCardTitle: {
    margin: '0 0 8px',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  scoreWrap: {
    borderRadius: '12px',
    borderStyle: 'solid',
    borderWidth: '1px',
    padding: '20px 22px',
    margin: '20px 0',
    textAlign: 'center',
  },
  scoreValue: {
    margin: 0,
    fontFamily: displayStack,
    fontSize: '42px',
    lineHeight: '46px',
    fontWeight: 700,
  },
  scoreMax: { fontSize: '17px', fontWeight: 600, opacity: 0.6 },
  scoreLabel: {
    margin: '2px 0 12px',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: brand.muted,
  },
  scoreCaption: {
    margin: '12px 0 0',
    fontSize: '13px',
    lineHeight: '20px',
    color: brand.body,
  },
  barTrack: {
    height: '6px',
    width: '100%',
    borderRadius: '999px',
    backgroundColor: '#DFDCDB',
    overflow: 'hidden',
  },
  barFill: { height: '6px', borderRadius: '999px' },
  metricLabel: { margin: '0 0 6px', fontSize: '13px', fontWeight: 600, color: brand.body },
  metricValue: { margin: '0 0 6px', fontSize: '14px', fontWeight: 700 },
  table: {
    border: `1px solid ${brand.hairline}`,
    borderRadius: '10px',
    padding: '4px 16px',
    margin: '18px 0',
  },
  tableRow: { borderBottom: `1px solid ${brand.hairline}` },
  tableLabel: { margin: '10px 0', fontSize: '13px', color: brand.muted },
  tableValue: { margin: '10px 0', fontSize: '13px', fontWeight: 600, color: brand.ink },
  priorityItem: {
    borderTop: `1px solid ${brand.hairline}`,
    paddingTop: '14px',
    marginTop: '14px',
  },
  priorityIndex: {
    width: '24px',
    height: '24px',
    borderRadius: '7px',
    backgroundColor: brand.mahoganySoft,
    border: `1px solid ${brand.mahoganyBorder}`,
    color: brand.mahogany,
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: '24px',
    textAlign: 'center',
  },
  priorityTitle: { margin: 0, fontSize: '15px', fontWeight: 600, color: brand.ink, lineHeight: '22px' },
  priorityLink: { color: brand.ink },
  priorityDetail: { margin: '4px 0 0', fontSize: '13px', lineHeight: '20px', color: brand.body },
  priorityMeta: {
    margin: '6px 0 0',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: brand.mahogany,
  },
  bulletDot: { width: '6px', height: '6px', borderRadius: '999px', marginTop: '8px' },
  bulletText: { margin: 0, fontSize: '14px', lineHeight: '22px', color: brand.body },
  outro: { padding: '18px 6px 0' },
  footer: { padding: '10px 6px 0' },
  hr: { borderColor: brand.hairline, margin: '18px 0' },
  footerNote: { margin: '0 0 10px', fontSize: '12px', lineHeight: '19px', color: brand.muted },
  footerLinks: { margin: '0 0 6px', fontSize: '12px', color: brand.muted },
  footerLink: { color: brand.teal, fontWeight: 600 },
  footerLinkMuted: { color: brand.muted },
  dot: { padding: '0 8px', color: brand.coolGray },
  legal: { margin: '10px 0 0', fontSize: '11px', lineHeight: '18px', color: brand.muted },
  fallback: { margin: '16px 0 0', fontSize: '11px', lineHeight: '18px', color: brand.muted, wordBreak: 'break-all' },
  fallbackLink: { color: brand.teal },
}

export { link, appLink, marketingLink, brand }
