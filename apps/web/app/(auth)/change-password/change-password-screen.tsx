'use client'

/**
 * Change password — forced first-login screen for admin-issued temporary
 * passwords (`mustChangePassword`), also usable for a voluntary change.
 *
 * The server enforces this too: every business API (withAuth) rejects with
 * 403 until the flag is cleared, and the app shell redirects here. On success
 * the deep link (`?next=`, carried from login) is honored, then onboarding,
 * then the dashboard.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ShieldCheck } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Input } from '@workspace/ui/components/input'
import { toast } from '@workspace/ui/components/toast'
import { useAuth, PasswordChecklist, PASSWORD_RULES } from '@workspace/auth-ui'
import { readNextParam } from '@/lib/deep-link'

export default function ChangePasswordScreen() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, needsPasswordChange, refreshSession } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Invited members (and anyone facing a policy update) must accept the
  // Terms/Privacy before this change goes through — the server enforces it.
  const consentNeeded = user?.needsConsent === true

  // Not signed in → login first, come back here after.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login?next=/change-password')
    }
  }, [isLoading, isAuthenticated, router])

  const failedRule = newPassword ? PASSWORD_RULES.find((rule) => !rule.test(newPassword)) : undefined
  // Self-clearing errors: live rule/mismatch feedback while typing, the
  // submit-time "required" message only when the field is still empty.
  const newPasswordError = newPassword ? failedRule?.message : errors.newPassword
  const confirmPasswordError =
    confirmPassword !== newPassword && (confirmPassword !== '' || !!errors.confirmPassword)
      ? 'Passwords do not match'
      : undefined

  const handleSubmit = async () => {
    const next: Record<string, string> = {}
    if (!currentPassword) next.currentPassword = 'Enter your current password'
    const unmet = PASSWORD_RULES.find((rule) => !rule.test(newPassword))
    if (unmet) next.newPassword = newPassword ? unmet.message : 'Enter a new password'
    if (confirmPassword !== newPassword) next.confirmPassword = 'Passwords do not match'
    if (consentNeeded && !acceptTerms) next.acceptTerms = 'Accept the Terms of Service and Privacy Policy to continue'
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    setErrors({})
    setFormError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword, acceptTerms: consentNeeded ? acceptTerms : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to change password')
      }

      await refreshSession()
      toast.success('Password updated')
      // next (from login) → onboarding when orgless → dashboard.
      router.push(readNextParam() || (user?.organizationId ? '/' : '/onboarding'))
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password'
      setFormError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // Brief blank while the auth state resolves or while redirecting out.
  if (isLoading || !isAuthenticated) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex min-h-40 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" aria-hidden />
          {needsPasswordChange ? 'Set a new password' : 'Change password'}
        </CardTitle>
        <CardDescription>
          {needsPasswordChange
            ? `You’re signed in with a temporary password. Choose a real one to continue${user?.email ? ` — it applies to ${user.email}` : ''}.`
            : 'Choose a new password for your account. It applies across every organization you belong to.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Input
              id="currentPassword"
              type="password"
              label="Current password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={saving}
              error={errors.currentPassword}
              showPasswordToggle
            />
          </div>

          <div className="space-y-2">
            <Input
              id="newPassword"
              type="password"
              label="New password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={saving}
              error={newPasswordError}
              showPasswordToggle
            />
            <PasswordChecklist password={newPassword} />
          </div>

          <div className="space-y-2">
            <Input
              id="confirmPassword"
              type="password"
              label="Confirm new password"
              autoComplete="new-password"
              placeholder="Repeat the new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              error={confirmPasswordError}
              showPasswordToggle
            />
          </div>

          {consentNeeded && (
            <Checkbox
              id="acceptTerms"
              checked={acceptTerms}
              onCheckedChange={(v) => setAcceptTerms(v === true)}
              disabled={saving}
              label={
                <>
                  I accept the{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Privacy Policy
                  </a>
                </>
              }
              error={errors.acceptTerms}
            />
          )}

          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <p className="text-sm text-destructive">{formError}</p>
            </div>
          )}

          <Button type="submit" className="h-11 w-full rounded-xl" loading={saving}>
            {needsPasswordChange ? 'Set password & continue' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
