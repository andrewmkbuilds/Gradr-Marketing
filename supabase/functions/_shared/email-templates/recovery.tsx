/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'

import { AuthButton, AuthEmailLayout, AuthFallbackUrl, note, text } from './layout.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <AuthEmailLayout preview={`Reset your ${siteName} password`} heading="Reset your password">
    <Text style={text}>
      We got a request to reset the password for your {siteName} account. Choose
      a new one below — the link expires shortly.
    </Text>
    <AuthButton href={confirmationUrl}>Set a new password</AuthButton>
    <AuthFallbackUrl url={confirmationUrl} />
    <Text style={note}>
      Didn&apos;t request this? Ignore this email and your password stays as it
      is.
    </Text>
  </AuthEmailLayout>
)

export default RecoveryEmail
