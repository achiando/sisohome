'use client'

/**
 * TenantPaymentsTab — payments this tenant has made, split rent vs utilities
 * (Slice 3), plus month-by-month tracking and receipts (Slice 3b).
 *
 * - KPI tiles + payment list from GET /api/payments?tenantId=…
 * - "Record payment" opens RecordPaymentDialog for the active lease
 *   (oldest-first multi-month allocation server-side).
 * - Rent-by-month matrix from GET /api/ledger/monthly?tenantId=…
 * - "Issue receipt" per payment (receipt.issue), idempotent server-side.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, Plus, Receipt, Zap } from 'lucide-react'
import { toast } from '@workspace/ui/components/toast'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { RecordPaymentDialog } from './record-payment-dialog'
import { useUiPermission } from '@/components/shell/use-ui-permission'

type PaymentRow = {
  id: string
  amount: string
  currency: string
  method: string
  reference: string | null
  receivedAt: string
  reconciledAt: string | null
  account: { id: string; accountType: string; name: string } | null
  unit: { id: string; unitRef: string } | null
}

type Breakdown = {
  rent: { count: number; total: string }
  utilities: { count: number; total: string }
  total: string
}

type LeaseCtx = {
  id: string
  status: string
  property: { id: string; name: string }
  units: { unit: { id: string; unitRef: string; label: string | null } }[]
}

type MonthRow = {
  month: string
  rent: { billed: string; paid: string; status: string }
  utilities: { billed: string; paid: string; status: string }
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
}

const STATUS_TONE: Record<string, string> = {
  PAID: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  PARTIAL: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  PENDING: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  NONE: 'bg-muted text-muted-foreground',
}

function money(amount: string, currency: string) {
  const n = Number(amount)
  return `${currency} ${n.toLocaleString()}`
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const idx = Number(mo) - 1
  return `${names[idx] ?? mo} ${y}`
}

function monthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 7)
}

export function TenantPaymentsTab({
  tenantId,
  leases,
}: {
  tenantId: string
  leases: LeaseCtx[]
}) {
  const { hasUiPermission } = useUiPermission()
  const [payments, setPayments] = useState<PaymentRow[] | null>(null)
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [months, setMonths] = useState<MonthRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)

  const activeLease = useMemo(
    () => leases.find((l) => l.status === 'ACTIVE' || l.status === 'ENDING') ?? null,
    [leases],
  )
  const propertyId = activeLease?.property.id ?? null
  const leaseUnit = activeLease?.units[0]?.unit ?? null

  const load = useCallback(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/payments?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'include' }).then(
        async (res) => {
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error ?? 'Failed to load payments')
          return data as { payments: PaymentRow[]; breakdown: Breakdown }
        },
      ),
      fetch(
        `/api/ledger/monthly?tenantId=${encodeURIComponent(tenantId)}&from=${monthsAgo(11)}&to=${monthsAgo(0)}`,
        { credentials: 'include' },
      )
        .then(async (res) => {
          if (!res.ok) return { months: [] as MonthRow[] }
          const data = await res.json().catch(() => ({}))
          return data as { months: MonthRow[] }
        })
        .catch(() => ({ months: [] as MonthRow[] })),
    ])
      .then(([p, m]) => {
        if (cancelled) return
        setPayments(p.payments ?? [])
        setBreakdown(p.breakdown ?? null)
        setMonths(m.months ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load payments')
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  const issueReceipt = useCallback(
    async (paymentId: string) => {
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
        toast.success(`Receipt ${data.receipt?.receiptNumber ?? ''} issued`)
      } catch {
        toast.error('Network error — receipt not issued')
      }
    },
    [],
  )

  if (error) {
    return <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-destructive shadow-xs">{error}</p>
  }
  if (payments === null) return <PageLoader title="Loading payments…" description="" />

  const tiles = [
    { label: 'Rent collected', value: breakdown?.rent.total ?? '0', icon: Banknote, sub: breakdown ? `${breakdown.rent.count} payments` : '' },
    { label: 'Utilities collected', value: breakdown?.utilities.total ?? '0', icon: Zap, sub: breakdown ? `${breakdown.utilities.count} payments` : '' },
    { label: 'Total received', value: breakdown?.total ?? '0', icon: Receipt, sub: `${payments.length} payments` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Payments and month-by-month rent status</p>
        {hasUiPermission('payment.create') && propertyId ? (
          <Button size="sm" onClick={() => setRecordOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Record payment
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} variant="outlined" size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <t.icon className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="text-lg font-semibold tabular-nums">{money(t.value, payments[0]?.currency ?? 'KES')}</p>
                {t.sub ? <p className="text-xs text-muted-foreground">{t.sub}</p> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {months && months.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Month</th>
                <th className="px-4 py-2 font-medium">Rent billed</th>
                <th className="px-4 py-2 font-medium">Rent paid</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {months
                .filter((m) => Number(m.rent.billed) > 0 || Number(m.rent.paid) > 0)
                .map((m) => (
                  <tr key={m.month}>
                    <td className="px-4 py-2 font-medium">{monthLabel(m.month)}</td>
                    <td className="px-4 py-2 tabular-nums">{money(m.rent.billed, payments[0]?.currency ?? 'KES')}</td>
                    <td className="px-4 py-2 tabular-nums">{money(m.rent.paid, payments[0]?.currency ?? 'KES')}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[m.rent.status] ?? STATUS_TONE.NONE}`}>
                        {m.rent.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {payments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-xs">
          No payments recorded for this tenant yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-xs">
          {payments.map((p) => {
            const isUtilities = p.account?.accountType === 'UTILITIES'
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={isUtilities ? 'info' : 'default'} size="sm">
                      {isUtilities ? 'Utilities' : 'Rent'}
                    </Badge>
                    <span className="truncate text-sm font-medium">{money(p.amount, p.currency)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(p.receivedAt)} · {METHOD_LABEL[p.method] ?? p.method}
                    {p.reference ? ` · ${p.reference}` : ''}
                    {p.unit ? ` · ${p.unit.unitRef}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.reconciledAt ? (
                    <Badge variant="success" size="sm">Reconciled</Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">Unreconciled</Badge>
                  )}
                  {hasUiPermission('receipt.issue') ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => issueReceipt(p.id)}
                      aria-label="Issue receipt"
                    >
                      <Receipt className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {propertyId ? (
        <RecordPaymentDialog
          open={recordOpen}
          propertyId={propertyId}
          unitId={leaseUnit?.id ?? null}
          tenantId={tenantId}
          leaseId={activeLease?.id ?? null}
          onClose={() => setRecordOpen(false)}
          onRecorded={load}
        />
      ) : null}
    </div>
  )
}
