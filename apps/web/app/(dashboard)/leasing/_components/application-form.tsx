'use client'

/**
 * ApplicationForm — shared create/edit rental-application form
 * (plan-slice-2 §3). Property + applicant tenant + optional unit; the
 * page owns fetching and navigation.
 */

import { useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'

export type ApplicationFormValues = Record<string, unknown>

export interface PropertyOption {
  id: string
  name: string
}

export interface TenantOption {
  id: string
  displayName: string
}

export interface UnitOption {
  id: string
  unitRef: string
  label: string | null
  status: string
}

export interface ApplicationFormProps {
  mode: 'create' | 'edit'
  properties: PropertyOption[]
  tenants: TenantOption[]
  units: UnitOption[]
  unitsLoading?: boolean
  onPropertyChange?: (propertyId: string) => void
  initialValues?: {
    propertyId?: string
    unitId?: string
    applicantTenantId?: string
    internalNotes?: string | null
  } | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: ApplicationFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

export function seedApplicationValues(
  init?: ApplicationFormProps['initialValues'],
): ApplicationFormValues {
  return {
    propertyId: init?.propertyId ?? '',
    unitId: init?.unitId ?? '',
    applicantTenantId: init?.applicantTenantId ?? '',
    internalNotes: init?.internalNotes ?? '',
  }
}

function validateApplication(
  v: ApplicationFormValues,
  opts: { requireUnit?: boolean } = {},
): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.propertyId).trim()) errs.propertyId = 'Property is required'
  if (!str(v.applicantTenantId).trim()) errs.applicantTenantId = 'Applicant tenant is required'
  if (opts.requireUnit && !str(v.unitId).trim()) errs.unitId = 'Unit is required'
  return errs
}

export function ApplicationForm({
  mode,
  properties,
  tenants,
  units,
  unitsLoading = false,
  onPropertyChange,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: ApplicationFormProps) {
  const [values, setValues] = useState<ApplicationFormValues>(() => seedApplicationValues(initialValues))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)

  const isEdit = mode === 'edit'
  const propertyId = str(values.propertyId)

  const handleChange = (name: string, value: unknown) => {
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setSummary(null)
    if (name === 'propertyId') {
      setValues((prev) => ({ ...prev, propertyId: value, unitId: '' }))
      onPropertyChange?.(String(value))
      return
    }
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (v: ApplicationFormValues) => {
    const errs = validateApplication(v)
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
      id: 'application',
      title: 'Application',
      columns: 4,
      fields: [
        {
          name: 'propertyId',
          label: 'Property',
          type: 'select',
          required: true,
          colSpan: 2,
          disabled: isEdit,
          options: [
            { value: '', label: 'Select a property…' },
            ...properties.map((p) => ({ value: p.id, label: p.name })),
          ],
        },
        {
          name: 'applicantTenantId',
          label: 'Applicant',
          type: 'select',
          required: true,
          colSpan: 2,
          disabled: isEdit,
          options: [
            { value: '', label: 'Select a tenant…' },
            ...tenants.map((t) => ({ value: t.id, label: t.displayName })),
          ],
          helperText: isEdit ? undefined : 'Add the tenant first if they are new (two-step capture).',
        },
        {
          name: 'unitId',
          label: 'Unit',
          type: 'select',
          colSpan: 2,
          disabled: isEdit || !propertyId,
          options: [
            { value: '', label: unitsLoading ? 'Loading units…' : 'Whole property / any unit' },
            ...units.map((u) => ({
              value: u.id,
              label: `${u.label ?? u.unitRef} (${u.status.toLowerCase()})`,
            })),
          ],
        },
        {
          name: 'internalNotes',
          label: 'Internal screening notes',
          type: 'textarea',
          rows: 3,
          colSpan: 'full',
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
        title={isEdit ? 'Edit application' : 'Capture application'}
        description={
          isEdit
            ? 'Editable until a decision is recorded.'
            : 'Record an applicant against a property — screening follows.'
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
        primaryLabel={isEdit ? 'Save changes' : 'Create application'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
