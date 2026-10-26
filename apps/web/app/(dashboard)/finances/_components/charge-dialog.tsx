'use client'

/**
 * ChargeDialog — manual one-off charge (Slice 8). Property → unit/tenant
 * cascade; posted immediately with a minted invoice number (server rule).
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
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'
import { CHARGE_TYPE_LABELS } from '@/lib/domain/charge-constants'
import { usePropertyOptions } from './doc-dialogs'

type Values = Record<string, unknown>

const NONE = '__none__'

const CHARGE_TYPE_OPTIONS = Object.entries(CHARGE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

type UnitOption = { id: string; unitRef: string; label: string }
type TenantOption = { id: string; displayName: string }

export type ChargeContext = {
  propertyId: string
  unitId?: string | null
  tenantId?: string | null
  /** Attached to the charge so it shows on the lease's Charges tab. */
  leaseId?: string | null
}

export function ChargeDialog({
  open,
  onClose,
  onCreated,
  context,
}: {
  open: boolean
  onClose: () => void
  onCreated?: () => void
  /** Pre-fill and lock targeting (e.g. created from a lease detail page). */
  context?: ChargeContext | null
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New charge</DialogTitle>
          <DialogDescription>
            A one-off bill (late fee, service charge, damage…). Posted immediately — the invoice
            number is minted with it.
          </DialogDescription>
        </DialogHeader>
        {open ? <ChargeInner onClose={onClose} onCreated={onCreated} context={context ?? null} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ChargeInner({
  onClose,
  onCreated,
  context,
}: {
  onClose: () => void
  onCreated?: () => void
  context: ChargeContext | null
}) {
  const propertyOptions = usePropertyOptions()
  const locked = Boolean(context?.propertyId)
  const lockedPropertyId = context?.propertyId ?? ''
  const [units, setUnits] = useState<UnitOption[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [values, setValues] = useState<Values>(() => ({
    propertyId: context?.propertyId ?? '',
    unitId: context?.unitId ?? NONE,
    tenantId: context?.tenantId ?? NONE,
    chargeType: 'OTHER',
    title: '',
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
    notes: '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Tenants once (org directory); units re-fetch per selected property.
  useEffect(() => {
    let cancelled = false
    fetch('/api/tenants', { credentials: 'include' })
      .then(async (res) => (res.ok ? res.json() : { tenants: [] }))
      .then((data: { tenants?: TenantOption[] }) => {
        if (!cancelled) setTenants(data.tenants ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const propertyId = typeof values.propertyId === 'string' ? values.propertyId : ''
  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    fetch(`/api/units?propertyId=${encodeURIComponent(propertyId)}`, { credentials: 'include' })
      .then(async (res) => (res.ok ? res.json() : { units: [] }))
      .then((data: { units?: { id: string; unitRef: string; label: string | null }[] }) => {
        if (!cancelled) setUnits((data.units ?? []).map((u) => ({ id: u.id, unitRef: u.unitRef, label: u.label ?? u.unitRef })))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [propertyId])

  const sections: FormSection[] = useMemo(
    () => [
      {
        id: 'charge',
        title: 'Charge',
        columns: 2,
        fields: [
          {
            name: 'propertyId',
            label: 'Property',
            type: 'select',
            required: true,
            colSpan: 1,
            options: locked ? propertyOptions.filter((o) => o.value === lockedPropertyId) : propertyOptions,
            placeholder: locked ? undefined : 'Select a property',
            disabled: locked,
          },
          {
            name: 'unitId',
            label: 'Unit',
            type: 'select',
            colSpan: 1,
            disabled: locked,
            options: [
              { value: NONE, label: 'Not tied to a unit' },
              ...units.map((u) => ({ value: u.id, label: u.label })),
            ],
          },
          {
            name: 'chargeType',
            label: 'Type',
            type: 'select',
            required: true,
            colSpan: 1,
            options: CHARGE_TYPE_OPTIONS,
          },
          {
            name: 'tenantId',
            label: 'Tenant',
            type: 'select',
            colSpan: 1,
            disabled: locked,
            options: [
              { value: NONE, label: 'No tenant' },
              ...tenants.map((t) => ({ value: t.id, label: t.displayName })),
            ],
          },
          {
            name: 'title',
            label: 'Title (optional)',
            type: 'text',
            colSpan: 1,
            helperText: 'Shown on the invoice, e.g. "Late payment fee Oct"',
          },
          {
            name: 'amount',
            label: 'Amount',
            type: 'number',
            required: true,
            colSpan: 1,
          },
          {
            name: 'dueDate',
            label: 'Due date',
            type: 'date',
            required: true,
            colSpan: 1,
          },
          {
            name: 'notes',
            label: 'Notes (optional)',
            type: 'text',
            colSpan: 1,
          },
        ],
      },
    ],
    [propertyOptions, units, tenants, locked, lockedPropertyId],
  )

  const handleSubmit = async (v: Values) => {
    const errs: Record<string, string> = {}
    if (!v.propertyId) errs.propertyId = 'Pick a property'
    const amount = Number(v.amount)
    if (!Number.isFinite(amount) || amount <= 0) errs.amount = 'Enter a positive amount'
    if (!v.dueDate) errs.dueDate = 'Pick a due date'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/charges', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: v.propertyId,
          unitId: v.unitId !== NONE ? v.unitId : null,
          tenantId: v.tenantId !== NONE ? v.tenantId : null,
          chargeType: v.chargeType,
          title: String(v.title ?? '').trim() || null,
          amount,
          dueDate: v.dueDate,
          notes: String(v.notes ?? '').trim() || null,
          leaseId: context?.leaseId ?? null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not create charge')
        setSaving(false)
        return
      }
      const number = data.charge?.invoiceNumber ? ` — invoice ${data.charge.invoiceNumber}` : ''
      toast.success(`Charge created${number}`)
      onCreated?.()
      onClose()
    } catch {
      toast.error('Network error — nothing was saved')
      setSaving(false)
    }
  }

  return (
    <UniversalForm
      title="New charge"
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
        setValues((prev) => {
          const next = { ...prev, [name]: value }
          if (name === 'propertyId') {
            next.unitId = NONE
            setUnits([])
          }
          return next
        })
      }}
      onSubmit={handleSubmit}
      primaryLabel={saving ? 'Creating…' : 'Create charge'}
      isLoading={saving}
      onCancel={onClose}
      bare
      formClassName="w-full"
    />
  )
}
