'use client'

/**
 * ScheduleForm — shared create/edit recurring-schedule form
 * (plan-slice-3 §4): property/unit, frequency, start/end, assignee.
 * `nextDueAt` is computed server-side from frequency + start.
 */

import { useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'
import { SCHEDULE_FREQUENCIES, SCHEDULE_KINDS } from '@/lib/domain/maintenance-constants'
import type { MemberOption } from './inspection-form'
import type { PropertyOption, UnitOption } from './ticket-form'

export type ScheduleFormValues = Record<string, unknown>

export interface ScheduleFormProps {
  mode: 'create' | 'edit'
  properties: PropertyOption[]
  units: UnitOption[]
  members: MemberOption[]
  unitsLoading?: boolean
  onPropertyChange?: (propertyId: string) => void
  initialValues?: {
    propertyId?: string
    unitId?: string | null
    title?: string
    kind?: string
    frequency?: string
    startDate?: string | null
    endDate?: string | null
    assigneeUserId?: string | null
    isActive?: boolean
  } | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: ScheduleFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function dateOnly(v: unknown): string {
  const s = str(v)
  return s ? s.slice(0, 10) : ''
}

export function seedScheduleValues(init?: ScheduleFormProps['initialValues']): ScheduleFormValues {
  return {
    propertyId: init?.propertyId ?? '',
    unitId: init?.unitId ?? '',
    title: init?.title ?? '',
    kind: init?.kind ?? 'MAINTENANCE',
    frequency: init?.frequency ?? 'MONTHLY',
    startDate: dateOnly(init?.startDate),
    endDate: dateOnly(init?.endDate),
    assigneeUserId: init?.assigneeUserId ?? '',
    isActive: init?.isActive ?? true,
  }
}

function validateSchedule(v: ScheduleFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.propertyId).trim()) errs.propertyId = 'Property is required'
  if (!str(v.title).trim()) errs.title = 'Title is required'
  if (!str(v.startDate).trim()) errs.startDate = 'Start date is required'
  const end = str(v.endDate).trim()
  const start = str(v.startDate).trim()
  if (end && start && end < start) errs.endDate = 'End date must be after the start date'
  return errs
}

export function ScheduleForm({
  mode,
  properties,
  units,
  members,
  unitsLoading = false,
  onPropertyChange,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: ScheduleFormProps) {
  const [values, setValues] = useState<ScheduleFormValues>(() => seedScheduleValues(initialValues))
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

  const handleSubmit = async (v: ScheduleFormValues) => {
    const errs = validateSchedule(v)
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
      id: 'schedule',
      title: 'Recurring job',
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
          placeholder: 'e.g. Fire extinguisher servicing',
        },
        {
          name: 'kind',
          label: 'Kind',
          type: 'select',
          colSpan: 1,
          options: SCHEDULE_KINDS,
        },
        {
          name: 'frequency',
          label: 'Frequency',
          type: 'select',
          required: true,
          colSpan: 1,
          options: SCHEDULE_FREQUENCIES,
        },
        {
          name: 'startDate',
          label: 'Start date',
          type: 'date',
          required: true,
          colSpan: 1,
        },
        {
          name: 'endDate',
          label: 'End date',
          type: 'date',
          colSpan: 1,
        },
        {
          name: 'assigneeUserId',
          label: 'Assignee',
          type: 'select',
          colSpan: 2,
          options: [
            { value: '', label: 'Unassigned' },
            ...members.map((m) => ({ value: m.userId, label: m.name })),
          ],
          helperText: 'Must be a member of your organization.',
        },
        ...(isEdit
          ? [
              {
                name: 'isActive',
                label: 'Active',
                type: 'toggle' as const,
                colSpan: 2 as const,
                helperText: 'Turn off to stop future due dates (history kept).',
              },
            ]
          : []),
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
        title={isEdit ? 'Edit schedule' : 'New recurring schedule'}
        description="The next due date is computed from the frequency and start date."
        mode={mode}
        variant="standard"
        sections={sections}
        values={values}
        errors={{ ...errors, ...serverErrors }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel={isEdit ? 'Save changes' : 'Create schedule'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
