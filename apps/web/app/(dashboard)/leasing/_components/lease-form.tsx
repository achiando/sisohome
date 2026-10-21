'use client'

/**
 * LeaseForm — shared create/edit lease wizard (plan-slice-2 §3).
 * Steps: property+term → units (row editor) → parties (row editor) →
 * billing terms. The page owns fetching and navigation.
 */

import { useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Button } from '@workspace/ui/components/button'
import { UniversalForm } from '@workspace/ui/components/form'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@workspace/ui/components/select'
import type { FormSection, WizardStep } from '@workspace/ui/types/components'
import {
  BILLING_FREQUENCIES,
  LEASE_PARTY_RELATIONSHIPS,
  LEASE_TENURES,
} from '@/lib/domain/lease-constants'

export type LeaseFormValues = Record<string, unknown>

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

export interface LeaseUnitRow {
  unitId: string
  monthlyRent: string
  depositAmount: string
}

export interface LeasePartyRow {
  tenantId: string
  relationship: string
  shareOfRent: string
}

export interface LeaseInitialValues {
  propertyId?: string
  leaseRef?: string | null
  tenureType?: string
  currency?: string | null
  billingFrequency?: string | null
  paymentDueDay?: number | null
  depositMonths?: string | null
  noticeDays?: number | null
  autoRenew?: boolean
  terms?: string | null
  startsAt?: string | null
  endsAt?: string | null
  noticeDate?: string | null
  units?: { unitId: string; monthlyRent: string; depositAmount: string | null }[]
  parties?: { tenantId: string; relationship: string; shareOfRent: string | null }[]
}

