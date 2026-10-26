'use client'

/**
 * Payments tab — payment register with rent/utilities breakdown tiles
 * (Slice 8). "Record payment" cascades property → unit (the API needs a
 * unit/tenant/lease anchor), then opens the shared RecordPaymentDialog.
 * Row action "Issue receipt" (receipt.issue) mints RE-… evidence.
 */

import { useCallback, useEffect, useState } from 'react'
import { Banknote, Plus, Receipt, Zap } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { PageLoader } from '@workspace/ui/components/loader'
import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { RecordPaymentDialog } from '@/app/(dashboard)/leasing/_components/record-payment-dialog'
import { usePropertyOptions, type Option } from './doc-dialogs'

type PaymentRow = {
  id: string
  amount: string
  currency: string
  method: string
  reference: string | null
  receivedAt: string
  reconciledAt: string | null
  allocatedTotal: string
  account: { id: string; accountType: string; name: string } | null
  tenant: { id: string; displayName: string } | null
  unit: { id: string; unitRef: string } | null
  leaseId: string | null
  propertyId: string
}

type Breakdown = {
  rent: { count: number; total: string }
  utilities: { count: number; total: string }
  total: string
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
}

function money(amount: string, currency: string) {
  const n = Number(amount)
  return `${currency} ${n.toLocaleString()}`
}

