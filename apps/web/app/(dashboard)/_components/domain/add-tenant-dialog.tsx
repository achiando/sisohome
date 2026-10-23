'use client'

/**
 * AddTenantDialog — the SHORT path to put a tenant in a vacant unit (the
 * complaint with the old flow: "Add tenant" dropped you into the 4-step lease
 * wizard for what is usually two fields). One screen: pick a tenant from the
 * directory or capture a minimal new one (name + phone/email), rent and
 * deposit default from the unit template, then POST /api/leases/quick drafts
 * a PENDING_APPROVAL lease for that single unit.
 *
 * The full wizard stays at /leasing/leases/new for multi-unit, joint-tenant
 * or heavily customised agreements.
 */

import { useEffect, useMemo, useState } from 'react'
import { toast } from '@workspace/ui/components/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { PageLoader } from '@workspace/ui/components/loader'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection, SelectOption } from '@workspace/ui/types/components'

/** Select sentinel: "capture a brand-new tenant instead". */
const NEW_TENANT = '__new__'

interface UnitDefaults {
  id: string
  propertyId: string
  unitRef: string
  label: string | null
  defaultRent: string | number | null
  depositDefault: string | number | null
  currency: string | null
}

interface TenantOption {
  id: string
  displayName: string
  phone?: string | null
  email?: string | null
}

type Values = Record<string, unknown>

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function AddTenantDialog({
  open,
  unitId,
  unitLabel,
  onClose,
  onSaved,
}: {
  open: boolean
  unitId: string
  unitLabel?: string | null
  onClose: () => void
  /** Called with the new lease id after a successful save. */
  onSaved: (leaseId: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add tenant{unitLabel ? ` to ${unitLabel}` : ''}</DialogTitle>
          <DialogDescription>
            Captures the tenant (or picks one you already have) and drafts a lease for this unit.
            Rent and deposit default from the unit — approve the draft from the lease page.
          </DialogDescription>
        </DialogHeader>
        {open ? <AddTenantInner unitId={unitId} onClose={onClose} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function AddTenantInner({
  unitId,
  onClose,
  onSaved,
}: {
  unitId: string
  onClose: () => void
  onSaved: (leaseId: string) => void
}) {
  const [unit, setUnit] = useState<UnitDefaults | null>(null)
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState<Values>(() => ({
    tenantId: '',
    displayName: '',
    phone: '',
    email: '',
    monthlyRent: '',
    depositMonths: '',
    startsAt: today(),
    endsAt: '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/units/${unitId}`, { credentials: 'include' }).then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load unit')
        const data = await res.json()
        return data.unit as UnitDefaults
      }),
      fetch('/api/tenants', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => (d.tenants ?? []) as TenantOption[]),
    ])
      .then(([u, t]) => {
        if (cancelled) return
        setUnit(u)
        setTenants(t)
        setValues((prev) => ({
          ...prev,
          monthlyRent: u.defaultRent != null ? String(u.defaultRent) : '',
          depositMonths: u.depositDefault != null ? String(u.depositDefault) : '',
        }))
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load unit')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [unitId])

  const isNew = String(values.tenantId ?? '') === NEW_TENANT

  const sections: FormSection[] = useMemo(() => {
    const opts: SelectOption[] = [
      ...tenants.map((t) => ({
        value: t.id,
        label: [t.displayName, t.phone ?? t.email].filter(Boolean).join(' · '),
      })),
      { value: NEW_TENANT, label: '＋ New tenant…' },
    ]
    const tenantFields: FormSection['fields'] = [
      {
        name: 'tenantId',
        label: 'Tenant',
        type: 'select',
        required: true,
        colSpan: 2,
        options: opts,
        helperText:
          tenants.length > 0
            ? 'Existing tenants first — pick one, or add a new party'
            : 'No tenants yet — add one below',
      },
      ...(isNew
        ? ([
            { name: 'displayName', label: 'Full name or company', type: 'text', required: true, colSpan: 2 },
            { name: 'phone', label: 'Phone', type: 'phone', colSpan: 1 },
            { name: 'email', label: 'Email', type: 'email', colSpan: 1 },
          ] as FormSection['fields'])
        : []),
    ]
    const currency = unit?.currency ? unit.currency : undefined
    return [
      { id: 'tenant', title: 'Tenant', columns: 2, fields: tenantFields },
      {
        id: 'terms',
        title: 'Tenancy',
        columns: 2,
        fields: [
          {
            name: 'monthlyRent',
            label: 'Monthly rent',
            type: 'number',
            required: true,
            colSpan: 1,
            helperText: currency ? `Amounts are in ${currency}` : undefined,
          },
          {
            name: 'depositMonths',
            label: 'Deposit (months)',
            type: 'number',
            colSpan: 1,
            helperText: 'e.g. 2 — blank for none',
          },
          { name: 'startsAt', label: 'Starts', type: 'date', required: true, colSpan: 1 },
          { name: 'endsAt', label: 'Ends (optional)', type: 'date', colSpan: 1, helperText: 'Blank = open-ended' },
        ],
      },
    ]
  }, [tenants, isNew, unit?.currency])

  const handleSubmit = async (v: Values) => {
    const errs: Record<string, string> = {}
    const tenantId = String(v.tenantId ?? '')
    if (!tenantId) errs.tenantId = 'Pick a tenant or “New tenant”'
    if (tenantId === NEW_TENANT && !String(v.displayName ?? '').trim()) {
      errs.displayName = 'Name is required'
    }
    const rent = Number(v.monthlyRent)
    if (!Number.isFinite(rent) || rent < 0) errs.monthlyRent = 'Enter the monthly rent'
    if (!v.startsAt) errs.startsAt = 'Start date is required'
    if (v.endsAt && v.startsAt && new Date(String(v.endsAt)) <= new Date(String(v.startsAt))) {
      errs.endsAt = 'End date must be after the start date'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/leases/quick', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: unit?.propertyId,
          unitId,
          startsAt: v.startsAt,
          endsAt: v.endsAt ? v.endsAt : null,
          monthlyRent: rent,
          depositMonths:
            v.depositMonths === '' || v.depositMonths == null ? null : Number(v.depositMonths),
          ...(tenantId === NEW_TENANT
            ? {
                newTenant: {
                  displayName: String(v.displayName ?? '').trim(),
                  phone: String(v.phone ?? '').trim() || null,
                  email: String(v.email ?? '').trim() || null,
                },
              }
            : { tenantId }),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not add tenant')
        setSaving(false)
        return
      }
      toast.success('Tenant added — lease draft created')
      onSaved(data.lease?.id)
      onClose()
    } catch {
      toast.error('Network error — nothing was saved')
      setSaving(false)
    }
  }

  if (loading) return <PageLoader title="Loading unit…" description="" />

  return (
    <UniversalForm
      title="Add tenant"
      mode="create"
      variant="standard"
      sections={sections}
      values={values}
      errors={errors}
      onChange={(name, value) => {
        setErrors((prev) => {
          if (!prev[name]) return prev
          const next = { ...prev }
          delete next[name]
          return next
        })
        setValues((prev) => ({ ...prev, [name]: value }))
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      isLoading={saving}
      primaryLabel="Add tenant"
      bare
      formClassName="w-full"
    />
  )
}