export interface LeaseFormProps {
  mode: 'create' | 'edit'
  properties: PropertyOption[]
  tenants: TenantOption[]
  units: UnitOption[]
  unitsLoading?: boolean
  onPropertyChange?: (propertyId: string) => void
  initialValues?: LeaseInitialValues | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: LeaseFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function toDateInput(v: unknown): string {
  if (!v) return ''
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function seedLeaseValues(init?: LeaseInitialValues | null): LeaseFormValues {
  return {
    propertyId: init?.propertyId ?? '',
    leaseRef: init?.leaseRef ?? '',
    tenureType: init?.tenureType ?? 'LEASE',
    currency: init?.currency ?? 'KES',
    billingFrequency: init?.billingFrequency ?? 'MONTHLY',
    paymentDueDay: init?.paymentDueDay != null ? String(init.paymentDueDay) : '',
    depositMonths: init?.depositMonths ?? '',
    noticeDays: init?.noticeDays != null ? String(init.noticeDays) : '',
    autoRenew: init?.autoRenew ?? false,
    terms: init?.terms ?? '',
    startsAt: toDateInput(init?.startsAt),
    endsAt: toDateInput(init?.endsAt),
    noticeDate: toDateInput(init?.noticeDate),
    units:
      init?.units && init.units.length > 0
        ? init.units.map((u) => ({
            unitId: u.unitId,
            monthlyRent: u.monthlyRent,
            depositAmount: u.depositAmount ?? '',
          }))
        : [{ unitId: '', monthlyRent: '', depositAmount: '' }],
    parties:
      init?.parties && init.parties.length > 0
        ? init.parties.map((p) => ({
            tenantId: p.tenantId,
            relationship: p.relationship,
            shareOfRent: p.shareOfRent ?? '',
          }))
        : [{ tenantId: '', relationship: 'PRIMARY', shareOfRent: '' }],
  }
}

/** Per-step validation → field-level error map. */
export function validateLeaseStep(step: number, v: LeaseFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (step === 0) {
    if (!str(v.propertyId).trim()) errs.propertyId = 'Property is required'
    if (!str(v.startsAt).trim()) errs.startsAt = 'Start date is required'
    const cur = str(v.currency).trim().toUpperCase()
    if (cur && cur.length !== 3) errs.currency = 'Currency must be a 3-letter code'
    const s = str(v.startsAt)
    const e = str(v.endsAt)
    if (s && e && new Date(e).getTime() <= new Date(s).getTime()) {
      errs.endsAt = 'End date must be after the start date'
    }
  }
  if (step === 1) {
    const rows = (v.units as LeaseUnitRow[]) ?? []
    const filled = rows.filter((r) => str(r.unitId).trim())
    if (filled.length === 0) errs.units = 'Add at least one unit to the lease'
    const seen = new Set<string>()
    rows.forEach((r, i) => {
      const id = str(r.unitId).trim()
      if (!id) return
      if (seen.has(id)) errs[`units.${i}.unitId`] = 'Duplicate unit'
      seen.add(id)
      const rent = Number(r.monthlyRent)
      if (!str(r.monthlyRent).trim() || Number.isNaN(rent) || rent <= 0) {
        errs[`units.${i}.monthlyRent`] = 'Enter a monthly rent above zero'
      }
    })
  }
  if (step === 2) {
    const rows = (v.parties as LeasePartyRow[]) ?? []
    const filled = rows.filter((r) => str(r.tenantId).trim())
    if (filled.length === 0) errs.parties = 'Add at least one tenant party'
    if (filled.length > 0 && !filled.some((r) => r.relationship === 'PRIMARY')) {
      errs.parties = 'One party must be the PRIMARY tenant'
    }
    const seen = new Set<string>()
    rows.forEach((r, i) => {
      const id = str(r.tenantId).trim()
      if (!id) return
      if (seen.has(id)) errs[`parties.${i}.tenantId`] = 'Duplicate tenant'
      seen.add(id)
    })
  }
  if (step === 3) {
    const day = str(v.paymentDueDay).trim()
    if (day) {
      const n = Number(day)
      if (Number.isNaN(n) || n < 1 || n > 31) errs.paymentDueDay = 'Due day must be 1–31'
    }
  }
  return errs
}

/** Map form values → POST/PATCH body (snake-free API shape). */
export function toLeasePayload(v: LeaseFormValues): Record<string, unknown> {
  const numOrNull = (s: string) => {
    const t = s.trim()
    if (!t) return null
    const n = Number(t)
    return Number.isNaN(n) ? null : n
  }
  return {
    propertyId: str(v.propertyId).trim(),
    leaseRef: str(v.leaseRef).trim() || null,
    tenureType: str(v.tenureType) || 'LEASE',
    currency: (str(v.currency).trim() || 'KES').toUpperCase(),
    billingFrequency: str(v.billingFrequency) || 'MONTHLY',
    paymentDueDay: numOrNull(str(v.paymentDueDay)),
    depositMonths: numOrNull(str(v.depositMonths)),
    noticeDays: numOrNull(str(v.noticeDays)),
    autoRenew: v.autoRenew === true,
    terms: str(v.terms).trim() || null,
    startsAt: str(v.startsAt).trim() || null,
    endsAt: str(v.endsAt).trim() || null,
    units: ((v.units as LeaseUnitRow[]) ?? [])
      .filter((r) => str(r.unitId).trim())
      .map((r) => ({
        unitId: str(r.unitId).trim(),
        monthlyRent: Number(r.monthlyRent),
        depositAmount: numOrNull(str(r.depositAmount)),
      })),
    parties: ((v.parties as LeasePartyRow[]) ?? [])
      .filter((r) => str(r.tenantId).trim())
      .map((r) => ({
        tenantId: str(r.tenantId).trim(),
        relationship: r.relationship || 'PRIMARY',
        shareOfRent: numOrNull(str(r.shareOfRent)),
      })),
  }
}

// ── row editors (custom form fields) ──────────────────────────────────────────

interface UnitRowsProps {
  value: unknown
  onChange: (rows: LeaseUnitRow[]) => void
  units: UnitOption[]
  loading?: boolean
  error?: string
}

function UnitRowsEditor({ value, onChange, units, loading, error }: UnitRowsProps) {
  const rows: LeaseUnitRow[] =
    Array.isArray(value) && value.length > 0
      ? (value as LeaseUnitRow[])
      : [{ unitId: '', monthlyRent: '', depositAmount: '' }]

  const setRow = (i: number, patch: Partial<LeaseUnitRow>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Unit</Label>
            <Select
              value={row.unitId || undefined}
              onValueChange={(v) => setRow(i, { unitId: v })}
              disabled={loading}
            >
              <SelectTrigger
                size="sm"
                placeholder={loading ? 'Loading units…' : units.length === 0 ? 'No units on this property' : 'Select a unit'}
              />
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label ?? u.unitRef}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Monthly rent</Label>
            <Input
              inputSize="sm"
              type="number"
              min={0}
              placeholder="e.g. 45000"
              value={row.monthlyRent}
              onChange={(e) => setRow(i, { monthlyRent: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Deposit (optional)</Label>
            <Input
              inputSize="sm"
              type="number"
              min={0}
              placeholder="Absolute amount"
              value={row.depositAmount}
              onChange={(e) => setRow(i, { depositAmount: e.target.value })}
            />
          </div>
          <Button
            variant="text"
            size="sm"
            aria-label="Remove unit row"
            disabled={rows.length <= 1}
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { unitId: '', monthlyRent: '', depositAmount: '' }])}
      >
        Add unit
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

interface PartyRowsProps {
  value: unknown
  onChange: (rows: LeasePartyRow[]) => void
  tenants: TenantOption[]
  error?: string
}

function PartyRowsEditor({ value, onChange, tenants, error }: PartyRowsProps) {
  const rows: LeasePartyRow[] =
    Array.isArray(value) && value.length > 0
      ? (value as LeasePartyRow[])
      : [{ tenantId: '', relationship: 'PRIMARY', shareOfRent: '' }]

  const setRow = (i: number, patch: Partial<LeasePartyRow>) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tenant</Label>
            <Select value={row.tenantId || undefined} onValueChange={(v) => setRow(i, { tenantId: v })}>
              <SelectTrigger size="sm" placeholder={tenants.length === 0 ? 'No tenants yet' : 'Select a tenant'} />
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Relationship</Label>
            <Select value={row.relationship} onValueChange={(v) => setRow(i, { relationship: v })}>
              <SelectTrigger size="sm" />
              <SelectContent>
                {LEASE_PARTY_RELATIONSHIPS.map((r) => (
                  <SelectItem key={r.value} value={String(r.value)}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Share of rent (optional)</Label>
            <Input
              inputSize="sm"
              type="number"
              min={0}
              placeholder="Amount"
              value={row.shareOfRent}
              onChange={(e) => setRow(i, { shareOfRent: e.target.value })}
            />
          </div>
          <Button
            variant="text"
            size="sm"
            aria-label="Remove party row"
            disabled={rows.length <= 1}
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { tenantId: '', relationship: 'JOINT', shareOfRent: '' }])}
      >
        Add party
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

// ── main form ─────────────────────────────────────────────────────────────────

export function LeaseForm({
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
}: LeaseFormProps) {
  const [values, setValues] = useState<LeaseFormValues>(() => seedLeaseValues(initialValues))
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
    if (name === 'propertyId') {
      onPropertyChange?.(String(value))
      // Unit rows belong to the previous property — clear them.
      setValues((prev) => ({ ...prev, propertyId: value, units: [{ unitId: '', monthlyRent: '', depositAmount: '' }] }))
      return
    }
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    const allErrs: Record<string, string> = {}
    for (let s = 0; s < 4; s++) Object.assign(allErrs, validateLeaseStep(s, values))
    if (Object.keys(allErrs).length > 0) {
      setErrors(allErrs)
      setSummary('Fix the highlighted fields before saving.')
      return
    }
    setErrors({})
    setSummary(null)
    await onSubmit(toLeasePayload(values))
  }

  const details: FormSection = {
    id: 'details',
    title: 'Lease details',
    columns: 4,
    fields: [
      {
        name: 'propertyId',
        label: 'Property',
        type: 'select',
        required: true,
        colSpan: 2,
        disabled: isEdit,
        options: properties.map((p) => ({ value: p.id, label: p.name })),
        helperText: isEdit ? undefined : 'Units and parties follow this property',
      },
      { name: 'leaseRef', label: 'Lease reference', type: 'text', colSpan: 2, placeholder: 'LSE-0001' },
      { name: 'tenureType', label: 'Tenure type', type: 'select', required: true, colSpan: 1, options: LEASE_TENURES },
      { name: 'currency', label: 'Currency', type: 'text', required: true, colSpan: 1, placeholder: 'KES' },
      { name: 'startsAt', label: 'Start date', type: 'date', required: true, colSpan: 1 },
      { name: 'endsAt', label: 'End date', type: 'date', colSpan: 1, helperText: 'Empty = month-to-month' },
    ],
  }

  const unitsSection: FormSection = {
    id: 'units',
    title: 'Units',
    columns: 4,
    fields: [
      {
        name: 'units',
        label: 'Units on this lease',
        type: 'custom',
        colSpan: 'full',
        helperText: 'Rent is set per unit; a lease may cover several units of one property.',
        render: ({ value, onChange, error }: { value: unknown; onChange: (v: unknown) => void; error?: string }) => (
          <UnitRowsEditor value={value} onChange={(rows) => onChange(rows)} units={units} loading={unitsLoading} error={error} />
        ),
      },
    ],
  }

  const partiesSection: FormSection = {
    id: 'parties',
    title: 'Tenants',
    columns: 4,
    fields: [
      {
        name: 'parties',
        label: 'Parties on this lease',
        type: 'custom',
        colSpan: 'full',
        helperText: 'At least one party must be the PRIMARY tenant.',
        render: ({ value, onChange, error }: { value: unknown; onChange: (v: unknown) => void; error?: string }) => (
          <PartyRowsEditor value={value} onChange={(rows) => onChange(rows)} tenants={tenants} error={error} />
        ),
      },
    ],
  }

  const billing: FormSection = {
    id: 'billing',
    title: 'Billing & terms',
    columns: 4,
    fields: [
      {
        name: 'billingFrequency',
        label: 'Billing frequency',
        type: 'select',
        required: true,
        colSpan: 1,
        options: BILLING_FREQUENCIES,
      },
      { name: 'paymentDueDay', label: 'Payment due day', type: 'number', colSpan: 1, placeholder: '1–31' },
      { name: 'depositMonths', label: 'Deposit (months)', type: 'text', colSpan: 1, placeholder: 'e.g. 2' },
      { name: 'noticeDays', label: 'Notice (days)', type: 'number', colSpan: 1 },
      { name: 'autoRenew', label: 'Auto-renew', type: 'toggle', colSpan: 1, toggleLabel: 'Renews automatically' },
      { name: 'noticeDate', label: 'Expected move-out', type: 'date', colSpan: 1 },
      {
        name: 'terms',
        label: 'General terms / clauses',
        type: 'textarea',
        rows: 4,
        colSpan: 'full',
        placeholder: 'Free-text clauses shown on the signed agreement.',
      },
    ],
  }

  const steps: WizardStep[] = [
    { id: 'details', title: 'Details', description: 'Property, reference and term dates.', sections: [details] },
    { id: 'units', title: 'Units', description: 'Units covered by this lease and their rent.', sections: [unitsSection] },
    { id: 'parties', title: 'Tenants', description: 'Who is on the lease and their relationship.', sections: [partiesSection] },
    { id: 'billing', title: 'Billing', description: 'Rent schedule, deposit and general terms.', sections: [billing] },
  ]

  return (
    <div className="space-y-4">
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      <UniversalForm
        title={isEdit ? 'Edit lease' : 'New lease'}
        description={
          isEdit
            ? 'Amend the lease terms, units or parties.'
            : 'Capture a lease — property, units, tenants and billing terms.'
        }
        mode={mode}
        variant="wizard"
        steps={steps}
        values={values}
        errors={{ ...errors, ...serverErrors }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onValidateStep={validateLeaseStep}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel={isEdit ? 'Save changes' : 'Create lease'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
