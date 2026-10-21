'use client'

/**
 * TicketForm — shared create/edit maintenance-ticket form
 * (plan-slice-3 §4). Property → unit cascading picker; the page owns
 * fetching and navigation (panel wrapper loads options).
 */

import { useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '@/lib/domain/maintenance-constants'

export type TicketFormValues = Record<string, unknown>

export interface PropertyOption {
  id: string
  name: string
}

export interface UnitOption {
  id: string
  unitRef: string
  label: string | null
  status: string
}

export interface TicketFormProps {
  mode: 'create' | 'edit'
  properties: PropertyOption[]
  units: UnitOption[]
  unitsLoading?: boolean
  onPropertyChange?: (propertyId: string) => void
  initialValues?: {
    propertyId?: string
    unitId?: string | null
    title?: string
    description?: string | null
    category?: string
    priority?: string
  } | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: TicketFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

export function seedTicketValues(init?: TicketFormProps['initialValues']): TicketFormValues {
  return {
    propertyId: init?.propertyId ?? '',
    unitId: init?.unitId ?? '',
    title: init?.title ?? '',
    description: init?.description ?? '',
    category: init?.category ?? 'GENERAL',
    priority: init?.priority ?? 'MEDIUM',
  }
}

function validateTicket(v: TicketFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.propertyId).trim()) errs.propertyId = 'Property is required'
  if (!str(v.title).trim()) errs.title = 'Title is required'
  return errs
}

export function TicketForm({
  mode,
  properties,
  units,
  unitsLoading = false,
  onPropertyChange,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: TicketFormProps) {
  const [values, setValues] = useState<TicketFormValues>(() => seedTicketValues(initialValues))
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

  const handleSubmit = async (v: TicketFormValues) => {
    const errs = validateTicket(v)
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
      id: 'ticket',
      title: 'Issue',
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
          name: 'unitId',
          label: 'Unit',
          type: 'select',
          colSpan: 2,
          disabled: isEdit || !propertyId,
          options: [
            { value: '', label: unitsLoading ? 'Loading units…' : 'Whole property' },
            ...units.map((u) => ({ value: u.id, label: `${u.label ?? u.unitRef} (${u.status.toLowerCase()})` })),
          ],
        },
        {
          name: 'title',
          label: 'Title',
          type: 'text',
          required: true,
          colSpan: 'full',
          placeholder: 'e.g. Kitchen tap leaking',
        },
        {
          name: 'category',
          label: 'Category',
          type: 'select',
          colSpan: 2,
          options: TICKET_CATEGORIES,
        },
        {
          name: 'priority',
          label: 'Priority',
          type: 'select',
          colSpan: 2,
          options: TICKET_PRIORITIES,
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 4,
          colSpan: 'full',
          placeholder: 'What is broken, where exactly, access notes…',
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
        title={isEdit ? 'Edit ticket' : 'Report an issue'}
        description={
          isEdit
            ? 'Editable while the ticket is still live (not closed or cancelled).'
            : 'Log a maintenance issue against a property or unit.'
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
        primaryLabel={isEdit ? 'Save changes' : 'Create ticket'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
