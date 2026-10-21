'use client'

/**
 * OwnerPartyForm — shared create/edit owner-party directory form
 * (plan-slice-1 §4.1). Flat per-org directory rows; page owns fetching
 * and navigation.
 */

import { useState } from 'react'
import type { PropertyOwnerParty } from '@workspace/database'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection, SelectOption } from '@workspace/ui/types/components'

export type OwnerPartyFormValues = Record<string, unknown>

export interface OwnerPartyFormProps {
  mode: 'create' | 'edit'
  initialValues?: Partial<PropertyOwnerParty> | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: OwnerPartyFormValues) => void | Promise<void>
  onCancel: () => void
}

const PARTY_TYPE_OPTIONS: SelectOption[] = [
  { value: 'PERSON', label: 'Person' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'ASSOCIATION', label: 'Association / body corporate' },
  { value: 'ORGANIZATION', label: 'Platform organization' },
]

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  return String(v)
}

export function seedOwnerPartyValues(p?: Partial<PropertyOwnerParty> | null): OwnerPartyFormValues {
  return {
    partyType: p?.partyType ?? 'PERSON',
    name: p?.name ?? '',
    email: p?.email ?? '',
    phone: p?.phone ?? '',
    kraPin: p?.kraPin ?? '',
    addressLine1: p?.addressLine1 ?? '',
    city: p?.city ?? '',
    region: p?.region ?? '',
    country: p?.country ?? 'KE',
    notes: p?.notes ?? '',
  }
}

function validateOwnerParty(v: OwnerPartyFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.partyType).trim()) errs.partyType = 'Party type is required'
  if (!str(v.name).trim()) errs.name = 'Name is required'
  const email = str(v.email).trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email address'
  return errs
}

export function OwnerPartyForm({
  mode,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: OwnerPartyFormProps) {
  const [values, setValues] = useState<OwnerPartyFormValues>(() => seedOwnerPartyValues(initialValues))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)

  const isEdit = mode === 'edit'

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

  const handleSubmit = async (v: OwnerPartyFormValues) => {
    const errs = validateOwnerParty(v)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(`Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`)
      return
    }
    setSummary(null)
    await onSubmit(v)
  }

  const sections: FormSection[] = [
    {
      id: 'identity',
      title: 'Identity',
      columns: 4,
      fields: [
        { name: 'partyType', label: 'Party type', type: 'select', required: true, colSpan: 2, options: PARTY_TYPE_OPTIONS },
        { name: 'name', label: 'Name', type: 'text', required: true, colSpan: 2, placeholder: 'Jane Wanjiku / Acacia Homes Ltd' },
        { name: 'kraPin', label: 'KRA PIN', type: 'text', colSpan: 2, placeholder: 'P000000000X' },
        { name: 'email', label: 'Email', type: 'email', colSpan: 2 },
        { name: 'phone', label: 'Phone', type: 'phone', colSpan: 2, placeholder: '+254 7…' },
      ],
    },
    {
      id: 'address',
      title: 'Address',
      columns: 4,
      fields: [
        { name: 'addressLine1', label: 'Address', type: 'text', colSpan: 2 },
        { name: 'city', label: 'City', type: 'text', colSpan: 1 },
        { name: 'region', label: 'Region / county', type: 'text', colSpan: 1 },
        { name: 'country', label: 'Country', type: 'text', colSpan: 2 },
      ],
    },
    {
      id: 'notes',
      title: 'Notes',
      columns: 4,
      fields: [
        { name: 'notes', label: 'Internal notes', type: 'textarea', rows: 3, colSpan: 'full', placeholder: 'Payment preferences, contact hours…' },
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
        title={isEdit ? 'Edit owner party' : 'Add owner party'}
        description={
          isEdit
            ? 'Directory record used by ownerships and management agreements.'
            : 'An owner, investor or body corporate your organization records ownership for.'
        }
        mode={mode}
        variant="standard"
        sections={sections}
        values={values}
        errors={{ ...errors, ...serverErrors }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel={isEdit ? 'Save changes' : 'Create owner party'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
