'use client'

/**
 * LeadForm — shared create/edit lead form (plan-slice-5 §3). Interest refs:
 * a listing (works for the marketing side — shared listings) and/or a
 * property in scope (landlord/PM). Contact needs a phone or an email.
 */

import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'
import { usePropertyOptions } from '@/app/(dashboard)/finances/_components/doc-dialogs'
import { CONTACT_CHANNELS, LEAD_SOURCES } from '@/lib/domain/sales-constants'
import type { ListingRow } from './sales-types'

export type LeadFormValues = Record<string, unknown>

export interface LeadFormProps {
  mode: 'create' | 'edit'
  initialValues?: Record<string, unknown> | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: LeadFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

export function seedLeadValues(init?: Record<string, unknown> | null): LeadFormValues {
  return {
    displayName: str(init?.displayName),
    phone: str(init?.phone),
    email: str(init?.email),
    preferredChannel: str(init?.preferredChannel) || 'WHATSAPP',
    source: str(init?.source) || 'OTHER',
    budgetMin: str(init?.budgetMin),
    budgetMax: str(init?.budgetMax),
    nextActionAt: init?.nextActionAt ? str(init.nextActionAt).slice(0, 10) : '',
    listingId: str(init?.listingId),
    propertyId: str(init?.propertyId),
    notes: str(init?.notes),
  }
}

export function validateLead(v: LeadFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.displayName).trim()) errs.displayName = 'Name is required'
  if (!str(v.phone).trim() && !str(v.email).trim()) {
    errs.phone = 'A lead needs a phone number or an email address'
  }
  const min = str(v.budgetMin).trim()
  const max = str(v.budgetMax).trim()
  if (min && max && Number(min) > Number(max)) {
    errs.budgetMax = 'Maximum budget must be at least the minimum'
  }
  return errs
}

export function leadPayload(v: LeadFormValues): Record<string, unknown> {
  return {
    displayName: str(v.displayName),
    phone: str(v.phone) || null,
    email: str(v.email) || null,
    preferredChannel: str(v.preferredChannel),
    source: str(v.source),
    budgetMin: str(v.budgetMin).trim() ? Number(str(v.budgetMin)) : null,
    budgetMax: str(v.budgetMax).trim() ? Number(str(v.budgetMax)) : null,
    nextActionAt: str(v.nextActionAt) ? str(v.nextActionAt) : null,
    listingId: str(v.listingId) || null,
    propertyId: str(v.propertyId) || null,
    notes: str(v.notes) || null,
  }
}

export function LeadForm({
  mode,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: LeadFormProps) {
  const properties = usePropertyOptions()
  const [listings, setListings] = useState<ListingRow[]>([])
  const [values, setValues] = useState<LeadFormValues>(() => seedLeadValues(initialValues))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)

  const isEdit = mode === 'edit'

  useEffect(() => {
    let cancelled = false
    fetch('/api/listings', { credentials: 'include' })
      .then(async (res) => (res.ok ? res.json() : { listings: [] }))
      .then((data: { listings?: ListingRow[] }) => {
        if (!cancelled) setListings(data.listings ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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

  const handleSubmit = async (v: LeadFormValues) => {
    const errs = validateLead(v)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(`Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`)
      return
    }
    setSummary(null)
    await onSubmit(leadPayload(v))
  }

  const sections: FormSection[] = [
    {
      id: 'contact',
      title: 'Contact',
      columns: 4,
      fields: [
        {
          name: 'displayName',
          label: 'Name',
          type: 'text',
          required: true,
          colSpan: 2,
          placeholder: 'e.g. Amina Hassan',
        },
        {
          name: 'source',
          label: 'Source',
          type: 'select',
          colSpan: 1,
          options: LEAD_SOURCES,
        },
        {
          name: 'preferredChannel',
          label: 'Channel',
          type: 'select',
          colSpan: 1,
          options: CONTACT_CHANNELS,
        },
        {
          name: 'phone',
          label: 'Phone',
          type: 'phone',
          colSpan: 2,
        },
        {
          name: 'email',
          label: 'Email',
          type: 'email',
          colSpan: 2,
        },
      ],
    },
    {
      id: 'interest',
      title: 'Interest & budget',
      columns: 4,
      fields: [
        {
          name: 'listingId',
          label: 'Interested listing',
          type: 'select',
          colSpan: 2,
          options: [
            { value: '', label: 'No specific listing' },
            ...listings.map((l) => ({ value: l.id, label: `${l.title} · ${l.property.name}` })),
          ],
        },
        {
          name: 'propertyId',
          label: 'Interested property',
          type: 'select',
          colSpan: 2,
          disabled: isEdit,
          options: [
            { value: '', label: 'No specific property' },
            ...properties,
          ],
          helperText: 'Optional — used when no listing applies',
        },
        {
          name: 'budgetMin',
          label: 'Budget from',
          type: 'number',
          colSpan: 1,
        },
        {
          name: 'budgetMax',
          label: 'Budget to',
          type: 'number',
          colSpan: 1,
        },
        {
          name: 'nextActionAt',
          label: 'Next action by',
          type: 'date',
          colSpan: 2,
        },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          rows: 3,
          colSpan: 'full',
          placeholder: 'Requirements, timeline, financing…',
        },
      ],
    },
  ]

  return (
    <div className="space-y-4">
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      <UniversalForm
        title={isEdit ? 'Edit lead' : 'Capture a lead'}
        description="House-hunter or buyer details. The lead stays with your organization."
        mode={mode}
        variant="standard"
        sections={sections}
        values={values}
        errors={{ ...errors, ...serverErrors }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel={isEdit ? 'Save changes' : 'Capture lead'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
