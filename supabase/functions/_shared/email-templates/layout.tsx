/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  brand,
  displayStack,
  fontStack,
  LOGO_URL,
  SITE_URL,
  SUPPORT_EMAIL,
} from '../transactional-email-templates/theme.ts'

/**
 * Shared chrome for every Gradr auth email: logo header, white card on the
 * off-white "Yacht Club" canvas, and a support/footer block. Email clients need
 * literal hex + inline styles, so all values come from the shared theme.
 */
export function AuthEmailLayout({
  preview,
  heading,
  children,
  footer,
}: {
  preview: string
  heading: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={outer}>
          <Section style={logoRow}>
            <Link href={SITE_URL}>
              <Img src={LOGO_URL} width="36" height="36" alt="Gradr" style={logo} />
            </Link>
          </Section>

          <Section style={card}>
            <Heading style={h1}>{heading}</Heading>
            {children}
          </Section>

          <Hr style={hr} />
          <Text style={legal}>
            {footer ?? (
              <>Sent by Gradr, the AI career command center.</>
            )}
          </Text>
          <Text style={legal}>
            Questions? Reach us at{' '}
            <Link href={`mailto:${SUPPORT_EMAIL}`} style={mutedLink}>
              {SUPPORT_EMAIL}
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

/** Primary teal call-to-action, table-based so Outlook renders the fill. */
export function AuthButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={btnTable}>
      <tbody>
        <tr>
          <td style={btnCell}>
            <Link href={href} style={btnLink}>
              {children}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** Fallback line for clients that strip buttons. */
export function AuthFallbackUrl({ url }: { url: string }) {
  return (
    <Text style={fallback}>
      Or paste this link into your browser:
      <br />
      <Link href={url} style={fallbackLink}>
        {url}
      </Link>
    </Text>
  )
}

export const main = {
  backgroundColor: brand.offWhite,
  fontFamily: fontStack,
  margin: '0',
  padding: '24px 0',
}
const outer = { maxWidth: '520px', margin: '0 auto', padding: '0 16px' }
const logoRow = { padding: '0 0 16px' }
const logo = { display: 'block', borderRadius: '8px' }
const card = {
  backgroundColor: brand.white,
  border: `1px solid ${brand.hairline}`,
  borderRadius: '16px',
  padding: '28px 28px 24px',
}
const h1 = {
  fontFamily: displayStack,
  fontSize: '22px',
  lineHeight: '1.25',
  fontWeight: 'bold' as const,
  color: brand.ink,
  margin: '0 0 14px',
}
export const text = {
  fontSize: '15px',
  color: brand.body,
  lineHeight: '1.6',
  margin: '0 0 18px',
}
export const link = { color: brand.teal, textDecoration: 'underline' }
const mutedLink = { color: brand.muted, textDecoration: 'underline' }
const btnTable = { margin: '4px 0 8px' }
const btnCell = {
  backgroundColor: brand.teal,
  borderRadius: '11px',
  padding: '13px 22px',
}
const btnLink = {
  color: brand.white,
  fontSize: '15px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
}
const fallback = { fontSize: '12px', color: brand.muted, lineHeight: '1.6', margin: '16px 0 0' }
const fallbackLink = { color: brand.teal, textDecoration: 'underline', wordBreak: 'break-all' as const }
export const note = { fontSize: '13px', color: brand.muted, lineHeight: '1.6', margin: '18px 0 0' }
const hr = { borderColor: brand.hairline, margin: '20px 0 14px' }
const legal = { fontSize: '12px', color: brand.muted, lineHeight: '1.6', margin: '0 0 6px' }
export const codeBox = {
  fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
  fontSize: '26px',
  letterSpacing: '6px',
  fontWeight: 'bold' as const,
  color: brand.teal,
  backgroundColor: brand.tealSoft,
  border: `1px solid ${brand.tealBorder}`,
  borderRadius: '11px',
  padding: '14px 18px',
  textAlign: 'center' as const,
  margin: '0 0 8px',
}
