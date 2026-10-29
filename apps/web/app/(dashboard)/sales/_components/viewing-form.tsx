'use client'

/**
 * ViewingForm — shared create/edit viewing form (plan-slice-5 §3).
 * Edit mode adds the outcome + feedback capture (transition-checked on
 * the server).
 */

import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'
import { usePropertyOptions } from '@/app/(dashboard)/finances/_components/doc-dialogs'
import { VIEWING_FEEDBACKS, VIEWING_STATUSES } from '@/lib/domain/sales-constants'
import type { LeadRow } from './sales-types'

export type ViewingFormValues = Record<string, unknown>

export interface ViewingFormProps {
  mode: 'create' | 'edit'
  initialValues?: Record<string, unknown> | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: ViewingFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function localDatetime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function seedViewingValues(init?: Record<string, unknown> | null): ViewingFormValues {
  return {
    propertyId: str(init?.propertyId),
    leadId: str(init?.leadId),
    scheduledAt: localDatetime(init?.scheduledAt as string | undefined),
    durationMinutes: str(init?.durationMinutes),
    notes: str(init?.notes),
    status: str(init?.status) || 'SCHEDULED',
    feedback: str(init?.feedback),
  }
}

export function validateViewing(v: ViewingFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.propertyId).trim()) errs.propertyId = 'Property is required'
  if (!str(v.scheduledAt).trim()) errs.scheduledAt = 'Scheduled time is required'
  return errs
}

export function viewingPayload(v: ViewingFormValues, mode: 'create' | 'edit'): Record<string, unknown> {
  const base: Record<string, unknown> = {
    propertyId: str(v.propertyId) || null,
    leadId: str(v.leadId) || null,
    scheduledAt: str(v.scheduledAt) ? new Date(str(v.scheduledAt)).toISOString() : null,
    durationMinutes: str(v.durationMinutes).trim() ? Number(str(v.durationMinutes)) : null,
    notes: str(v.notes) || null,
  }
  if (mode === 'edit') {
    base.status = str(v.status)
    base.feedback = str(v.feedback) || null
  }
  return base
}

export function ViewingForm({
  mode,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: ViewingFormProps) {
  const properties = usePropertyOptions()
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [values, setValues] = useState<ViewingFormValues>(() => seedViewingValues(initialValues))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)

  const isEdit = mode === 'edit'

  useEffect(() => {
    let cancelled = false
    fetch('/api/leads', { credentials: 'include' })
      .then(async (res) => (res.ok ? res.json() : { leads: [] }))
      .then((data: { leads?: LeadRow[] }) => {
        if (!cancelled) setLeads(data.leads ?? [])
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

  const handleSubmit = async (v: ViewingFormValues) => {
    const errs = validateViewing(v)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(`Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`)
      return
    }
    setSummary(null)
    await onSubmit(viewingPayload(v, mode))
  }

  const fields: FormSection['fields'] = [
    {
      name: 'propertyId',
      label: 'Property',
      type: 'select',
      required: true,
      colSpan: 2,
      disabled: isEdit,
      options: [
        { value: '', label: 'Select a property…' },
        ...properties,
      ],
    },
    {
      name: 'leadId',
      label: 'Lead',
      type: 'select',
      colSpan: 2,
      options: [
        { value: '', label: 'No linked lead' },
        ...leads.map((l) => ({ value: l.id, label: `${l.displayName} · ${l.status.toLowerCase()}` })),
      ],
    },
    {
      name: 'scheduledAt',
      label: 'Scheduled for',
      type: 'datetime',
      required: true,
      colSpan: 2,
    },
    {
      name: 'durationMinutes',
      label: 'Duration (minutes)',
      type: 'number',
      colSpan: 2,
      placeholder: 'e.g. 45',
    },
  ]

  if (isEdit) {
    fields.push(
      {
        name: 'status',
        label: 'Outcome',
        type: 'select',
        colSpan: 2,
        options: VIEWING_STATUSES,
      },
      {
        name: 'feedback',
        label: 'Feedback',
        type: 'select',
        colSpan: 2,
        options: [
          { value: '', label: 'No feedback yet' },
          ...VIEWING_FEEDBACKS,
        ],
      },
    )
  }

  fields.push({
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    rows: 3,
    colSpan: 'full',
    placeholder: 'Access notes, gate code, who is attending…',
  })

  return (
    <div className="space-y-4">
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      <UniversalForm
        title={isEdit ? 'Edit viewing' : 'Schedule a viewing'}
        description={
          isEdit
            ? "Record the outcome and capture the hunter's feedback."
            : 'Book a viewing against a property in your scope.'
        }
        mode={mode}
        variant="standard"
        sections={[{ id: 'viewing', title: 'Viewing', columns: 4, fields }]}
        values={values}
        errors={{ ...errors, ...serverErrors }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel={isEdit ? 'Save changes' : 'Schedule viewing'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
