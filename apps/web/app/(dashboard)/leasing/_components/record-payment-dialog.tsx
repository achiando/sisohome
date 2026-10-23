'use client'

/**
 * RecordPaymentDialog — record a payment covering one or more months of
 * open charges (rent or utilities). Posts to /api/payments/for-months,
 * which allocates oldest-first in one transaction. `amount` is optional —
 * blank means "full open balance for the covered months".
 *
 * Used from the tenant Payments tab (needs propertyId + tenantId) and the
 * unit detail "Mark payment" action (needs propertyId + unitId).
 */

import { useMemo, useState } from 'react'
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

type Values = Record<string, unknown>

const METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' },
]

const ACCOUNT_TYPES = [
  { value: 'RENT', label: 'Rent' },
  { value: 'UTILITIES', label: 'Utilities' },
]

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function RecordPaymentDialog({
  open,
  propertyId,
  unitId,
  tenantId,
  leaseId,
  defaultAccountType,
  onClose,
  onRecorded,
}: {
  open: boolean
  propertyId: string
  unitId?: string | null
  tenantId?: string | null
  leaseId?: string | null
  defaultAccountType?: 'RENT' | 'UTILITIES'
  onClose: () => void
  /** Called after a successful save (for reloading parent data). */
  onRecorded?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Covers one or more months of open charges. Allocation is oldest-first —
            leave amount blank to settle the full open balance.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <RecordPaymentInner
            propertyId={propertyId}
            unitId={unitId ?? null}
            tenantId={tenantId ?? null}
            leaseId={leaseId ?? null}
            defaultAccountType={defaultAccountType ?? 'RENT'}
            onClose={onClose}
            onRecorded={onRecorded}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RecordPaymentInner({
  propertyId,
  unitId,
  tenantId,
  leaseId,
  defaultAccountType,
  onClose,
  onRecorded,
}: {
  propertyId: string
  unitId: string | null
  tenantId: string | null
  leaseId: string | null
  defaultAccountType: 'RENT' | 'UTILITIES'
  onClose: () => void
  onRecorded?: () => void
}) {
  const [values, setValues] = useState<Values>(() => ({
    accountType: defaultAccountType,
    months: '1',
    fromMonth: thisMonth(),
    method: 'CASH',
    reference: '',
    amount: '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const sections: FormSection[] = useMemo(
    () => [
      {
        id: 'payment',
        title: 'Payment',
        columns: 2,
        fields: [
          {
            name: 'accountType',
            label: 'Account',
            type: 'select',
            required: true,
            colSpan: 1,
            options: ACCOUNT_TYPES,
          },
          {
            name: 'method',
            label: 'Method',
            type: 'select',
            required: true,
            colSpan: 1,
            options: METHODS,
          },
          {
            name: 'months',
            label: 'Months covered',
            type: 'number',
            required: true,
            colSpan: 1,
            helperText: 'e.g. 3 — allocates oldest open charges first',
          },
          {
            name: 'fromMonth',
            label: 'From month',
            type: 'date',
            required: true,
            colSpan: 1,
            helperText: 'Earliest open month to start allocating from (day is ignored)',
          },
          {
            name: 'reference',
            label: 'Reference (optional)',
            type: 'text',
            colSpan: 1,
            helperText: 'Receipt / transaction number',
          },
          {
            name: 'amount',
            label: 'Amount (optional)',
            type: 'number',
            colSpan: 1,
            helperText: 'Blank = full open balance for covered months',
          },
        ],
      },
    ],
    [],
  )

  const handleSubmit = async (v: Values) => {
    const errs: Record<string, string> = {}
    const months = Number(v.months)
    if (!Number.isFinite(months) || months < 1 || months > 36) {
      errs.months = 'Enter 1–36'
    }
    const fromMonthRaw = String(v.fromMonth ?? '')
    const fromMonth = fromMonthRaw ? fromMonthRaw.slice(0, 7) : ''
    if (!fromMonth) errs.fromMonth = 'Pick a month'
    if (v.amount != null && v.amount !== '') {
      const amt = Number(v.amount)
      if (!Number.isFinite(amt) || amt <= 0) errs.amount = 'Enter a positive amount'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/payments/for-months', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          unitId,
          tenantId,
          leaseId,
          accountType: v.accountType,
          months,
          fromMonth,
          method: v.method,
          reference: String(v.reference ?? '').trim() || null,
          amount: v.amount != null && v.amount !== '' ? Number(v.amount) : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not record payment')
        setSaving(false)
        return
      }
      const covered: string[] = data.payment?.monthsCovered ?? []
      toast.success(
        covered.length > 1
          ? `Payment recorded — ${covered.length} months covered`
          : 'Payment recorded',
      )
      onRecorded?.()
      onClose()
    } catch {
      toast.error('Network error — nothing was saved')
      setSaving(false)
    }
  }

  return (
    <UniversalForm
      title="Record payment"
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
      primaryLabel="Record payment"
      bare
      formClassName="w-full"
    />
  )
}
