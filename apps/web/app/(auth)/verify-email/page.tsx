import type { Metadata } from 'next'

import { VerifyEmailCard } from '@workspace/auth-ui'

export const metadata: Metadata = {
  title: 'Verify your email',
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; email?: string | string[] }>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''
  // Carried from login/signup so resend works in one click — no retyping.
  const email = typeof params.email === 'string' ? params.email : ''

  return <VerifyEmailCard token={token} email={email} redirectTo="/onboarding" />
}
