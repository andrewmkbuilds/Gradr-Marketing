/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'

import {
  AuthButton,
  AuthEmailLayout,
  AuthFallbackUrl,
  link,
  note,
  text,
} from './layout.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <AuthEmailLayout
    preview={`You've been invited to join ${siteName}`}
    heading="You've been invited"
  >
    <Text style={text}>
      You&apos;ve been invited to join{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      . Accept below to create your account and set a password.
    </Text>
    <AuthButton href={confirmationUrl}>Accept invitation</AuthButton>
    <AuthFallbackUrl url={confirmationUrl} />
    <Text style={note}>
      Weren&apos;t expecting this? You can safely ignore this email.
    </Text>
  </AuthEmailLayout>
)

export default InviteEmail
