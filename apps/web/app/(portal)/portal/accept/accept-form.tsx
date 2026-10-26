'use client'

/**
 * AcceptForm — invite-redemption UI for `/portal/accept` (plan-slice-7 §3).
 * Modes come from the server-resolved context: `new` (set a password),
 * `existing` (signed-in-as-the-invited-user confirm), `switch` (a different
 * account is signed in — offer sign-out, never swap sessions silently),
 * plus dead-link cards for `expired`/`used`. Maps API failures exactly like
 * IntakeForm: field errors → summary → dead link → 429 → 403/needsLogout.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Link2Off, LogOut } from 'lucide-react'

import { newPasswordSchema } from '@workspace/auth-ui/lib'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'

import { formatDate } from '@/app/(dashboard)/_components/domain/format'

import { portalSignOut } from '../../_components/portal-data'

/** Server 400 messages for this route start with one of these. */
const FIELD_NAMES = ['password'] as const

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export type AcceptMode = 'new' | 'existing' | 'switch' | 'expired' | 'used' | 'login'

/** Resolved invite context handed down from the server page. */
export interface AcceptContext {
  mode: Exclude<AcceptMode, 'login'>
  email: string
  tenantName: string
  expiresAt: Date
  organizationName: string | null
}

export interface AcceptFormProps {
  token: string
  context: AcceptContext
}

type View =
  | { kind: 'form' }
  | { kind: 'dead'; title: string; message: string }
  | { kind: 'logout' }
  | { kind: 'done' }

