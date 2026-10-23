'use client'

/**
 * UnitBillsCard — recurring NON-rent bills attached to a unit (waste,
 * water, service charge…) with their collection frequency. Data comes from
 * GET /api/units/[id]/charge-schedules; adds ride POST on the same path and
 * deletes DELETE /api/charge-schedules/[id]. Rent stays lease-driven — the
 * create form refuses RENT and the domain enforces it too.
 */

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Receipt } from 'lucide-react'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@workspace/ui/components/alert-dialog'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { PageLoader } from '@workspace/ui/components/loader'
import { UniversalForm } from '@workspace/ui/components/form'
import { toast } from '@workspace/ui/components/toast'
import type { FormSection } from '@workspace/ui/types/components'
import { chargeTypeLabel, frequencyLabel, NON_RENT_CHARGE_TYPES, BILLING_FREQUENCIES } from '@/lib/domain/charge-constants'
import { useUiPermission } from '@/components/shell/use-ui-permission'

export interface UnitBillRow {
  id: string
  name: string
  chargeType: string
  amount: string
  currency: string
  frequency: string
  startDate: string
  endDate: string | null
  isActive: boolean
}

type Values = Record<string, unknown>

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function UnitBillsCard({ unitId, currency }: { unitId: string; currency?: string | null }) {
  const { hasUiPermission } = useUiPermission()
  const canCreate = hasUiPermission('charge.create')
  const canManage = hasUiPermission('charge.manage')

  const [rows, setRows] = useState<UnitBillRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UnitBillRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/units/${unitId}/charge-schedules`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load bills')
        return (data.schedules ?? []) as UnitBillRow[]
      })
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load bills')
      })
    return () => {
      cancelled = true
    }
  }, [unitId])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      const res = await fetch(`/api/charge-schedules/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to remove bill')
        return
      }
      toast.success(`Removed “${deleteTarget.name}”`)
      setDeleteTarget(null)
      load()
    } catch {
      toast.error('Network error — nothing was removed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card variant="outlined" size="sm">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-4 w-4" aria-hidden="true" />
          Recurring bills
        </CardTitle>
        {canCreate ? (
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add bill
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows === null ? (
          <PageLoader title="Loading bills…" description="" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recurring bills on this unit yet. Add waste, water, or service-charge rules here.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{b.name}</span>
                    <Badge variant={b.isActive ? 'default' : 'neutral'}>{b.isActive ? 'Active' : 'Off'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {chargeTypeLabel(b.chargeType)} · {frequencyLabel(b.frequency)}
                    {b.endDate ? ` · ends ${b.endDate}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm tabular-nums">
                    {b.currency} {Number(b.amount).toLocaleString()}
                  </span>
                  {canManage ? (
                    <Button
                      variant="text"
                      size="sm"
                      className="text-destructive"
                      aria-label={`Remove ${b.name}`}
                      onClick={() => setDeleteTarget(b)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AddBillDialog
        open={addOpen}
        unitId={unitId}
        currency={currency ?? null}
        onClose={() => setAddOpen(false)}
        onSaved={load}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The recurring rule is deleted. Charges already posted to the ledger are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => confirmDelete()}>
              Remove bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function AddBillDialog({
  open,
  unitId,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean
  unitId: string
  currency: string | null
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add recurring bill</DialogTitle>
          <DialogDescription>
            A non-rent charge billed on a cycle (waste, water, service charge…). Rent lives on the lease.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AddBillInner unitId={unitId} currency={currency} onClose={onClose} onSaved={onSaved} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AddBillInner({
  unitId,
  currency,
  onClose,
  onSaved,
}: {
  unitId: string
  currency: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Values>(() => ({
    name: '',
    chargeType: '',
    amount: '',
    frequency: 'MONTHLY',
    startDate: today(),
    endDate: '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const sections: FormSection[] = [
    {
      id: 'bill',
      title: 'Bill',
      columns: 2,
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, colSpan: 2, helperText: 'e.g. “Waste collection”' },
        { name: 'chargeType', label: 'Type', type: 'select', required: true, colSpan: 1, options: NON_RENT_CHARGE_TYPES },
        { name: 'amount', label: 'Amount', type: 'number', required: true, colSpan: 1, helperText: currency ? `In ${currency}` : undefined },
        { name: 'frequency', label: 'Collected', type: 'select', required: true, colSpan: 1, options: BILLING_FREQUENCIES },
        { name: 'startDate', label: 'Starts', type: 'date', required: true, colSpan: 1 },
        { name: 'endDate', label: 'Ends (optional)', type: 'date', colSpan: 2, helperText: 'Blank = until cancelled' },
      ],
    },
  ]

  const handleSubmit = async (v: Values) => {
    const errs: Record<string, string> = {}
    if (!String(v.name ?? '').trim()) errs.name = 'Name is required'
    if (!v.chargeType) errs.chargeType = 'Pick a bill type'
    const n = Number(v.amount)
    if (!Number.isFinite(n) || n < 0) errs.amount = 'Enter a non-negative amount'
    if (!v.startDate) errs.startDate = 'Start date is required'
    if (v.endDate && v.startDate && new Date(String(v.endDate)) <= new Date(String(v.startDate))) {
      errs.endDate = 'End date must be after the start date'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const res = await fetch(`/api/units/${unitId}/charge-schedules`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(v.name).trim(),
          chargeType: v.chargeType,
          amount: n,
          frequency: v.frequency,
          startDate: v.startDate,
          endDate: v.endDate ? v.endDate : null,
          currency: currency ?? undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not add bill')
        setSaving(false)
        return
      }
      toast.success('Recurring bill added')
      onSaved()
      onClose()
    } catch {
      toast.error('Network error — nothing was saved')
      setSaving(false)
    }
  }

  return (
    <UniversalForm
      title="Add recurring bill"
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
      primaryLabel="Add bill"
      bare
      formClassName="w-full"
    />
  )
}
