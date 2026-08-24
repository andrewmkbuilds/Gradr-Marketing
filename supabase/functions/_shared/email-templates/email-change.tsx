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

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <AuthEmailLayout
    preview={`Confirm your new email for ${siteName}`}
    heading="Confirm your email change"
  >
    <Text style={text}>
      You asked to move your {siteName} account from{' '}
      <Link href={`mailto:${oldEmail}`} style={link}>
        {oldEmail}
      </Link>{' '}
      to{' '}
      <Link href={`mailto:${newEmail}`} style={link}>
        {newEmail}
      </Link>
      . Confirm below to finish the change.
    </Text>
    <AuthButton href={confirmationUrl}>Confirm email change</AuthButton>
    <AuthFallbackUrl url={confirmationUrl} />
    <Text style={note}>
      Didn&apos;t request this? Secure your account right away and contact us.
    </Text>
  </AuthEmailLayout>
)

export default EmailChangeEmail
