'use client'

/**
 * Report an issue (plan-slice-7 §3): unit required (must sit on the
 * tenant's own lease — the API enforces it), title + free-text details,
 * category/priority from the shared maintenance constants. On success →
 * back to the list; status changes happen on the org side only.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { UniversalForm } from '@workspace/ui/components/form'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import type { FormSection } from '@workspace/ui/types/components'

import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '@/lib/domain/maintenance-constants'

import { usePortalApi, type PortalLease } from '../../../_components/portal-data'

interface LeaseRes {
  success: boolean
  leases: PortalLease[]
}

/** Server 400 messages start with one of these (or "Invalid <field>"). */
const FIELD_NAMES = ['unitId', 'title', 'description'] as const

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export default function NewTicketPage() {
  const router = useRouter()
  const leaseApi = usePortalApi<LeaseRes>('/api/portal/lease')
  const [values, setValues] = useState<Record<string, unknown>>({
    unitId: '',
    title: '',
    description: '',
    category: '',
    priority: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const units =
    leaseApi.data?.leases.flatMap((lease) =>
      lease.units.map((u) => ({
        id: u.id,
        label: `${u.label} — ${lease.property.name}`,
      })),
    ) ?? []

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
    const next: Record<string, string> = {}
    const unitId = str(v.unitId)
    const title = str(v.title).trim()
    const description = str(v.description).trim()
    if (!unitId) next.unitId = 'Choose the unit where the issue is'
    if (!title) next.title = 'Describe the issue in a few words'
    else if (title.length > 200) next.title = 'Keep the title to 200 characters or fewer'
    if (description.length > 4000) next.description = 'Keep the details to 4000 characters or fewer'
    setErrors(next)
    if (Object.keys(next).length > 0) {
      const labels = Object.values(next)
      setSummary(
        `Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before submitting: ${labels.join(' · ')}`,
      )
      return
    }

    setSummary(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          unitId,
          title,
          ...(description ? { description } : {}),
          ...(str(v.category) ? { category: str(v.category) } : {}),
          ...(str(v.priority) ? { priority: str(v.priority) } : {}),
        }),
      })
      const data: { success?: boolean; error?: string } = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success('Issue reported — the property team has been notified')
        router.push('/portal/tickets')
        router.refresh()
        return
      }
      const message = data.error ?? 'Something went wrong sending your report.'
      const field =
        FIELD_NAMES.find((f) => message.startsWith(f)) ??
        (message.startsWith('Invalid category')
          ? 'category'
          : message.startsWith('Invalid priority')
            ? 'priority'
            : undefined)
      if (field) setErrors({ [field]: message })
      else setSummary(message)
    } catch {
      setSummary('We could not reach the server. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (leaseApi.loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PageLoader title="Loading your units..." />
      </div>
    )
  }
  if (leaseApi.error) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {leaseApi.error}
      </p>
    )
  }
  if (units.length === 0) {
    return (
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>No units on your lease</CardTitle>
          <CardDescription>
            Reports are tied to a unit on your lease. Contact your property team to sort out your
            tenancy details first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/portal/tickets">Back to requests</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const section: FormSection = {
    id: 'report',
    title: 'What needs fixing?',
    description:
      'Give the property team enough detail to act — where it is, what is happening, and how urgent it feels.',
    columns: 2,
    fields: [
      {
        name: 'unitId',
        label: 'Where is it?',
        type: 'select',
        required: true,
        colSpan: 2,
        options: units.map((u) => ({ value: u.id, label: u.label })),
        placeholder: 'Choose a unit',
      },
      {
        name: 'title',
        label: 'Issue',
        type: 'text',
        required: true,
        colSpan: 2,
        placeholder: 'e.g. Kitchen tap is leaking',
      },
      {
        name: 'description',
        label: 'Details',
        type: 'textarea',
        colSpan: 2,
        placeholder: 'When it started, access notes, anything the team should know…',
      },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        colSpan: 1,
        options: TICKET_CATEGORIES,
        placeholder: 'General',
      },
      {
        name: 'priority',
        label: 'Priority',
        type: 'select',
        colSpan: 1,
        options: TICKET_PRIORITIES,
        placeholder: 'Medium',
      },
    ],
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Report an issue</h1>
          <p className="text-sm text-muted-foreground">You can follow the reply thread after sending.</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portal/tickets">Cancel</Link>
        </Button>
      </div>
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>New maintenance request</CardTitle>
          <CardDescription>Status updates come from the property team.</CardDescription>
        </CardHeader>
        <CardContent>
          <UniversalForm
            title="Report an issue"
            mode="create"
            variant="standard"
            sections={[section]}
            values={values}
            errors={errors}
            onChange={handleChange}
            onSubmit={handleSubmit}
            isLoading={submitting}
            primaryLabel="Send report"
            formClassName="w-full"
            bare
          />
        </CardContent>
      </Card>
    </div>
  )
}
