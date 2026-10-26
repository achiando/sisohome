'use client'

/**
 * AdjustmentDialog — submit a charge correction (Slice 8): CREDIT, WAIVER,
 * REVERSAL (void) or WRITE_OFF, positive amount ≤ the charge's open balance.
 * Lands PENDING; an approver decides it on the Adjustments tab. When opened
 * from a charge row the charge is locked and its balance prefills the amount.
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
import { chargeTypeLabel } from '@/lib/domain/charge-constants'
import { usePropertyOptions } from './doc-dialogs'

type Values = Record<string, unknown>

type OpenCharge = {
  id: string
  chargeType: string
  title: string | null
  balance: string
  currency: string
  dueDate: string
  unit: { id: string; unitRef: string } | null
  property: { id: string; name: string }
  tenant: { id: string; displayName: string } | null
}

const TYPE_OPTIONS = [
  { value: 'CREDIT', label: 'Credit' },
  { value: 'WAIVER', label: 'Waiver' },
  { value: 'REVERSAL', label: 'Reversal (void)' },
  { value: 'WRITE_OFF', label: 'Write-off' },
]

const NONE = '__none__'

function chargeLabel(c: OpenCharge): string {
  const title = c.title ?? chargeTypeLabel(c.chargeType)
  const where = [c.unit?.unitRef ?? c.property.name, c.tenant?.displayName].filter(Boolean).join(' · ')
  return `${title} — ${where} (bal ${Number(c.balance).toLocaleString()} ${c.currency})`
}

export function AdjustmentDialog({
  open,
  onClose,
  onCreated,
  chargeId,
}: {
  open: boolean
  onClose: () => void
  onCreated?: () => void
  /** Pre-selected charge (row action) — locked in the form. */
  chargeId?: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New adjustment</DialogTitle>
          <DialogDescription>
            Submit a credit, waiver, reversal or write-off. It only reduces balances once an
            approver signs it off.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AdjustmentInner onClose={onClose} onCreated={onCreated} chargeId={chargeId ?? null} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AdjustmentInner({
  onClose,
  onCreated,
  chargeId,
}: {
  onClose: () => void
  onCreated?: () => void
  chargeId: string | null
}) {
  const propertyOptions = usePropertyOptions()
  const [charges, setCharges] = useState<OpenCharge[] | null>(null)
  const [values, setValues] = useState<Values>(() => ({
    propertyId: chargeId ? '' : NONE,
    chargeId: chargeId ?? '',
    type: 'CREDIT',
    amount: '',
    reason: '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/charges?status=open', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load open charges')
        return data as { charges: OpenCharge[] }
      })
      .then((data) => {
        if (!cancelled) {
          const list = data.charges ?? []
          setCharges(chargeId ? list.filter((c) => c.id === chargeId) : list)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load open charges')
      })
    return () => {
      cancelled = true
    }
  }, [chargeId])

  const selectedProperty = typeof values.propertyId === 'string' ? values.propertyId : ''
  const selectedChargeId = typeof values.chargeId === 'string' ? values.chargeId : ''
  const chargeOptions = useMemo(() => {
    const list = (charges ?? []).filter(
      (c) => !selectedProperty || selectedProperty === NONE || c.property.id === selectedProperty,
    )
    return list.map((c) => ({ value: c.id, label: chargeLabel(c) }))
  }, [charges, selectedProperty])
  const selectedCharge = useMemo(
    () => (charges ?? []).find((c) => c.id === selectedChargeId) ?? null,
    [charges, selectedChargeId],
  )

  const sections: FormSection[] = useMemo(() => {
    const fields: FormSection['fields'] = []
    if (!chargeId) {
      fields.push({
        name: 'propertyId',
        label: 'Property',
        type: 'select',
        colSpan: 1,
        options: [{ value: NONE, label: 'All properties' }, ...propertyOptions],
      })
    }
    fields.push(
      {
        name: 'chargeId',
        label: 'Charge',
        type: 'select',
        required: true,
        colSpan: chargeId ? 2 : 1,
        disabled: Boolean(chargeId),
        options: chargeOptions,
        placeholder: chargeId ? 'Charge' : 'Select an open charge',
        helperText: selectedCharge
          ? `Open balance: ${Number(selectedCharge.balance).toLocaleString()} ${selectedCharge.currency}`
          : undefined,
      },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        colSpan: 1,
        options: TYPE_OPTIONS,
      },
      {
        name: 'amount',
        label: 'Amount',
        type: 'number',
        required: true,
        colSpan: 1,
        helperText: selectedCharge
          ? `Max ${Number(selectedCharge.balance).toLocaleString()} ${selectedCharge.currency} — reselect the charge to prefill`
          : 'Positive amount, capped by the open balance',
      },
      {
        name: 'reason',
        label: 'Reason',
        type: 'textarea',
        required: true,
        colSpan: 2,
        helperText: 'Why this correction is being made (recorded in the audit trail)',
      },
    )
    return [{ id: 'adjustment', title: 'Adjustment', columns: 2, fields }]
  }, [chargeId, propertyOptions, chargeOptions, selectedCharge])

  const handleSubmit = async (v: Values) => {
    const errs: Record<string, string> = {}
    const targetChargeId = String(v.chargeId ?? '')
    if (!targetChargeId || targetChargeId === NONE) errs.chargeId = 'Pick a charge'
    const amount = Number(v.amount)
    if (!Number.isFinite(amount) || amount <= 0) errs.amount = 'Enter a positive amount'
    if (selectedCharge && amount > Number(selectedCharge.balance) + 0.009) {
      errs.amount = `Cannot exceed the open balance (${selectedCharge.balance})`
    }
    if (String(v.reason ?? '').trim().length < 3) errs.reason = 'Give a short reason'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/adjustments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargeId: targetChargeId,
          type: v.type,
          amount,
          reason: String(v.reason ?? '').trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not submit adjustment')
        setSaving(false)
        return
      }
      toast.success('Adjustment submitted — awaiting approval')
      onCreated?.()
      onClose()
    } catch {
      toast.error('Network error — nothing was saved')
      setSaving(false)
    }
  }

  return (
    <UniversalForm
      title="New adjustment"
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
          if (name === 'propertyId') next.chargeId = ''
          if (name === 'chargeId') {
            const picked = (charges ?? []).find((c) => c.id === value)
            if (picked) next.amount = picked.balance // full-balance helper
          }
          return next
        })
      }}
      onSubmit={handleSubmit}
      primaryLabel={saving ? 'Submitting…' : 'Submit adjustment'}
      isLoading={saving}
      onCancel={onClose}
      bare
      formClassName="w-full"
    />
  )
}