export function AcceptForm({ token, context }: AcceptFormProps) {
  const router = useRouter()
  const [view, setView] = useState<View>(
    context.mode === 'expired'
      ? {
          kind: 'dead',
          title: 'Invitation expired',
          message:
            'This invitation is no longer valid. Ask your property manager to send a fresh invite.',
        }
      : context.mode === 'used'
        ? {
            kind: 'dead',
            title: 'Invitation already used',
            message:
              'This invitation has already been redeemed. Sign in instead — or ask for a new invite if this was a mistake.',
          }
        : { kind: 'form' },
  )
  const [values, setValues] = useState<Record<string, unknown>>({
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (name: string, value: unknown) => {
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setSummary(null)
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/portal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...payload }),
    }).catch(() => null)

    if (!res) {
      setSummary('We could not reach the server. Check your connection and try again.')
      return false
    }

    const data: {
      success?: boolean
      error?: string
      redirectTo?: string
      needsLogout?: boolean
      alreadyUsed?: boolean
    } = await res.json().catch(() => ({}))

    if (res.ok && data.success) {
      setView({ kind: 'done' })
      router.push('/portal')
      router.refresh()
      return true
    }
    if (res.status === 403 && data.redirectTo) {
      // An account exists but nobody is signed in as it → login first.
      window.location.assign(data.redirectTo)
      return false
    }
    if (res.status === 409 && (data.needsLogout || data.alreadyUsed)) {
      if (data.alreadyUsed) {
        setView({
          kind: 'dead',
          title: 'Invitation already used',
          message: 'This invitation has already been redeemed. Sign in to your portal instead.',
        })
        return false
      }
      setView({ kind: 'logout' })
      return false
    }
    if (res.status === 404 || res.status === 410) {
      setView({
        kind: 'dead',
        title: 'Link unavailable',
        message:
          data.error ??
          (res.status === 410
            ? 'This link has expired. Ask your property manager for a new one.'
            : 'This portal invitation is invalid.'),
      })
      return false
    }
    if (res.status === 429) {
      setSummary('Too many attempts from this connection. Wait a few minutes and try again.')
      return false
    }
    const message = data.error ?? 'Something went wrong accepting your invitation.'
    const field = FIELD_NAMES.find((f) => message.startsWith(f))
    if (field) setErrors({ [field]: message })
    else setSummary(message)
    return false
  }

  const handleSetPassword = async (v: Record<string, unknown>) => {
    const parsed = newPasswordSchema.safeParse({
      password: str(v.password),
      confirmPassword: str(v.confirmPassword),
    })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !next[key]) next[key] = issue.message
      }
      setErrors(next)
      const labels = Object.values(next)
      setSummary(
        `Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before continuing: ${labels.join(' · ')}`,
      )
      return
    }
    setSummary(null)
    setSubmitting(true)
    try {
      await post({ password: parsed.data.password })
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirm = async () => {
    setSummary(null)
    setSubmitting(true)
    try {
      await post({})
    } finally {
      setSubmitting(false)
    }
  }

  if (view.kind === 'dead') {
    return (
      <Card variant="outlined">
        <CardHeader className="items-center text-center">
          <Link2Off className="size-9 text-muted-foreground" aria-hidden="true" />
          <CardTitle>{view.title}</CardTitle>
          <CardDescription>{view.message}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button variant="outline" onClick={() => window.location.assign('/login')}>
            Go to sign in
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (view.kind === 'logout') {
    return (
      <Card variant="outlined">
        <CardHeader className="items-center text-center">
          <LogOut className="size-9 text-muted-foreground" aria-hidden="true" />
          <CardTitle>Sign out to continue</CardTitle>
          <CardDescription>
            You are signed in as a different account. Sign out, then open this invitation again —
            we will walk you through the rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button variant="primary" onClick={portalSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (view.kind === 'done') {
    return (
      <Card variant="outlined">
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="size-9 text-primary" aria-hidden="true" />
          <CardTitle>You&apos;re in</CardTitle>
          <CardDescription>Opening your portal…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const headingParts = [context.tenantName]
  if (context.organizationName) headingParts.push(context.organizationName)
  const expires = `Expires ${formatDate(context.expiresAt)}`

  if (context.mode === 'switch') {
    return (
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Accept your portal invitation</CardTitle>
          <CardDescription>
            {headingParts.join(' · ')} — you are signed in as a different account right now.
            Sign out first, then accept as {context.email}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button variant="primary" onClick={portalSignOut}>
            Sign out and continue
          </Button>
          <p className="text-xs text-muted-foreground">{expires}</p>
        </CardContent>
      </Card>
    )
  }

  if (context.mode === 'existing') {
    return (
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Accept your portal invitation</CardTitle>
          <CardDescription>
            {headingParts.join(' · ')} — accepting as {context.email}. You&apos;ll get your lease,
            statement, documents and maintenance requests in one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {summary ? (
            <Alert variant="destructive">
              <AlertDescription>{summary}</AlertDescription>
            </Alert>
          ) : null}
          <Button variant="primary" onClick={handleConfirm} loading={submitting}>
            Enter the portal
          </Button>
          <p className="text-xs text-muted-foreground">{expires}</p>
        </CardContent>
      </Card>
    )
  }

  // context.mode === 'new' — set a password to create the account.
  const section: FormSection = {
    id: 'credentials',
    title: 'Set your password',
    description: 'Pick a strong password — you will use it every time you sign in.',
    columns: 2,
    fields: [
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        required: true,
        colSpan: 1,
        placeholder: 'At least 8 characters',
      },
      {
        name: 'confirmPassword',
        label: 'Confirm password',
        type: 'password',
        required: true,
        colSpan: 1,
        placeholder: 'Repeat it',
      },
    ],
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Welcome to your portal</CardTitle>
          <CardDescription>
            {headingParts.join(' · ')} — one account for {context.email}. {expires}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UniversalForm
            title="Set your password"
            mode="create"
            variant="standard"
            sections={[section]}
            values={values}
            errors={errors}
            onChange={handleChange}
            onSubmit={handleSetPassword}
            isLoading={submitting}
            primaryLabel="Create account & enter portal"
            formClassName="w-full"
            bare
          />
        </CardContent>
      </Card>
    </div>
  )
}
