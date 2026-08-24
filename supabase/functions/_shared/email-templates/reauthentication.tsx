/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'

import { AuthEmailLayout, codeBox, note, text } from './layout.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <AuthEmailLayout preview="Your Gradr verification code" heading="Confirm it's you">
    <Text style={text}>Enter this code to confirm your identity:</Text>
    <Text style={codeBox}>{token}</Text>
    <Text style={note}>
      The code expires shortly. If you didn&apos;t request it, you can safely
      ignore this email.
    </Text>
  </AuthEmailLayout>
)

export default ReauthenticationEmail
