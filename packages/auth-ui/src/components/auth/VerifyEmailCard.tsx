'use client'

/**
 * VerifyEmailCard — everything the /verify-email page can show:
 *
 *  1. token in the URL → redeem it (verifies the address and signs in),
 *     then continue into onboarding;
 *  2. code in the URL → redeem it (verifies the address and signs in),
 *     then continue into onboarding;
 *  3. already-used link → "sign in instead";
 *  4. expired/unknown link → explain + resend form (UniversalForm);
 *  5. no token or code (opened the page cold) → "check your email" + resend form.
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
  Input,
  Loader,
  UniversalForm,
} from '@workspace/ui/components'

export interface VerifyEmailCardProps {
  /** `?token=` from the emailed link — absent on a cold visit. */
  token?: string
  /** `?code=` from the emailed link (6-digit code) — absent on a cold visit. */
  code?: string
  /**
   * 'link' (default, `/verify-email`) — cold visit says "check your email".
   * 'code' (`/verify-email-by-code`) — cold visit offers a 6-digit input so
   * the address can be proven by typing the code, with no link click.
   */
  mode?: 'link' | 'code'
  /**
   * Address carried in the URL (`?email=`) by login/signup — lets the resend
   * action fire in one click instead of asking the user to retype it.
   */
  email?: string
  redirectTo?: string
}

