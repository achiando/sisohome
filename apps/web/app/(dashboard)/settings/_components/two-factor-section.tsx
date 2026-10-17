'use client'

/**
 * Settings → Security → Two-factor authentication
 *
 * Three states in one section:
 *  1. status — not enabled / enabled, with the single relevant action.
 *  2. enrol  — QR + manual key, then a UniversalForm code step that proves the
 *              scan; recovery codes are handed back exactly once.
 *  3. disable — password re-auth before protection is dropped.
 *
 * The account only becomes protected once /enable accepts a live code, so
 * abandoning enrolment at any point leaves 2FA off and locks nobody out.
 */

import { useState } from 'react'
import Image from 'next/image'
import { Copy, ShieldCheck, Smartphone } from 'lucide-react'

import { useAuth } from '@workspace/auth-ui'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { DetailSection } from '@workspace/ui/components'
import { UniversalForm } from '@workspace/ui/components/form'
import { toast } from '@workspace/ui/components/toast'
import type { FormSection } from '@workspace/ui/types/components'

type View = 'status' | 'enrol' | 'codes' | 'disable'

interface SetupPayload {
  email: string
  secret: string
  otpauthUri: string
  qrDataUri: string
}

const codeSection: FormSection[] = [
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

export function TwoFactorSection() {
  const { user, refreshSession } = useAuth()

  const [view, setView] = useState<View>('status')
  const [setup, setSetup] = useState<SetupPayload | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const [codeValues, setCodeValues] = useState<Record<string, unknown>>({ code: '' })
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({})
  const [passwordValues, setPasswordValues] = useState<Record<string, unknown>>({ password: '' })
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})

  const enabled = user?.twoFactorEnabled === true

  const clearErrors = (setter: (fn: (prev: Record<string, string>) => Record<string, string>) => void) =>
    setter((prev) => {
      if (!Object.keys(prev).length) return prev
      return {}
    })

  const change =
    (setter: (fn: (prev: Record<string, unknown>) => Record<string, unknown>) => void) =>
    (name: string, value: unknown) => {
      setter((prev) => ({ ...prev, [name]: value }))
    }

  const startEnrol = () => {
    setBusy(true)
    setCodeErrors({})
    setCodeValues({ code: '' })

    void (async () => {
      try {
        const res = await fetch('/api/auth/2fa/setup', {
          method: 'POST',
          credentials: 'same-origin',
        })
        const data = (await res.json()) as SetupPayload & { success: boolean; error?: string }
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Could not start two-factor setup')
        }
        setSetup(data)
        setView('enrol')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not start two-factor setup')
      } finally {
        setBusy(false)
      }
    })()
  }

  const handleCodeSubmit = (submitValues: Record<string, unknown>) => {
    const token = String(submitValues.code ?? '').trim()
    if (!/^\d{6}$/.test(token)) {
      setCodeErrors({ code: 'Enter the 6-digit code' })
      return
    }
    setCodeErrors({})
    setBusy(true)

    void (async () => {
      try {
        const res = await fetch('/api/auth/2fa/enable', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = (await res.json()) as {
          success: boolean
          error?: string
          recoveryCodes?: string[]
        }
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'That code was not accepted')
        }
        setRecoveryCodes(data.recoveryCodes ?? [])
        setSetup(null)
        setCodeValues({ code: '' })
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
        const res = await fetch('/api/auth/2fa/disable', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        })
        const data = (await res.json()) as { success: boolean; error?: string }
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Could not turn off two-factor authentication')
        }
        setPasswordValues({ password: '' })
        setRecoveryCodes([])
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

  /* ── Enrol: scan the QR, then prove it ─────────────────────────────── */
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setView('status')}
              >
                Cancel
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
            change(setCodeValues)(name, value)
            clearErrors(setCodeErrors)
          }}
          sections={codeSection}
          onSubmit={handleCodeSubmit}
          primaryLabel="Turn on two-factor"
          isLoading={busy}
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
            Each code works once if you lose access to your authenticator app. They will not be
            shown again.
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
            change(setPasswordValues)(name, value)
            clearErrors(setPasswordErrors)
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
      description="Require a second code at sign-in. Works with Google Authenticator, Authy, 1Password and any other authenticator app."
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
                {enabled
                  ? 'Authenticator app (TOTP)'
                  : 'Password alone is enough to sign in right now.'}
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
              onClick: startEnrol,
              disabled: busy,
            }
      }
    />
  )
}
