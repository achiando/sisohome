'use client'

/**
 * Settings → Profile
 *
 * Read-only by default: the account details are displayed and editing is an
 * explicit action that swaps in the UniversalForm-based ProfileForm.
 *
 * The email is the account identity — it is rendered with a lock, never
 * rendered as a field, and is refused by the profile update endpoint.
 *
 * The Security card covers password, phone number, two-factor authentication
 * status and (future) linked third-party accounts.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Lock, Pencil, Phone, ShieldCheck } from 'lucide-react'

import { ProfileForm, profileSchema, useAuth } from '@workspace/auth-ui'
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { DetailSection, FieldItem } from '@workspace/ui/components'
import { UniversalForm } from '@workspace/ui/components/form'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { toast } from '@workspace/ui/components/toast'
import type { FormSection } from '@workspace/ui/types/components'

const PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'apple', label: 'Apple' },
  { id: 'microsoft', label: 'Microsoft' },
  { id: 'github', label: 'GitHub' },
] as const

const phoneSections: FormSection[] = [
  {
    id: 'phone',
    title: 'Phone number',
    columns: 4,
    fields: [
      {
        name: 'phone',
        label: 'Phone number',
        type: 'phone',
        colSpan: 'full',
        placeholder: '+254 712 345 678',
        helperText: 'Include your country code. Leave empty to remove it.',
      },
    ],
  },
]

export function ProfileSettings() {
  const router = useRouter()
  const { user, updateProfile, isLoading } = useAuth()

  const [editingProfile, setEditingProfile] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneValues, setPhoneValues] = useState<Record<string, unknown>>({ phone: '' })
  const [phoneErrors, setPhoneErrors] = useState<Record<string, string>>({})
  const [savingPhone, setSavingPhone] = useState(false)

  const startPhoneEdit = () => {
    setPhoneValues({ phone: user?.phone ?? '' })
    setPhoneErrors({})
    setEditingPhone(true)
  }

  const handlePhoneChange = (name: string, value: unknown) => {
    setPhoneValues((prev) => ({ ...prev, [name]: value }))
    setPhoneErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const handlePhoneSubmit = (submitValues: Record<string, unknown>) => {
    const parsed = profileSchema.safeParse(submitValues)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '')
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setPhoneErrors(fieldErrors)
      return
    }
    setPhoneErrors({})

    void (async () => {
      setSavingPhone(true)
      try {
        await updateProfile({ phone: parsed.data.phone ?? '' })
        toast.success(parsed.data.phone ? 'Phone number saved' : 'Phone number removed')
        setEditingPhone(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save phone number'
        setPhoneErrors({ phone: message })
        toast.error(message)
      } finally {
        setSavingPhone(false)
      }
    })()
  }

  if (isLoading || !user) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-11 w-40 rounded-xl" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Your name and picture as they appear across every workspace you belong to.
            </CardDescription>
          </div>
          {!editingProfile && (
            <CardAction>
              <Button
                variant="outline"
                leftIcon={Pencil}
                onClick={() => setEditingProfile(true)}
              >
                Edit
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {editingProfile ? (
            <ProfileForm
              onCancel={() => setEditingProfile(false)}
              onSuccess={() => setEditingProfile(false)}
            />
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <FieldItem label="Name" value={user.name || '—'} />
              <FieldItem
                label="Email"
                value={
                  <span className="inline-flex items-center gap-1.5 break-all">
                    {user.email}
                    <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </span>
                }
                metadata="Account identity — this is what you sign in with and it never changes."
              />
              <FieldItem
                label="Profile picture"
                value={
                  user.avatar ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarImage src={user.avatar} alt="" />
                        <AvatarFallback>
                          {user.name?.charAt(0)?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <a
                        href={user.avatar}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        View image
                      </a>
                    </span>
                  ) : (
                    'Not set'
                  )
                }
              />
            </dl>
          )}
        </CardContent>
      </Card>

      {/* ── Security ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Security</CardTitle>
            <CardDescription>
              Password, contact number, two-factor authentication and linked sign-in providers.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Password */}
          <DetailSection
            title="Password"
            description="The password you sign in with. Use a unique one you don't reuse elsewhere."
            fieldLayout="list"
            fields={[
              {
                label: 'Status',
                value: user.mustChangePassword ? (
                  <Badge variant="warning" shape="pill">
                    Temporary — must be changed
                  </Badge>
                ) : (
                  <Badge variant="success" shape="pill">
                    Set
                  </Badge>
                ),
              },
            ]}
            action={{
              label: 'Change password',
              icon: <KeyRound className="size-4" />,
              onClick: () => router.push('/change-password'),
            }}
          />

          {/* Phone number */}
          {editingPhone ? (
            <UniversalForm
              title="Phone number"
              values={phoneValues}
              errors={phoneErrors}
              onChange={handlePhoneChange}
              sections={phoneSections}
              onSubmit={handlePhoneSubmit}
              onCancel={() => setEditingPhone(false)}
              primaryLabel="Save number"
              isLoading={savingPhone}
              formClassName="max-w-lg"
            />
          ) : (
            <DetailSection
              title="Phone number"
              description="Your contact number, and later the SMS channel for two-factor codes."
              fieldLayout="list"
              fields={[
                {
                  label: 'Number',
                  value: user.phone ?? (
                    <span className="text-muted-foreground/60 italic">Not added</span>
                  ),
                },
              ]}
              action={{
                label: user.phone ? 'Edit' : 'Add',
                icon: <Phone className="size-4" />,
                onClick: startPhoneEdit,
              }}
            />
          )}

          {/* Two-factor authentication */}
          <DetailSection
            title="Two-factor authentication"
            description="Require a second code at sign-in. Works with Google Authenticator, Authy, 1Password and any other authenticator app."
            fieldLayout="list"
            fields={[
              {
                label: 'Status',
                value: (
                  <span className="inline-flex items-center gap-2">
                    <Badge variant="neutral" shape="pill">
                      Not enabled
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Setup arrives with the full enrolment flow.
                    </span>
                  </span>
                ),
              },
            ]}
          />

          {/* Linked third-party accounts */}
          <DetailSection
            title="Linked accounts"
            description="Sign in with a third-party provider instead of a password. Each link is independent and can be removed later."
            fieldLayout="list"
            fields={[
              {
                label: 'Providers',
                value: (
                  <span className="flex flex-wrap gap-1.5">
                    {PROVIDERS.map((provider) => (
                      <Badge key={provider.id} variant="outline" shape="pill">
                        {provider.label} · not linked
                      </Badge>
                    ))}
                  </span>
                ),
              },
            ]}
          />

          <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Your session is cookie-based and scoped to one active workspace at a time. Signing
              out everywhere is available from the account menu.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
