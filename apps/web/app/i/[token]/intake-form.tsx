'use client'

/**
 * IntakeForm — the public self-onboarding form behind `/i/<token>` (people
 * plan §5). Standard UniversalForm, one section, five fields. The page has
 * already resolved the token server-side (context prop); this component
 * POSTs the applicant to /api/intake/[token] and maps failures to field
 * errors / a summary / a dead-link card (410/404 mid-session).
 */

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'

import { formatDate, formatMoney } from '@/app/(dashboard)/_components/domain/format'
import type { IntakeContext } from '@/lib/domain/intake'
import { TENANT_ID_TYPES } from '@/lib/domain/tenant-constants'

import { IntakeErrorCard } from '../_components/intake-error-card'

/** Field names the server's 400 messages can start with. */
const FIELD_NAMES = ['displayName', 'phone', 'email', 'idType', 'idNumber'] as const

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Client mirror of parseIntakeInput — catch obvious issues before a round-trip. */
function validate(values: Record<string, unknown>): Record<string, string> {
  const errs: Record<string, string> = {}

  const displayName = str(values.displayName).trim()
  if (!displayName) errs.displayName = 'Full name is required'
  else if (displayName.length > 200) errs.displayName = 'Keep the name to 200 characters or fewer'

  const phone = str(values.phone).trim()
  if (!phone) errs.phone = 'Phone number is required'
  else if (phone.length > 40) errs.phone = 'Keep the number to 40 characters or fewer'
  else if (phone.replace(/\D/g, '').length < 7) errs.phone = 'That phone number looks too short'

  const email = str(values.email).trim()
  if (email.length > 254) errs.email = 'Email must be 254 characters or fewer'
  else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address'

  const idNumber = str(values.idNumber).trim()
  if (idNumber.length > 64) errs.idNumber = 'Keep the ID number to 64 characters or fewer'

  return errs
}

export interface IntakeFormProps {
  token: string
  context: IntakeContext
}

export function IntakeForm({ token, context }: IntakeFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>({
    displayName: '',
    phone: '',
    email: '',
    idType: '',
    idNumber: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{
    applicationId: string
    firstName: string
    contact: string
  } | null>(null)
  const [deadLink, setDeadLink] = useState<{ title: string; message: string } | null>(null)

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

  const handleSubmit = async (v: Record<string, unknown>) => {
    const errs = validate(v)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(
        `Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before submitting: ${labels.join(' · ')}`,
      )
      return
    }
    setSummary(null)
    setSubmitting(true)

    const displayName = str(v.displayName).trim()
    const phone = str(v.phone).trim()
    const email = str(v.email).trim()
    const idType = str(v.idType).trim()
    const idNumber = str(v.idNumber).trim()

    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          phone,
          ...(email ? { email } : {}),
          ...(idType ? { idType } : {}),
          ...(idNumber ? { idNumber } : {}),
        }),
      })
      const data: { success?: boolean; error?: string; applicationId?: string } = await res
        .json()
        .catch(() => ({}))

      if (res.ok && data.success && data.applicationId) {
        const contact = [email, phone].filter(Boolean).join(' or ')
        setSubmitted({
          applicationId: data.applicationId,
          firstName: displayName.split(' ')[0] ?? displayName,
          contact,
        })
        return
      }
      if (res.status === 410 || res.status === 404) {
        setDeadLink({
          title: 'Link unavailable',
          message:
            data.error ??
            (res.status === 410
              ? 'This link has expired. Ask your property manager for a new one.'
              : 'This intake link is invalid.'),
        })
        return
      }
      if (res.status === 429) {
        setSummary('Too many attempts from this connection. Wait a few minutes and try again.')
        return
      }
      const message = data.error ?? 'Something went wrong submitting your application.'
      const field = FIELD_NAMES.find((f) => message.startsWith(f))
      if (field) setErrors({ [field]: message })
      else setSummary(message)
    } catch {
      setSummary('We could not reach the server. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (deadLink) {
    return <IntakeErrorCard title={deadLink.title} message={deadLink.message} />
  }

  if (submitted) {
    return (
      <Card variant="outlined" className="mx-auto w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="size-9 text-primary" aria-hidden="true" />
          <CardTitle>Application received</CardTitle>
          <CardDescription>
            {submitted.firstName}, your application for {context.property.name} is in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {context.unit ? (
            <p className="text-sm text-foreground">
              {context.unit.label}
              {context.unit.rent != null
                ? ` · ${formatMoney(context.unit.rent, context.unit.currency ?? undefined)}/month`
                : ''}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            The property team will review it and contact you on {submitted.contact}.
          </p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Application reference</p>
            <p className="font-mono text-sm text-foreground break-all">{submitted.applicationId}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const parts: string[] = []
  if (context.property.locality) parts.push(context.property.locality)
  if (context.unit) {
    const rent =
      context.unit.rent != null
        ? ` · ${formatMoney(context.unit.rent, context.unit.currency ?? undefined)}/month`
        : ''
    parts.push(`${context.unit.label}${rent}`)
  }
  parts.push(`Link expires ${formatDate(context.expiresAt)}`)

  const section: FormSection = {
    id: 'applicant',
    title: 'Your details',
    description:
      'Tell the property team who you are — they will review your application and get back to you.',
    columns: 4,
    fields: [
      {
        name: 'displayName',
        label: 'Full name',
        type: 'text',
        required: true,
        colSpan: 2,
        placeholder: 'Jane Wanjiku',
      },
      {
        name: 'phone',
        label: 'Phone',
        type: 'phone',
        required: true,
        colSpan: 2,
        placeholder: '+254 7…',
      },
      {
        name: 'email',
        label: 'Email (optional)',
        type: 'email',
        colSpan: 2,
        placeholder: 'you@example.com',
      },
      {
        name: 'idType',
        label: 'ID type (optional)',
        type: 'select',
        colSpan: 1,
        options: TENANT_ID_TYPES,
        placeholder: 'Not specified',
      },
      { name: 'idNumber', label: 'ID number (optional)', type: 'text', colSpan: 1 },
    ],
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      <Card variant="outlined" className="mx-auto w-full max-w-xl">
        <CardHeader>
          <CardTitle>Apply — {context.property.name}</CardTitle>
          <CardDescription>{parts.join(' · ')}</CardDescription>
        </CardHeader>
        <CardContent>
          <UniversalForm
            title="Your details"
            mode="create"
            variant="standard"
            sections={[section]}
            values={values}
            errors={errors}
            onChange={handleChange}
            onSubmit={handleSubmit}
            isLoading={submitting}
            primaryLabel="Submit application"
            formClassName="w-full"
            bare
          />
        </CardContent>
      </Card>
    </div>
  )
}