export default function VerifyEmailCard({ token, code, mode = 'link', email, redirectTo = '/onboarding' }: VerifyEmailCardProps) {
  const router = useRouter()
  const { verifyEmail, verifyEmailByCode, resendVerification } = useAuth()
  const isCodePage = mode === 'code'
  const knownEmail = (email ?? '').trim()

  const [phase, setPhase] = useState<'verifying' | 'done' | 'error' | 'intro' | 'code-entry' | 'code-verifying' | 'code-done' | 'code-error'>(
    token ? 'verifying' : code ? 'code-verifying' : isCodePage ? 'code-entry' : 'intro'
  )
  const [message, setMessage] = useState<string | null>(null)
  const [alreadyVerified, setAlreadyVerified] = useState(false)
  // Code the resend endpoint echoed back (outbox transport only) — shown so
  // the user can type it without opening the email.
  const [sentCode, setSentCode] = useState<string | null>(null)
  // Where to go once verified: onboarding for a fresh signup, the app when
  // the account already belongs to an organization.
  const [target, setTarget] = useState(redirectTo)
  const [values, setValues] = useState<Record<string, unknown>>({ email: knownEmail })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)
  // Controlled 6-digit input + one-click resend spinner.
  const [codeInput, setCodeInput] = useState('')
  const [resending, setResending] = useState(false)

  // StrictMode double-invokes effects — the second redeem would race the
  // first as "already used", so only ever try once per mount.
  const startedRef = useRef(false)

  useEffect(() => {
    if (!token && !code || startedRef.current) return
    startedRef.current = true

    if (token) {
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
    } else if (code) {
      verifyEmailByCode(code)
        .then((response) => {
          setTarget(response.session?.organizationId ? '/' : redirectTo)
          setPhase('code-done')
          window.setTimeout(() => router.push(response.session?.organizationId ? '/' : redirectTo), 1500)
        })
        .catch((err: unknown) => {
          setPhase('code-error')
          setAlreadyVerified(err instanceof AuthApiError && err.body.alreadyVerified === true)
          setMessage(err instanceof Error ? err.message : 'Verification failed')
        })
    }
  }, [token, code, redirectTo, router, verifyEmail, verifyEmailByCode])

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  // Shared resend: fires for the one-click button (email from the URL) and
  // for the fallback form (email typed here).
  const doResend = async (targetEmail: string) => {
    if (resending) return
    setResending(true)
    try {
      const response = await resendVerification(targetEmail)
      setSent(true)
      setSentCode(response.code ?? null)
      setMessage(null)
      setErrors({})
    } catch (err) {
      setErrors({
        email: err instanceof Error ? err.message : 'Could not send the email',
      })
    } finally {
      setResending(false)
    }
  }

  const onResend = (submitValues: Record<string, unknown>) => {
    const value = String(submitValues.email ?? '').trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setErrors({ email: 'Enter a valid email address' })
      return
    }
    void doResend(value)
  }

  const submitCode = () => {
    const value = codeInput.trim()
    if (!/^\d{6}$/.test(value)) {
      setErrors({ code: 'Enter the 6-digit code from your email' })
      return
    }
    setErrors({})
    setPhase('code-verifying')
    verifyEmailByCode(value)
      .then((response) => {
        setTarget(response.session?.organizationId ? '/' : redirectTo)
        setPhase('code-done')
        window.setTimeout(() => router.push(response.session?.organizationId ? '/' : redirectTo), 1500)
      })
      .catch((err: unknown) => {
        setPhase('code-error')
        setAlreadyVerified(err instanceof AuthApiError && err.body.alreadyVerified === true)
        setMessage(err instanceof Error ? err.message : 'Verification failed')
      })
  }

  // Plain input + button — the card header already carries the heading, so a
  // UniversalForm section title here would duplicate it.
  const codeEntryForm = (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        submitCode()
      }}
    >
      <Input
        id="verification-code"
        label="Verification code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        value={codeInput}
        onChange={(event) => {
          setCodeInput(event.target.value.replace(/\D/g, '').slice(0, 6))
          if (errors.code) {
            setErrors((prev) => {
              const next = { ...prev }
              delete next.code
              return next
            })
          }
        }}
        error={errors.code}
        disabled={phase === 'code-verifying'}
      />
      <Button type="submit" className="w-full" loading={phase === 'code-verifying'}>
        Verify
      </Button>
    </form>
  )

  const sentNotice = sent ? (
    <p className="text-sm text-emerald-600">
      {sentCode
        ? `Sent — your verification code is ${sentCode}`
        : isCodePage
          ? 'Sent — if that address still needs verifying, a new code is on its way.'
          : 'Sent — if that address still needs verifying, a new link is on its way.'}
    </p>
  ) : null

  // Email known from the URL → one-click resend. Otherwise fall back to the
  // email form (e.g. the page was opened cold).
  const resendBlock = knownEmail ? (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground">
        Didn&apos;t get it? Resend to{' '}
        <span className="font-medium text-foreground">{knownEmail}</span>
      </p>
      {errors.email && (
        <p className="text-center text-sm text-red-600">{errors.email}</p>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        loading={resending}
        onClick={() => void doResend(knownEmail)}
      >
        {sent ? 'Send again' : isCodePage ? 'Resend code' : 'Resend link'}
      </Button>
    </div>
  ) : (
    <UniversalForm
      title={isCodePage ? 'Resend verification email' : 'Resend verification link'}
      values={values}
      errors={errors}
      onChange={handleChange}
      sections={[
        {
          id: 'resend-verification',
          title: isCodePage ? 'Resend verification email' : 'Resend verification link',
          columns: 4,
          fields: [
            {
              name: 'email',
              label: 'Email',
              type: 'email',
              colSpan: 4,
              required: true,
              placeholder: 'you@example.com',
              helperText: isCodePage
                ? "We'll email a fresh code if this address still needs verifying."
                : "We'll send a fresh link if this address still needs verifying.",
            },
          ],
        },
      ]}
      primaryLabel={sent ? 'Send again' : isCodePage ? 'Send new code' : 'Send new link'}
      formClassName="max-w-md"
      onSubmit={onResend}
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

  if (phase === 'code-verifying') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verifying your email with code</CardTitle>
          <CardDescription>One moment while we confirm your code…</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader size="lg" label="Verifying" />
        </CardContent>
      </Card>
    )
  }

  if (phase === 'code-done') {
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

  if (phase === 'code-error') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Code not valid</CardTitle>
          <CardDescription>
            {message ?? 'This verification code is invalid or has expired.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sentNotice}
          {codeEntryForm}
          {resendBlock}
          <p className="text-center text-sm">
            <a href="/login" className="text-blue-600 hover:underline">
              Back to sign in
            </a>
          </p>
        </CardContent>
      </Card>
    )
  }

  if (phase === 'code-entry') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Enter verification code</CardTitle>
          <CardDescription>
            Type the 6-digit code from your verification email to confirm your address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sentNotice}
          {codeEntryForm}
          {resendBlock}
          <p className="text-center text-sm">
            <a href="/login" className="text-blue-600 hover:underline">
              Back to sign in
            </a>
          </p>
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
          {resendBlock}
          <p className="text-center text-sm">
            <a href="/login" className="text-blue-600 hover:underline">
              Back to sign in
            </a>
          </p>
        </CardContent>
      </Card>
    )
  }

  // Cold visit — no token or code in the URL (link page only; the code page
  // lands on 'code-entry' above).
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
        {sentNotice}
        {resendBlock}
        <p className="text-center text-sm">
          <a href="/login" className="text-blue-600 hover:underline">
            Back to sign in
          </a>
        </p>
      </CardContent>
    </Card>
  )
}