/** Step 1 of Record payment: pick the property + unit to settle. */
function RecordPicker({
  open,
  onClose,
  onPicked,
}: {
  open: boolean
  onClose: () => void
  onPicked: (propertyId: string, unitId: string) => void
}) {
  const propertyOptions = usePropertyOptions()
  const [propertyId, setPropertyId] = useState('')
  const [units, setUnits] = useState<Option[]>([])
  const [unitId, setUnitId] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    fetch(`/api/units?propertyId=${encodeURIComponent(propertyId)}`, { credentials: 'include' })
      .then(async (res) => (res.ok ? res.json() : { units: [] }))
      .then((data: { units?: { id: string; unitRef: string; label: string | null }[] }) => {
        if (!cancelled) {
          setUnits((data.units ?? []).map((u) => ({ value: u.id, label: u.label ?? u.unitRef })))
        }
      })
      .catch(() => {
        if (!cancelled) setUnits([])
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Pick the property and unit first — payments anchor to a unit (rent or utilities).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Property</span>
            <select
              className="h-11 w-full rounded-xl border border-input bg-background px-3"
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value)
                setUnits([])
                setUnitId('')
                setError(null)
              }}
            >
              <option value="">Select a property</option>
              {propertyOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Unit</span>
            <select
              className="h-11 w-full rounded-xl border border-input bg-background px-3 disabled:opacity-50"
              value={unitId}
              disabled={!propertyId}
              onChange={(e) => {
                setUnitId(e.target.value)
                setError(null)
              }}
            >
              <option value="">{propertyId ? 'Select a unit' : 'Pick a property first'}</option>
              {units.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!propertyId || !unitId) {
                setError('Pick a property and unit')
                return
              }
              onPicked(propertyId, unitId)
            }}
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PaymentsTab() {
  const { hasUiPermission } = useUiPermission()
  const propertyOptions = usePropertyOptions()
  const [payments, setPayments] = useState<PaymentRow[] | null>(null)
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [propertyId, setPropertyId] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [target, setTarget] = useState<{ propertyId: string; unitId: string } | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    const qs = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''
    fetch(`/api/payments${qs}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load payments')
        return data as { payments: PaymentRow[]; breakdown: Breakdown }
      })
      .then((data) => {
        if (!cancelled) {
          setPayments(data.payments ?? [])
          setBreakdown(data.breakdown ?? null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load payments')
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  const issueReceipt = useCallback(async (paymentId: string) => {
    try {
      const res = await fetch(`/api/payments/${paymentId}/receipt`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not issue receipt')
        return
      }
      toast.success(`Receipt ${data.receipt?.receiptNumber ?? ''} issued — see the Receipts tab`)
    } catch {
      toast.error('Network error — receipt not issued')
    }
  }, [])

  if (payments === null) return <PageLoader title="Loading payments…" description="" />

  const currency = payments[0]?.currency ?? 'KES'
  const tiles = [
    { label: 'Rent collected', value: breakdown?.rent.total ?? '0', icon: Banknote, sub: breakdown ? `${breakdown.rent.count} payments` : '' },
    { label: 'Utilities collected', value: breakdown?.utilities.total ?? '0', icon: Zap, sub: breakdown ? `${breakdown.utilities.count} payments` : '' },
    { label: 'Total received', value: breakdown?.total ?? '0', icon: Receipt, sub: `${payments.length} payments` },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} variant="outlined" size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <t.icon className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="text-lg font-semibold tabular-nums">{money(t.value, currency)}</p>
                {t.sub ? <p className="truncate text-xs text-muted-foreground">{t.sub}</p> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ResponsiveDataListing<PaymentRow>
        title="Payments"
        hideHeaderOnMobile
        items={payments}
        loading={false}
        skeletonCount={5}
        count={payments.length}
        rowKey={(p) => p.id}
        columns={[
          {
            header: 'Received',
            cell: (p) => (
              <div className="min-w-0">
                <p className="text-sm font-medium">{formatDate(p.receivedAt)}</p>
                <p className="text-xs text-muted-foreground">{METHOD_LABEL[p.method] ?? p.method}</p>
              </div>
            ),
          },
          { header: 'Amount', cell: (p) => <span className="text-sm font-medium tabular-nums">{money(p.amount, p.currency)}</span> },
          {
            header: 'Reference',
            cell: (p) => <span className="text-sm text-muted-foreground">{p.reference ?? '—'}</span>,
          },
          {
            header: 'Party',
            cell: (p) => (
              <div className="min-w-0">
                <p className="truncate text-sm">{p.tenant?.displayName ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{p.unit ? p.unit.unitRef : 'Property-level'}</p>
              </div>
            ),
          },
          {
            header: 'Account',
            cell: (p) => (
              <Badge variant={p.account?.accountType === 'UTILITIES' ? 'info' : 'default'} size="sm">
                {p.account?.accountType === 'UTILITIES' ? 'Utilities' : 'Rent'}
              </Badge>
            ),
          },
          {
            header: 'Allocated',
            cell: (p) => <span className="text-sm tabular-nums text-muted-foreground">{money(p.allocatedTotal, p.currency)}</span>,
          },
          {
            header: 'State',
            cell: (p) =>
              p.reconciledAt ? (
                <Badge variant="success" size="sm">
                  Reconciled
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm">
                  Unreconciled
                </Badge>
              ),
          },
          {
            header: '',
            className: 'w-16',
            cell: (p) =>
              hasUiPermission('receipt.issue') ? (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => issueReceipt(p.id)}
                    aria-label="Issue receipt"
                  >
                    <Receipt className="size-4" aria-hidden="true" />
                    Receipt
                  </Button>
                </div>
              ) : null,
          },
        ]}
        cardMapper={{
          id: (p) => p.id,
          title: () => 'Payment',
          subtitle: (p) => `${formatDate(p.receivedAt)} · ${METHOD_LABEL[p.method] ?? p.method}`,
          amount: (p) => <span className="font-semibold tabular-nums">{money(p.amount, p.currency)}</span>,
          detailFields: (p) => [
            { label: 'Reference', value: p.reference ?? '—' },
            { label: 'Tenant', value: p.tenant?.displayName ?? '—' },
            { label: 'Unit', value: p.unit?.unitRef ?? '—' },
            { label: 'Allocated', value: money(p.allocatedTotal, p.currency) },
            { label: 'State', value: p.reconciledAt ? 'Reconciled' : 'Unreconciled' },
          ],
          actions: (p) =>
            hasUiPermission('receipt.issue')
              ? [{ label: 'Issue receipt', variant: 'outline' as const, onClick: () => issueReceipt(p.id) }]
              : [],
        }}
        filters={[
          {
            key: 'property',
            label: 'Property',
            value: propertyId,
            onChange: setPropertyId,
            options: [{ value: '', label: 'All properties' }, ...propertyOptions],
          },
        ]}
        filterChips
        emptyState={{
          icon: Banknote,
          title: 'No payments yet',
          description: 'Record a payment to start allocating against charges.',
        }}
        primaryAction={
          hasUiPermission('payment.create')
            ? { label: 'Record payment', icon: Plus, onClick: () => setPickerOpen(true) }
            : undefined
        }
      />

      <RecordPicker
        open={pickerOpen && !target}
        onClose={() => setPickerOpen(false)}
        onPicked={(pid, uid) => {
          setPickerOpen(false)
          setTarget({ propertyId: pid, unitId: uid })
        }}
      />
      {target ? (
        <RecordPaymentDialog
          open
          propertyId={target.propertyId}
          unitId={target.unitId}
          onClose={() => setTarget(null)}
          onRecorded={load}
        />
      ) : null}
    </div>
  )
}
