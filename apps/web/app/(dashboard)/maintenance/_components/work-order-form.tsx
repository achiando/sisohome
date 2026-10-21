'use client'

/**
 * WorkOrderForm — shared create/edit work-order form (plan-slice-3 §4):
 * property/unit, optional ticket link, estimate + schedule.
 */

import { useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'
import { TICKET_PRIORITIES } from '@/lib/domain/maintenance-constants'
import type { PropertyOption, UnitOption } from './ticket-form'

export type WorkOrderFormValues = Record<string, unknown>

export interface TicketOption {
  id: string
  title: string
  status: string
  propertyId?: string
}

export interface WorkOrderFormProps {
  mode: 'create' | 'edit'
  properties: PropertyOption[]
  units: UnitOption[]
  tickets?: TicketOption[]
  unitsLoading?: boolean
  onPropertyChange?: (propertyId: string) => void
  initialValues?: {
    propertyId?: string
    unitId?: string | null
    ticketId?: string | null
    title?: string
    description?: string | null
    priority?: string
    scheduledFor?: string | null
    estimatedCost?: string | number | null
    currency?: string
  } | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: WorkOrderFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function dateOnly(v: unknown): string {
  const s = str(v)
  return s ? s.slice(0, 10) : ''
}

export function seedWorkOrderValues(init?: WorkOrderFormProps['initialValues']): WorkOrderFormValues {
  return {
    propertyId: init?.propertyId ?? '',
    unitId: init?.unitId ?? '',
    ticketId: init?.ticketId ?? '',
    title: init?.title ?? '',
    description: init?.description ?? '',
    priority: init?.priority ?? 'MEDIUM',
    scheduledFor: dateOnly(init?.scheduledFor),
    estimatedCost: init?.estimatedCost === null || init?.estimatedCost === undefined ? '' : String(init.estimatedCost),
    currency: init?.currency ?? 'KES',
  }
}

function validateWorkOrder(v: WorkOrderFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.propertyId).trim()) errs.propertyId = 'Property is required'
  if (!str(v.title).trim()) errs.title = 'Title is required'
  const cost = str(v.estimatedCost).trim()
  if (cost && !(Number.isFinite(Number(cost)) && Number(cost) >= 0)) {
    errs.estimatedCost = 'Estimate must be a non-negative number'
  }
  return errs
}

export function WorkOrderForm({
  mode,
  properties,
  units,
  tickets = [],
  unitsLoading = false,
  onPropertyChange,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: WorkOrderFormProps) {
  const [values, setValues] = useState<WorkOrderFormValues>(() => seedWorkOrderValues(initialValues))
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
      setValues((prev) => ({ ...prev, propertyId: value, unitId: '', ticketId: '' }))
      onPropertyChange?.(String(value))
      return
    }
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (v: WorkOrderFormValues) => {
    const errs = validateWorkOrder(v)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(`Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`)
      return
    }
    setSummary(null)
    await onSubmit(v)
  }

  // Tickets shown for linking are filtered to the chosen property (when known).
  const ticketOptions = tickets.filter((t) => !t.propertyId || !propertyId || t.propertyId === propertyId)

  const sections: FormSection[] = [
    {
      id: 'work-order',
      title: 'Work order',
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
          colSpan: 3,
          placeholder: 'e.g. Replace geyser thermostat',
        },
        {
          name: 'priority',
          label: 'Priority',
          type: 'select',
          colSpan: 1,
          options: TICKET_PRIORITIES,
        },
        ...(isEdit || ticketOptions.length === 0
          ? []
          : [
              {
                name: 'ticketId',
                label: 'Linked ticket (optional)',
                type: 'select' as const,
                colSpan: 2 as const,
                options: [
                  { value: '', label: 'Standalone job (no ticket)' },
                  ...ticketOptions.map((t) => ({ value: t.id, label: `${t.title} (${t.status.replace(/_/g, ' ').toLowerCase()})` })),
                ],
                helperText: 'Escalating a ticket? Open the ticket and use “Create work order” instead.',
              },
            ]),
        {
          name: 'scheduledFor',
          label: 'Scheduled for',
          type: 'date',
          colSpan: 1,
        },
        {
          name: 'estimatedCost',
          label: 'Estimated cost',
          type: 'number',
          colSpan: 1,
          placeholder: '0.00',
          helperText: 'Pre-authorization estimate.',
        },
        {
          name: 'description',
          label: 'Scope of work',
          type: 'textarea',
          rows: 4,
          colSpan: 'full',
          placeholder: 'What needs doing, parts, access notes…',
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
        title={isEdit ? 'Edit work order' : 'New work order'}
        description={
          isEdit
            ? 'Costs and dates stay editable until the job is completed.'
            : 'Authorize a repair job — assign it to staff or an external maintenance company.'
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
        primaryLabel={isEdit ? 'Save changes' : 'Create work order'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
