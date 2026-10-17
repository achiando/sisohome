'use client'

/**
 * NewPasswordForm — the landing step of the emailed reset link.
 *
 * The link (single-use token in the query string) is the proof of ownership,
 * so this form only asks for the new password twice and posts the token along
 * with it. Built on UniversalForm like every other form in the system.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, UniversalForm } from '@workspace/ui/components'
import type { FormSection } from '@workspace/ui/components'

import { useAuth } from '../../context'
import { newPasswordSchema } from '../../lib/validators'

export interface NewPasswordFormProps {
  /** Reset token from `?token=` — empty/absent renders the invalid-link card. */
  token: string
  redirectTo?: string
}

const passwordSections: FormSection[] = [
  {
    id: 'new-password',
    title: 'Choose a new password',
    columns: 4,
    fields: [
      {
        name: 'password',
        label: 'New password',
        type: 'password',
        colSpan: 'full',
        required: true,
        placeholder: '••••••••',
        helperText:
          'At least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.',
      },
      {
        name: 'confirmPassword',
        label: 'Confirm new password',
        type: 'password',
        colSpan: 'full',
        required: true,
        placeholder: '••••••••',
      },
    ],
  },
]

export default function NewPasswordForm({ token, redirectTo = '/login' }: NewPasswordFormProps) {
  const router = useRouter()
  const { newPassword, isLoading } = useAuth()

  const [values, setValues] = useState<Record<string, unknown>>({
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const onSubmit = (submitValues: Record<string, unknown>) => {
    const parsed = newPasswordSchema.safeParse(submitValues)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '')
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})

    void (async () => {
      try {
        await newPassword(token, parsed.data.password)
        setDone(true)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Password could not be changed'
        setErrors({ password: message })
      }
    })()
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invalid link</CardTitle>
          <CardDescription>
            This password reset link is incomplete. Request a new one from the sign-in page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="primary" fullWidth onClick={() => router.push('/forgot-password')}>
            Request a new link
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (done) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Password changed</CardTitle>
          <CardDescription>
            Your password has been updated. Sign in with the new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="primary" fullWidth onClick={() => router.push(redirectTo)}>
            Sign in
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          This link can be used once. After saving, you will sign in with the new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UniversalForm
          title="Choose a new password"
          values={values}
          errors={errors}
          onChange={handleChange}
          sections={passwordSections}
          onSubmit={onSubmit}
          primaryLabel="Save password"
          isLoading={isLoading}
        />
      </CardContent>
    </Card>
  )
}
