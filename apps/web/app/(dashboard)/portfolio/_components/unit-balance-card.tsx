'use client'

/**
 * UnitBalanceCard — per-unit open charges + settled total (Slice 3b).
 * Reads GET /api/charges?unitId=… (derived balance per row) and shows a
 * pending/paid summary with a "Mark payment" action that opens the
 * RecordPaymentDialog (oldest-first multi-month allocation server-side).
 */

import { useCallback, useEffect, useState } from 'react'
import { Banknote } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { chargeTypeLabel } from '@/lib/domain/charge-constants'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { RecordPaymentDialog } from '@/app/(dashboard)/leasing/_components/record-payment-dialog'

type ChargeRow = {
  id: string
  chargeType: string
  title: string
  amount: string
  balance: string
  currency: string
  dueDate: string | null
  billingPeriodStart: string | null
  postedAt: string | null
  overdue: boolean
  overdueDays: number
}

function money(amount: string, currency: string) {
  const n = Number(amount)
  return `${currency} ${n.toLocaleString()}`
}

export function UnitBalanceCard({
  propertyId,
  unitId,
  tenantId,
  leaseId,
}: {
  propertyId: string
  unitId: string
  tenantId?: string | null
  leaseId?: string | null
}) {
  const { hasUiPermission } = useUiPermission()
  const allowed = hasUiPermission('charge.list')
  const [charges, setCharges] = useState<ChargeRow[] | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)

  const load = useCallback(() => {
    if (!allowed) return
    let cancelled = false
    fetch(`/api/charges?unitId=${encodeURIComponent(unitId)}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return { charges: [] as ChargeRow[] }
        const data = await res.json().catch(() => ({}))
        return data as { charges: ChargeRow[] }
      })
      .then((data) => {
        if (!cancelled) setCharges(data.charges ?? [])
      })
      .catch(() => {
        if (!cancelled) setCharges([])
      })
    return () => {
      cancelled = true
    }
  }, [unitId, allowed])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  if (!allowed) return null

  const open = (charges ?? []).filter((c) => Number(c.balance) > 0.009)
  const pending = open.reduce((s, c) => s + Number(c.balance), 0)
  const overdueRows = open.filter((c) => c.overdue)
  const overdue = overdueRows.reduce((s, c) => s + Number(c.balance), 0)
  const overdueDays = overdueRows.reduce((m, c) => Math.max(m, c.overdueDays ?? 0), 0)
  const currency = charges?.[0]?.currency ?? 'KES'

  return (
    <Card variant="outlined">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Banknote size={16} aria-hidden /> Balance
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {money(pending.toFixed(2), currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {open.length === 0
                ? 'No open charges — this unit is settled'
                : `${open.length} open charge${open.length === 1 ? '' : 's'}`}
            </p>
            {overdue > 0.009 ? (
              <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
                {money(overdue.toFixed(2), currency)} overdue · {overdueDays}d
              </p>
            ) : null}
          </div>
          {hasUiPermission('payment.create') ? (
            <Button variant="outline" size="sm" onClick={() => setRecordOpen(true)}>
              Mark payment
            </Button>
          ) : null}
        </div>

        {open.length > 0 ? (
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {open.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {chargeTypeLabel(c.chargeType)}
                    {c.dueDate ? ` · due ${formatDate(c.dueDate)}` : ''}
                  </p>
                </div>
                <Badge variant={c.overdue ? 'error' : 'warning'} size="sm">
                  {money(c.balance, c.currency)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}

        {recordOpen ? (
          <RecordPaymentDialog
            open={recordOpen}
            propertyId={propertyId}
            unitId={unitId}
            tenantId={tenantId ?? null}
            leaseId={leaseId ?? null}
            defaultAccountType="RENT"
            onClose={() => setRecordOpen(false)}
            onRecorded={load}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
