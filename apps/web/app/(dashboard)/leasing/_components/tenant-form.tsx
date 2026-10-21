'use client'

/**
 * TenantForm — shared create/edit tenant wizard (plan-slice-2 §3).
 * Steps: identity → contact → employment → guarantor.
 */

import { useState } from 'react'
import type { Tenant } from '@workspace/database'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection, WizardStep } from '@workspace/ui/types/components'
import {
  CONTACT_CHANNELS,
  TENANT_ID_TYPES,
  TENANT_PARTY_TYPES,
  TENANT_STATUSES,
} from '@/lib/domain/tenant-constants'

export type TenantFormValues = Record<string, unknown>

export interface TenantFormProps {
  mode: 'create' | 'edit'
  initialValues?: Partial<Tenant> | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: TenantFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

function toIsoDate(v: unknown): string {
  if (!v) return ''
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

export function seedTenantValues(t?: Partial<Tenant> | null): TenantFormValues {
  return {
    partyType: t?.partyType ?? 'PERSON',
    status: t?.status ?? 'PROSPECT',
    displayName: t?.displayName ?? '',
    tenantRef: t?.tenantRef ?? '',
    idType: t?.idType ?? '',
    idNumber: t?.idNumber ?? '',
    nationality: t?.nationality ?? 'Kenyan',
    kraPin: t?.kraPin ?? '',
    dateOfBirth: toIsoDate(t?.dateOfBirth),
    email: t?.email ?? '',
    phone: t?.phone ?? '',
    altPhone: t?.altPhone ?? '',
    preferredChannel: t?.preferredChannel ?? 'WHATSAPP',
    addressLine1: t?.addressLine1 ?? '',
    addressLine2: t?.addressLine2 ?? '',
    city: t?.city ?? '',
    postalAddress: t?.postalAddress ?? '',
    emergencyContactName: t?.emergencyContactName ?? '',
    emergencyContactRelationship: t?.emergencyContactRelationship ?? '',
    emergencyContactPhone: t?.emergencyContactPhone ?? '',
    employer: t?.employer ?? '',
    jobTitle: t?.jobTitle ?? '',
    incomeVerified: Boolean(t?.incomeVerified),
    bankReference: t?.bankReference ?? '',
    guarantorName: t?.guarantorName ?? '',
    guarantorPhone: t?.guarantorPhone ?? '',
    guarantorEmployer: t?.guarantorEmployer ?? '',
    guarantorRelationship: t?.guarantorRelationship ?? '',
    notes: t?.notes ?? '',
  }
}

function validateTenant(v: TenantFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.displayName).trim()) errs.displayName = 'Name is required'
  const email = str(v.email).trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email address'
  if (!email && !str(v.phone).trim()) errs.email = 'Add an email or phone so the tenant can be contacted'
  return errs
}

