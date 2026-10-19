import type { Metadata } from 'next'

import { VerifyEmailCard } from '@workspace/auth-ui'

export const metadata: Metadata = {
  title: 'Verify your email',
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''

  return <VerifyEmailCard token={token} redirectTo="/onboarding" />
}
