'use client'

/**
 * AgreementForm — shared create/edit management-agreement form
 * (plan-slice-1 §2.2 dual entry, §4.1/4.2).
 *
 * Create: property / manager / owner party pickers + dates + scope notes.
 *   The property picker lists what the API returned; because no unscoped
 *   property directory exists, a manual "property ID" override field covers
 *   cross-org proposals (manager's own list won't include the property).
 * Edit: dates + scope only (parties/property are immutable; the service
 *   enforces the same allowlist).
 */

import { useMemo, useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection, SelectOption } from '@workspace/ui/types/components'

export type AgreementFormValues = Record<string, unknown>

export interface AgreementFormProps {
  mode: 'create' | 'edit'
  propertyOptions: SelectOption[]
  managerOptions: SelectOption[]
  partyOptions: SelectOption[]
  initialValues?: AgreementFormValues | null
  saving?: boolean
  serverErrors?: Record<string, string>
  /** Fires when the effective property (select or manual ID) changes — lets
   *  the page refetch the party picker for that property's org. */
  onPropertyChange?: (propertyId: string) => void
  onSubmit: (values: AgreementFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  return String(v)
}

function isoDay(v: unknown): string {
  if (typeof v !== 'string' || !v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toISOString().slice(0, 10)
}

export function seedAgreementValues(initial?: AgreementFormValues | null): AgreementFormValues {
  return {
    propertyId: initial?.propertyId ?? '',
    propertyIdManual: initial?.propertyIdManual ?? '',
    managementOrganizationId: initial?.managementOrganizationId ?? '',
    ownerPartyId: initial?.ownerPartyId ?? '',
    startsAt: isoDay(initial?.startsAt) || isoDay(new Date()),
    endsAt: isoDay(initial?.endsAt),
    scope: str(initial?.scope ?? initial?.scopeNotes),
  }
}

function validateAgreement(v: AgreementFormValues, isEdit: boolean): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!isEdit) {
    const property = str(v.propertyIdManual).trim() || str(v.propertyId).trim()
    if (!property) errs.propertyId = 'Property is required'
    if (!str(v.managementOrganizationId).trim()) errs.managementOrganizationId = 'Manager is required'
    if (!str(v.ownerPartyId).trim()) errs.ownerPartyId = 'Owner party is required'
  }
  const starts = str(v.startsAt).trim()
  if (!starts) errs.startsAt = 'Start date is required'
  const ends = str(v.endsAt).trim()
  if (ends && starts && new Date(ends) <= new Date(starts)) {
    errs.endsAt = 'End date must be after the start date'
  }
  return errs
}

export function AgreementForm({
  mode,
  propertyOptions,
  managerOptions,
  partyOptions,
  initialValues,
  saving = false,
  serverErrors,
  onPropertyChange,
  onSubmit,
  onCancel,
}: AgreementFormProps) {
  const [values, setValues] = useState<AgreementFormValues>(() => seedAgreementValues(initialValues))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)

  const isEdit = mode === 'edit'
  const manualId = str(values.propertyIdManual).trim()

  const sections: FormSection[] = useMemo(() => {
    const propertyField = isEdit
      ? []
      : ([
          {
            name: 'propertyId',
            label: 'Property',
            type: 'select' as const,
            required: manualId ? false : true,
            colSpan: 2 as const,
            options: propertyOptions,
            helperText: 'Properties you can see in your portfolio',
          },
          {
            name: 'managementOrganizationId',
            label: 'Manager organization',
            type: 'select' as const,
            required: true,
            colSpan: 2 as const,
            options: managerOptions,
            helperText:
              managerOptions.length === 0
                ? 'No managing organizations registered yet'
                : 'Choose another organization, or yours when proposing management of your property',
          },
          {
            name: 'ownerPartyId',
            label: 'Owner party',
            type: 'select' as const,
            required: true,
            colSpan: 2 as const,
            options: partyOptions,
            helperText: 'The owner this agreement appoints a manager for',
          },
          {
            name: 'propertyIdManual',
            label: 'Or paste a property ID',
            type: 'text' as const,
            colSpan: 2 as const,
            placeholder: 'clx…',
            helperText: 'For properties outside your list — you must still have propose rights',
          },
        ] as FormSection['fields'])
    return [
      {
        id: 'parties',
        title: 'Parties',
        columns: 4,
        fields: propertyField,
      },
      {
        id: 'window',
        title: 'Term',
        description: isEdit
          ? undefined
          : 'Agreements start as drafts — the property organization approves them.',
        columns: 4,
        fields: [
          { name: 'startsAt', label: 'Start date', type: 'date', required: true, colSpan: 2 },
          { name: 'endsAt', label: 'End date (optional)', type: 'date', colSpan: 2, helperText: 'Leave blank for open-ended' },
        ],
      },
      {
        id: 'scope',
        title: 'Scope notes',
        columns: 4,
        fields: [
          {
            name: 'scope',
            label: 'What is covered?',
            type: 'textarea',
            rows: 3,
            colSpan: 'full',
            placeholder: 'Collect rent, handle maintenance up to KES 20,000, monthly owner statements…',
          },
        ],
      },
    ]
  }, [isEdit, manualId, propertyOptions, managerOptions, partyOptions])

  const handleSubmit = async (v: AgreementFormValues) => {
    const errs = validateAgreement(v, isEdit)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(`Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`)
      return
    }
    setSummary(null)
    await onSubmit(v)
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      <UniversalForm
        title={isEdit ? 'Edit agreement' : 'New management agreement'}
        description={
          isEdit
            ? 'Dates and scope only — parties cannot be changed.'
            : 'Proposes an appointment; the property organization must approve before it activates.'
        }
        mode={mode}
        variant="standard"
        sections={sections}
        values={values}
        errors={{ ...errors, ...serverErrors }}
        onChange={(name, value) => {
          setErrors((prev) => {
            if (!prev[name]) return prev
            const next = { ...prev }
            delete next[name]
            return next
          })
          setSummary(null)
          setValues((prev) => {
            const next = { ...prev, [name]: value }
            if (name === 'propertyId' || (name === 'propertyIdManual' && onPropertyChange)) {
              const effective =
                name === 'propertyIdManual'
                  ? str(value).trim() || str(next.propertyId).trim()
                  : str(next.propertyIdManual).trim() || str(value).trim()
              onPropertyChange?.(effective)
            }
            return next
          })
        }}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel={isEdit ? 'Save changes' : 'Propose agreement'}
        bare
        formClassName="w-full"
      />
    </div>
  )
}

/** Payload builder shared by the create/edit pages. */
export function toAgreementPayload(v: AgreementFormValues, isEdit: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    startsAt: v.startsAt,
    endsAt: v.endsAt ? v.endsAt : null,
    scope: { notes: str(v.scope).trim() },
  }
  if (!isEdit) {
    payload.propertyId = str(v.propertyIdManual).trim() || str(v.propertyId).trim()
    payload.managementOrganizationId = str(v.managementOrganizationId).trim()
    payload.ownerPartyId = str(v.ownerPartyId).trim()
  }
  return payload
}

/** Best-effort human read of the stored scope JSON for re-seeding. */
export function scopeToText(scope: unknown): string {
  if (typeof scope === 'string') return scope
  if (scope && typeof scope === 'object' && !Array.isArray(scope)) {
    const notes = (scope as { notes?: unknown }).notes
    return typeof notes === 'string' ? notes : JSON.stringify(scope)
  }
  return ''
}
