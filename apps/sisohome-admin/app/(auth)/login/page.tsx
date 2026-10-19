import { LoginForm } from '@workspace/auth-ui'
import type { Metadata } from 'next'
import { sanitizeNext } from '@/lib/deep-link'

export const metadata: Metadata = {
  title: 'Sign in',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const next = sanitizeNext((await searchParams).next)
  const withNext = (path: string) =>
    next ? `${path}?next=${encodeURIComponent(next)}` : path

  return (
    <LoginForm
      redirectTo={next ?? '/'}
      // Preserve the deep link through onboarding / forced password change.
      onboardingRedirectTo={withNext('/onboarding')}
      changePasswordTo={withNext('/change-password')}
    />
  )
}
