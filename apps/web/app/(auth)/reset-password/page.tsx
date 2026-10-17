import type { Metadata } from 'next'

import { NewPasswordForm } from '@workspace/auth-ui'

export const metadata: Metadata = {
  title: 'Choose a new password',
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''

  return <NewPasswordForm token={token} redirectTo="/login" />
}
