import { SignUpForm } from '@workspace/auth-ui'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create account',
}

export default function SignUpPage() {
  return <SignUpForm redirectTo="/onboarding" showLoginLink />
}
