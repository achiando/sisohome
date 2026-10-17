'use client'

/**
 * VerifyEmailCard — everything the /verify-email page can show:
 *
 *  1. token in the URL → redeem it (verifies the address and signs in),
 *     then continue into onboarding;
 *  2. already-used link → "sign in instead";
 *  3. expired/unknown link → explain + resend form (UniversalForm);
 *  4. no token (opened the page cold) → "check your email" + resend form.
 *
 * The resend endpoint always answers success, so the copy never confirms
 * whether an address actually has an account.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '../../context'
import { AuthApiError } from '../../lib/auth-api'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Loader,
  UniversalForm,
} from '@workspace/ui/components'
import type { FormSection } from '@workspace/ui/components'

export interface VerifyEmailCardProps {
  /** `?token=` from the emailed link — absent on a cold visit. */
  token?: string
  redirectTo?: string
}

const resendSections: FormSection[] = [
  {
    id: 'resend-verification',
    title: 'Resend verification link',
    columns: 4,
    fields: [
      {
        name: 'email',
        label: 'Email',
        type: 'email',
        colSpan: 'full',
        required: true,
        placeholder: 'you@example.com',
        helperText:
          "We'll send a fresh link if this address still needs verifying.",
      },
    ],
  },
]

export default function VerifyEmailCard({ token, redirectTo = '/onboarding' }: VerifyEmailCardProps) {
  const router = useRouter()
  const { verifyEmail, resendVerification } = useAuth()

  const [phase, setPhase] = useState<'verifying' | 'done' | 'error' | 'intro'>(
    token ? 'verifying' : 'intro'
  )
  const [message, setMessage] = useState<string | null>(null)
  const [alreadyVerified, setAlreadyVerified] = useState(false)
  // Where to go once verified: onboarding for a fresh signup, the app when
  // the account already belongs to an organization.
  const [target, setTarget] = useState(redirectTo)
  const [values, setValues] = useState<Record<string, unknown>>({ email: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)

  // StrictMode double-invokes effects — the second redeem would race the
  // first as "already used", so only ever try once per mount.
  const startedRef = useRef(false)

  useEffect(() => {
    if (!token || startedRef.current) return
    startedRef.current = true

    verifyEmail(token)
      .then((response) => {
        setTarget(response.session?.organizationId ? '/' : redirectTo)
        setPhase('done')
        window.setTimeout(() => router.push(response.session?.organizationId ? '/' : redirectTo), 1500)
      })
      .catch((err: unknown) => {
        setPhase('error')
        setAlreadyVerified(err instanceof AuthApiError && err.body.alreadyVerified === true)
        setMessage(err instanceof Error ? err.message : 'Verification failed')
      })
  }, [token, redirectTo, router, verifyEmail])

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const onResend = (submitValues: Record<string, unknown>) => {
    const email = String(submitValues.email ?? '').trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErrors({ email: 'Enter a valid email address' })
      return
    }
    setErrors({})

    void (async () => {
      try {
        await resendVerification(email)
        setSent(true)
        setMessage(null)
      } catch (err) {
        setErrors({
          email: err instanceof Error ? err.message : 'Could not send the email',
        })
      }
    })()
  }

  const resendForm = (
    <UniversalForm
      title="Resend verification link"
      values={values}
      errors={errors}
      onChange={handleChange}
      sections={resendSections}
      onSubmit={onResend}
      primaryLabel={sent ? 'Send again' : 'Send new link'}
      formClassName="max-w-md"
    />
  )

  if (phase === 'verifying') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verifying your email</CardTitle>
          <CardDescription>One moment while we confirm your address…</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader size="lg" label="Verifying" />
        </CardContent>
      </Card>
    )
  }

  if (phase === 'done') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email verified</CardTitle>
          <CardDescription>
            Your address is confirmed and you&apos;re signed in — continuing shortly…
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="primary" fullWidth onClick={() => router.push(target)}>
            Continue
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (phase === 'error' && alreadyVerified) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Already verified</CardTitle>
          <CardDescription>
            This link was already used — your address is confirmed. Sign in to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="primary" fullWidth onClick={() => router.push('/login')}>
            Sign in
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (phase === 'error') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link not valid</CardTitle>
          <CardDescription>
            {message ?? 'This verification link is invalid or has expired.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent && (
            <p className="text-sm text-emerald-600">
              Sent — if that address still needs verifying, a new link is on its way.
            </p>
          )}
          {resendForm}
          <p className="text-center text-sm">
            <a href="/login" className="text-blue-600 hover:underline">
              Back to sign in
            </a>
          </p>
        </CardContent>
      </Card>
    )
  }

  // Cold visit — no token in the URL.
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          Open the verification link we sent you to activate your account. You can resend it
          below if it didn&apos;t arrive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent && (
          <p className="text-sm text-emerald-600">
            Sent — if that address still needs verifying, a new link is on its way.
          </p>
        )}
        {resendForm}
        <p className="text-center text-sm">
          <a href="/login" className="text-blue-600 hover:underline">
            Back to sign in
          </a>
        </p>
      </CardContent>
    </Card>
  )
}
