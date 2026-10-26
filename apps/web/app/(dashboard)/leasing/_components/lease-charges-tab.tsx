'use client'

/**
 * Lease detail — Charges tab (Slice 8, plan §5). Shows the lease's posted
 * charges with derived open/overdue balances, a balance strip and the
 * record-payment / new-charge actions. GET /api/charges?leaseId=…
 */

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { chargeTypeLabel } from '@/lib/domain/charge-constants'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { RecordPaymentDialog } from '@/app/(dashboard)/leasing/_components/record-payment-dialog'
import { ChargeDialog } from '@/app/(dashboard)/finances/_components/charge-dialog'

type ChargeRow = {
  id: string
  chargeType: string
  title: string | null
  amount: string
  currency: string
  dueDate: string
  billingPeriodStart: string | null
  invoiceNumber: string | null
  balance: string
  overdue: boolean
  overdueDays?: number
}

type Props = {
  leaseId: string
  propertyId: string
  unitId: string | null
  tenantId: string | null
  currency: string
}

function money(amount: string, currency: string) {
  const n = Number(amount)
  return `${currency} ${n.toLocaleString()}`
}

export function LeaseChargesTab({ leaseId, propertyId, unitId, tenantId, currency }: Props) {
  const { hasUiPermission } = useUiPermission()
  const [charges, setCharges] = useState<ChargeRow[] | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)
  const [chargeOpen, setChargeOpen] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/charges?leaseId=${encodeURIComponent(leaseId)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load charges')
        return (data.charges ?? []) as ChargeRow[]
      })
      .then((list) => {
        if (!cancelled) setCharges(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load charges')
      })
    return () => {
      cancelled = true
    }
  }, [leaseId])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  if (charges === null) return <PageLoader title="Loading charges…" description="" />

  const open = charges.filter((c) => Number(c.balance) > 0.009)
  const overdue = open.filter((c) => c.overdue)
  const openTotal = open.reduce((s, c) => s + Number(c.balance), 0)
  const overdueTotal = overdue.reduce((s, c) => s + Number(c.balance), 0)
  const paidTotal = charges.reduce((s, c) => s + Number(c.amount) - Number(c.balance), 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card variant="outlined" size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Open balance</p>
            <p className="text-lg font-semibold tabular-nums">{money(openTotal.toFixed(2), currency)}</p>
            <p className="text-xs text-muted-foreground">{open.length} open charge{open.length === 1 ? '' : 's'}</p>
          </CardContent>
        </Card>
        <Card variant="outlined" size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-lg font-semibold tabular-nums text-red-700 dark:text-red-300">
              {money(overdueTotal.toFixed(2), currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {overdue.length} past due{overdue.length > 0 ? ` · ${Math.max(...overdue.map((c) => c.overdueDays ?? 0))}d oldest` : ''}
            </p>
          </CardContent>
        </Card>
        <Card variant="outlined" size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Settled</p>
            <p className="text-lg font-semibold tabular-nums">{money(paidTotal.toFixed(2), currency)}</p>
            <p className="text-xs text-muted-foreground">{charges.length} charge{charges.length === 1 ? '' : 's'} total</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Charges posted to this lease — balance is what is still unallocated after payments and approved adjustments.
        </p>
        <div className="flex gap-2">
          {hasUiPermission('charge.create') ? (
            <Button variant="outline" size="sm" onClick={() => setChargeOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New charge
            </Button>
          ) : null}
          {hasUiPermission('payment.create') ? (
            <Button variant="primary" size="sm" onClick={() => setRecordOpen(true)}>
              Record payment
            </Button>
          ) : null}
        </div>
      </div>

      {charges.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No charges on this lease yet — rent posts automatically from the schedule.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Charge</th>
                <th className="px-4 py-2 font-medium">Invoice</th>
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {charges.map((c) => {
                const bal = Number(c.balance)
                const settled = bal <= 0.009
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2">
                      <p className="font-medium">{c.title ?? chargeTypeLabel(c.chargeType)}</p>
                      <p className="text-xs text-muted-foreground">{chargeTypeLabel(c.chargeType)}</p>
                    </td>
                    <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                      {c.invoiceNumber ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {c.billingPeriodStart ? formatDate(c.billingPeriodStart) : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(c.dueDate)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(c.amount, c.currency)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {settled ? <span className="text-muted-foreground">—</span> : money(c.balance, c.currency)}
                    </td>
                    <td className="px-4 py-2">
                      {settled ? (
                        <Badge variant="success" size="sm">
                          Paid
                        </Badge>
                      ) : c.overdue ? (
                        <Badge variant="error" size="sm">
                          Overdue{c.overdueDays ? ` ${c.overdueDays}d` : ''}
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Due
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {recordOpen ? (
        <RecordPaymentDialog
          open={recordOpen}
          propertyId={propertyId}
          unitId={unitId}
          tenantId={tenantId}
          leaseId={leaseId}
          defaultAccountType="RENT"
          onClose={() => setRecordOpen(false)}
          onRecorded={load}
        />
      ) : null}
      <ChargeDialog
        open={chargeOpen}
        onClose={() => setChargeOpen(false)}
        onCreated={load}
        context={{ propertyId, unitId, tenantId, leaseId }}
      />
    </div>
  )
}
