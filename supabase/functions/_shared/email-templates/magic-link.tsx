/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'

import { AuthButton, AuthEmailLayout, AuthFallbackUrl, note, text } from './layout.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <AuthEmailLayout preview={`Your sign-in link for ${siteName}`} heading="Your sign-in link">
    <Text style={text}>
      Tap the button below to sign in to {siteName}. The link works once and
      expires shortly.
    </Text>
    <AuthButton href={confirmationUrl}>Sign in</AuthButton>
    <AuthFallbackUrl url={confirmationUrl} />
    <Text style={note}>
      Didn&apos;t ask for this link? You can safely ignore this email.
    </Text>
  </AuthEmailLayout>
)

export default MagicLinkEmail
