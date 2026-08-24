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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <AuthEmailLayout
    preview={`Confirm your email to start using ${siteName}`}
    heading="Confirm your email"
  >
    <Text style={text}>
      Welcome to{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      . Confirm {recipient} and your workspace is ready — resume scoring, job
      matching and AI mock interviews in one place.
    </Text>
    <AuthButton href={confirmationUrl}>Confirm email</AuthButton>
    <AuthFallbackUrl url={confirmationUrl} />
    <Text style={note}>
      Didn&apos;t create an account? You can safely ignore this email.
    </Text>
  </AuthEmailLayout>
)

export default SignupEmail
