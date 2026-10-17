import { ResetPasswordForm } from '@workspace/auth-ui'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Forgot password',
}

export default function ForgotPasswordPage() {
  return <ResetPasswordForm redirectTo="/login" showLoginLink />
}
