'use client'

/**
 * Settings → Security → Two-factor authentication
 *
 * States:
 *  1. choose  — pick the channel: authenticator app (TOTP) or emailed code.
 *  2. enrol   — TOTP: QR + manual key, then a code that proves the scan.
 *  3. email   — EMAIL: we send a 6-digit code, user returns it.
 *  4. codes   — recovery codes, shown exactly once.
 *  5. status  — enabled/not-enabled with the single relevant action.
 *  6. disable — password re-auth before protection is dropped.
 *
 * The account only becomes protected once /enable accepts a live code, so
 * abandoning enrolment at any point leaves 2FA off and locks nobody out.
 */

import { useState } from 'react'
import Image from 'next/image'
import { Copy, Mail, ShieldCheck, Smartphone } from 'lucide-react'

import { useAuth } from '@workspace/auth-ui'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { DetailSection } from '@workspace/ui/components'
import { UniversalForm } from '@workspace/ui/components/form'
import { RadioGroup, RadioGroupItem } from '@workspace/ui/components/radio-group'
import { toast } from '@workspace/ui/components/toast'
import type { FormSection } from '@workspace/ui/types/components'

type View = 'status' | 'choose' | 'enrol' | 'email' | 'codes' | 'disable'
type Method = 'TOTP' | 'EMAIL'

interface SetupTotpResponse {
  email: string
  secret: string
  otpauthUri: string
  qrDataUri: string
}

interface SetupEmailResponse {
  email: string
  expiresInMinutes: number
}

const totpCodeSection: FormSection[] = [
  {
    id: 'two-factor-code',
    title: 'Confirm setup',
    columns: 4,
    fields: [
      {
        name: 'code',
        label: '6-digit code',
        type: 'text',
        colSpan: 'full',
        required: true,
        placeholder: '123456',
        helperText:
          'Open your authenticator app, find SisoHome and enter the six digits it shows now.',
      },
    ],
  },
]

const emailCodeSection: FormSection[] = [
  {
    id: 'email-code',
    title: 'Enter the code',
    columns: 4,
    fields: [
      {
        name: 'code',
        label: '6-digit email code',
        type: 'text',
        colSpan: 'full',
        required: true,
        placeholder: '123456',
        helperText: 'It expires in 10 minutes and can be used once.',
      },
    ],
  },
]

const passwordSection: FormSection[] = [
  {
    id: 'two-factor-password',
    title: 'Confirm your password',
    columns: 4,
    fields: [
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        colSpan: 'full',
        required: true,
        placeholder: '••••••••',
        helperText: 'Turning off two-factor authentication requires your password.',
      },
    ],
  },
]

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { success?: boolean; error?: string }
  if (!res.ok || data.success === false) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}