export function TenantForm({
  mode,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: TenantFormProps) {
  const [values, setValues] = useState<TenantFormValues>(() => seedTenantValues(initialValues))
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

  const handleSubmit = async (v: TenantFormValues) => {
    const errs = validateTenant(v)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(`Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`)
      return
    }
    setSummary(null)
    await onSubmit(v)
  }

  const identity: FormSection = {
    id: 'identity',
    title: 'Identity',
    columns: 4,
    fields: [
      { name: 'partyType', label: 'Party type', type: 'select', required: true, colSpan: 1, options: TENANT_PARTY_TYPES },
      { name: 'status', label: 'Status', type: 'select', required: true, colSpan: 1, options: TENANT_STATUSES },
      { name: 'displayName', label: 'Full name', type: 'text', required: true, colSpan: 2, placeholder: 'Jane Wanjiku' },
      { name: 'tenantRef', label: 'Tenant ref', type: 'text', colSpan: 1, placeholder: 'T-001' },
      { name: 'idType', label: 'ID type', type: 'select', colSpan: 1, options: [{ value: '', label: '—' }, ...TENANT_ID_TYPES] },
      { name: 'idNumber', label: 'ID number', type: 'text', colSpan: 1 },
      { name: 'kraPin', label: 'KRA PIN', type: 'text', colSpan: 1, placeholder: 'P000000000X' },
      { name: 'nationality', label: 'Nationality', type: 'text', colSpan: 1 },
      { name: 'dateOfBirth', label: 'Date of birth', type: 'date', colSpan: 1 },
    ],
  }

  const contact: FormSection = {
    id: 'contact',
    title: 'Contact',
    columns: 4,
    fields: [
      { name: 'email', label: 'Email', type: 'email', colSpan: 2 },
      { name: 'phone', label: 'Phone', type: 'phone', colSpan: 1, placeholder: '+254 7…' },
      { name: 'altPhone', label: 'Alt phone', type: 'phone', colSpan: 1 },
      { name: 'preferredChannel', label: 'Preferred channel', type: 'select', colSpan: 1, options: CONTACT_CHANNELS },
      { name: 'addressLine1', label: 'Address', type: 'text', colSpan: 2 },
      { name: 'addressLine2', label: 'Address line 2', type: 'text', colSpan: 2 },
      { name: 'city', label: 'City', type: 'text', colSpan: 1 },
      { name: 'postalAddress', label: 'Postal address', type: 'text', colSpan: 1 },
      { name: 'emergencyContactName', label: 'Emergency contact', type: 'text', colSpan: 1 },
      { name: 'emergencyContactRelationship', label: 'Relationship', type: 'text', colSpan: 1 },
      { name: 'emergencyContactPhone', label: 'Emergency phone', type: 'phone', colSpan: 1 },
    ],
  }

  const employment: FormSection = {
    id: 'employment',
    title: 'Employment & income',
    columns: 4,
    fields: [
      { name: 'employer', label: 'Employer', type: 'text', colSpan: 2 },
      { name: 'jobTitle', label: 'Job title', type: 'text', colSpan: 2 },
      { name: 'incomeVerified', label: 'Income verified', type: 'checkbox', colSpan: 1 },
      { name: 'bankReference', label: 'Bank reference', type: 'text', colSpan: 2 },
    ],
  }

  const guarantor: FormSection = {
    id: 'guarantor',
    title: 'Guarantor',
    columns: 4,
    fields: [
      { name: 'guarantorName', label: 'Guarantor name', type: 'text', colSpan: 2 },
      { name: 'guarantorPhone', label: 'Guarantor phone', type: 'phone', colSpan: 2 },
      { name: 'guarantorEmployer', label: 'Guarantor employer', type: 'text', colSpan: 2 },
      { name: 'guarantorRelationship', label: 'Relationship', type: 'text', colSpan: 2 },
    ],
  }

  const notes: FormSection = {
    id: 'notes',
    title: 'Internal notes',
    columns: 4,
    fields: [
      {
        name: 'notes',
        label: 'Notes (never shown in the tenant portal)',
        type: 'textarea',
        rows: 3,
        colSpan: 'full',
      },
    ],
  }

  const steps: WizardStep[] = [
    { id: 'identity', title: 'Identity', description: 'Who the tenant is.', sections: [identity] },
    { id: 'contact', title: 'Contact', description: 'How to reach them.', sections: [contact] },
    { id: 'employment', title: 'Employment', description: 'Income screening details.', sections: [employment] },
    { id: 'guarantor', title: 'Guarantor & notes', description: 'Supporting parties.', sections: [guarantor, notes] },
  ]

  return (
    <div className="space-y-4">
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      <UniversalForm
        title={isEdit ? 'Edit tenant' : 'Add tenant'}
        description={
          isEdit
            ? 'Update the tenant party record.'
            : 'Capture a tenant party — screening, contact and guarantor details.'
        }
        mode={mode}
        variant="wizard"
        steps={steps}
        values={values}
        errors={{ ...errors, ...serverErrors }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel={isEdit ? 'Save changes' : 'Create tenant'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
