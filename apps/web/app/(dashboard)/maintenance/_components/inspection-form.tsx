'use client'

/**
 * InspectionForm — shared create/edit inspection form (plan-slice-3 §4):
 * property/unit, optional work-order link, kind, date, inspector.
 */

import { useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'
import { INSPECTION_KINDS } from '@/lib/domain/maintenance-constants'
import type { PropertyOption, UnitOption } from './ticket-form'

export type InspectionFormValues = Record<string, unknown>

export interface MemberOption {
  userId: string
  name: string
  email?: string
}

export interface WorkOrderOption {
  id: string
  title: string
  propertyId?: string
}

export interface InspectionFormProps {
  mode: 'create' | 'edit'
  properties: PropertyOption[]
  units: UnitOption[]
  members: MemberOption[]
  workOrders?: WorkOrderOption[]
  unitsLoading?: boolean
  onPropertyChange?: (propertyId: string) => void
  initialValues?: {
    propertyId?: string
    unitId?: string | null
    workOrderId?: string | null
    kind?: string
    scheduledFor?: string | null
    inspectorUserId?: string
    findings?: string | null
  } | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: InspectionFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function datetimeLocal(v: unknown): string {
  const s = str(v)
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function seedInspectionValues(init?: InspectionFormProps['initialValues']): InspectionFormValues {
  return {
    propertyId: init?.propertyId ?? '',
    unitId: init?.unitId ?? '',
    workOrderId: init?.workOrderId ?? '',
    kind: init?.kind ?? 'ROUTINE',
    scheduledFor: datetimeLocal(init?.scheduledFor),
    inspectorUserId: init?.inspectorUserId ?? '',
    findings: init?.findings ?? '',
  }
}

function validateInspection(v: InspectionFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.propertyId).trim()) errs.propertyId = 'Property is required'
  if (!str(v.inspectorUserId).trim()) errs.inspectorUserId = 'Inspector is required'
  return errs
}

export function InspectionForm({
  mode,
  properties,
  units,
  members,
  workOrders = [],
  unitsLoading = false,
  onPropertyChange,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: InspectionFormProps) {
  const [values, setValues] = useState<InspectionFormValues>(() => seedInspectionValues(initialValues))
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
      setValues((prev) => ({ ...prev, propertyId: value, unitId: '', workOrderId: '' }))
      onPropertyChange?.(String(value))
      return
    }
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (v: InspectionFormValues) => {
    const errs = validateInspection(v)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(`Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`)
      return
    }
    setSummary(null)
    await onSubmit(v)
  }

  const woOptions = workOrders.filter((w) => !w.propertyId || !propertyId || w.propertyId === propertyId)

  const sections: FormSection[] = [
    {
      id: 'inspection',
      title: 'Inspection',
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
          name: 'kind',
          label: 'Kind',
          type: 'select',
          colSpan: 1,
          disabled: isEdit,
          options: INSPECTION_KINDS,
        },
        {
          name: 'scheduledFor',
          label: 'Scheduled for',
          type: 'datetime',
          colSpan: 1,
        },
        {
          name: 'inspectorUserId',
          label: 'Inspector',
          type: 'select',
          required: true,
          colSpan: 2,
          options: [
            { value: '', label: 'Select an inspector…' },
            ...members.map((m) => ({ value: m.userId, label: m.name })),
          ],
          helperText: 'Must be a member of your organization.',
        },
        ...(isEdit || woOptions.length === 0
          ? []
          : [
              {
                name: 'workOrderId',
                label: 'Related work order (optional)',
                type: 'select' as const,
                colSpan: 'full' as const,
                options: [
                  { value: '', label: 'None' },
                  ...woOptions.map((w) => ({ value: w.id, label: w.title })),
                ],
              },
            ]),
        ...(isEdit
          ? [
              {
                name: 'findings',
                label: 'Findings',
                type: 'textarea' as const,
                rows: 4,
                colSpan: 'full' as const,
                placeholder: 'Condition notes, defects found, follow-up needed…',
                helperText: 'Required when recording a FAILED result.',
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
        title={isEdit ? 'Edit inspection' : 'Schedule inspection'}
        description={
          isEdit
            ? 'Record findings and completion from the register.'
            : 'Plan a routine, move-in/out, safety or compliance inspection.'
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
        primaryLabel={isEdit ? 'Save changes' : 'Schedule inspection'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