export function TwoFactorSection() {
  const { user, refreshSession } = useAuth()

  const [view, setView] = useState<View>('status')
  const [choice, setChoice] = useState<'totp' | 'email'>('totp')
  const [setup, setSetup] = useState<SetupTotpResponse | null>(null)
  const [emailTarget, setEmailTarget] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const [codeValues, setCodeValues] = useState<Record<string, unknown>>({ code: '' })
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({})
  const [passwordValues, setPasswordValues] = useState<Record<string, unknown>>({ password: '' })
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})

  const enabled = user?.twoFactorEnabled === true
  const methodLabel =
    user?.twoFactorMethod === 'EMAIL' ? 'Email code' : 'Authenticator app (TOTP)'

  const resetCodeForm = () => {
    setCodeValues({ code: '' })
    setCodeErrors({})
  }

  const startTotpEnrol = () => {
    setBusy(true)
    resetCodeForm()

    void (async () => {
      try {
        const data = await postJson<SetupTotpResponse>('/api/auth/2fa/setup', { method: 'TOTP' })
        setSetup(data)
        setView('enrol')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not start two-factor setup')
      } finally {
        setBusy(false)
      }
    })()
  }

  const startEmailEnrol = () => {
    setBusy(true)
    resetCodeForm()

    void (async () => {
      try {
        const data = await postJson<SetupEmailResponse>('/api/auth/2fa/setup', { method: 'EMAIL' })
        setEmailTarget(data.email)
        setView('email')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not send the code')
      } finally {
        setBusy(false)
      }
    })()
  }

  const continueChoice = () => {
    if (choice === 'email') startEmailEnrol()
    else startTotpEnrol()
  }

  const handleEnable = (method: Method) => (submitValues: Record<string, unknown>) => {
    const token = String(submitValues.code ?? '').trim()
    if (!/^\d{6}$/.test(token)) {
      setCodeErrors({ code: 'Enter the 6-digit code' })
      return
    }
    setCodeErrors({})
    setBusy(true)

    void (async () => {
      try {
        const data = await postJson<{ recoveryCodes?: string[] }>('/api/auth/2fa/enable', {
          token,
          method,
        })
        setRecoveryCodes(data.recoveryCodes ?? [])
        setSetup(null)
        setEmailTarget(null)
        resetCodeForm()
        setView('codes')
        await refreshSession()
        toast.success('Two-factor authentication is on')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'That code was not accepted'
        setCodeErrors({ code: message })
        toast.error(message)
      } finally {
        setBusy(false)
      }
    })()
  }

  const handleDisableSubmit = (submitValues: Record<string, unknown>) => {
    const password = String(submitValues.password ?? '')
    if (!password) {
      setPasswordErrors({ password: 'Enter your password' })
      return
    }
    setPasswordErrors({})
    setBusy(true)

    void (async () => {
      try {
        await postJson('/api/auth/2fa/disable', { password })
        setPasswordValues({ password: '' })
        setRecoveryCodes([])
        setEmailTarget(null)
        setSetup(null)
        setView('status')
        await refreshSession()
        toast.success('Two-factor authentication is off')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not turn it off'
        setPasswordErrors({ password: message })
        toast.error(message)
      } finally {
        setBusy(false)
      }
    })()
  }

  const copyText = (text: string, label: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error('Could not copy to clipboard'))
  }

  /* ── Channel choice ─────────────────────────────────────────────────── */
  if (view === 'choose') {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">How do you want to receive codes?</h3>
          <p className="text-sm text-muted-foreground">
            Both work everywhere you sign in. You can switch later by turning 2FA off and on again.
          </p>
        </div>

        <RadioGroup
          value={choice}
          onValueChange={(value) => setChoice(value === 'email' ? 'email' : 'totp')}
          orientation="vertical"
        >
          <RadioGroupItem
            value="totp"
            label="Authenticator app (recommended)"
            description="Google Authenticator, Authy or 1Password. Works offline and is not tied to your inbox."
          />
          <RadioGroupItem
            value="email"
            label="Email code"
            description="We send a 6-digit code to your email address each time you sign in."
          />
        </RadioGroup>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setView('status')}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={continueChoice} loading={busy}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  /* ── Enrol: authenticator app ───────────────────────────────────────── */
  if (view === 'enrol' && setup) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">Scan the QR code</h3>
          <p className="text-sm text-muted-foreground">
            Open Google Authenticator, Authy or 1Password, add a new account and scan this code.
          </p>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Image
            src={setup.qrDataUri}
            alt="Two-factor authentication QR code"
            width={176}
            height={176}
            unoptimized
            className="size-44 shrink-0 rounded-xl border border-border bg-white p-2"
          />
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-muted-foreground">
              Can&apos;t scan it? Enter this key manually in your authenticator app:
            </p>
            <code className="block break-all rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
              {setup.secret}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={Copy}
                onClick={() => copyText(setup.secret, 'Setup key')}
              >
                Copy key
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setView('choose')}>
                Back
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The key signs you in on this device too — it stays private to your account.
            </p>
          </div>
        </div>

        <UniversalForm
          title="Confirm setup"
          values={codeValues}
          errors={codeErrors}
          onChange={(name, value) => {
            setCodeValues((prev) => ({ ...prev, [name]: value }))
            setCodeErrors({})
          }}
          sections={totpCodeSection}
          onSubmit={handleEnable('TOTP')}
          primaryLabel="Turn on two-factor"
          isLoading={busy}
          formClassName="max-w-lg"
        />
      </div>
    )
  }

  /* ── Enrol: email code ──────────────────────────────────────────────── */
  if (view === 'email') {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">Check your email</h3>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-foreground">{emailTarget ?? 'your address'}</span>.
            Enter it below to turn on email codes.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="size-4 shrink-0" aria-hidden="true" />
          Didn&apos;t arrive? The code is valid for 10 minutes — check spam, or go back and pick
          the authenticator app instead.
        </div>

        <UniversalForm
          title="Enter the code"
          values={codeValues}
          errors={codeErrors}
          onChange={(name, value) => {
            setCodeValues((prev) => ({ ...prev, [name]: value }))
            setCodeErrors({})
          }}
          sections={emailCodeSection}
          onSubmit={handleEnable('EMAIL')}
          primaryLabel="Turn on two-factor"
          isLoading={busy}
          onCancel={() => {
            resetCodeForm()
            setView('choose')
          }}
          formClassName="max-w-lg"
        />
      </div>
    )
  }

  /* ── Recovery codes: shown exactly once ────────────────────────────── */
  if (view === 'codes' && recoveryCodes.length > 0) {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">Save your recovery codes</h3>
          <p className="text-sm text-muted-foreground">
            Each code works once if you lose access to your authenticator app or inbox. They will
            not be shown again.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {recoveryCodes.map((code) => (
            <code
              key={code}
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-center font-mono text-sm"
            >
              {code}
            </code>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            leftIcon={Copy}
            onClick={() => copyText(recoveryCodes.join('\n'), 'Recovery codes')}
          >
            Copy all
          </Button>
          <Button type="button" variant="primary" onClick={() => setView('status')}>
            I&apos;ve saved them
          </Button>
        </div>
      </div>
    )
  }

  /* ── Disable: password re-auth ─────────────────────────────────────── */
  if (view === 'disable') {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">Turn off two-factor authentication</h3>
          <p className="text-sm text-muted-foreground">
            Your account will go back to password-only sign-in and your recovery codes are
            destroyed.
          </p>
        </div>

        <UniversalForm
          title="Confirm your password"
          values={passwordValues}
          errors={passwordErrors}
          onChange={(name, value) => {
            setPasswordValues((prev) => ({ ...prev, [name]: value }))
            setPasswordErrors({})
          }}
          sections={passwordSection}
          onSubmit={handleDisableSubmit}
          primaryLabel="Turn off"
          onCancel={() => {
            setPasswordValues({ password: '' })
            setPasswordErrors({})
            setView('status')
          }}
          isLoading={busy}
          formClassName="max-w-lg"
        />
      </div>
    )
  }

  /* ── Status ────────────────────────────────────────────────────────── */
  return (
    <DetailSection
      title="Two-factor authentication"
      description="Require a second code at sign-in — from an authenticator app or your inbox. Recovery codes work as a backup either way."
      fieldLayout="list"
      fields={[
        {
          label: 'Status',
          value: (
            <span className="inline-flex items-center gap-2">
              {enabled ? (
                <Badge variant="success" shape="pill">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="neutral" shape="pill">
                  Not enabled
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {enabled ? methodLabel : 'Password alone is enough to sign in right now.'}
              </span>
            </span>
          ),
        },
      ]}
      action={
        enabled
          ? {
              label: 'Turn off',
              icon: <Smartphone className="size-4" />,
              onClick: () => setView('disable'),
            }
          : {
              label: 'Set up',
              icon: <ShieldCheck className="size-4" />,
              onClick: () => setView('choose'),
              disabled: busy,
            }
      }
    />
  )
}
