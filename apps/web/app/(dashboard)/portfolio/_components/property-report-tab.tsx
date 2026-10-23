'use client'

/**
 * PropertyReportTab — the property-manager monthly report (Slice 3b).
 * Month-by-month billed vs paid for rent + utilities over a rolling window,
 * plus a "Generate month" action (POST /api/charges/generate) that creates
 * one month's rent from active leases + utility bills from unit schedules.
 * Idempotent server-side — regenerating a month is a no-op for existing rows.
 */

import { useCallback, useEffect, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { toast } from '@workspace/ui/components/toast'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { useUiPermission } from '@/components/shell/use-ui-permission'

type MonthRow = {
  month: string
  rent: { billed: string; paid: string; status: string }
  utilities: { billed: string; paid: string; status: string }
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
  return `${names[Number(mo) - 1] ?? mo} ${y}`
}

function monthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 7)
}

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function PropertyReportTab({
  propertyId,
  currency,
}: {
  propertyId: string
  currency: string | null
}) {
  const { hasUiPermission } = useUiPermission()
  const canRead = hasUiPermission('charge.list')
  const canCreate = hasUiPermission('charge.create')
  const [rows, setRows] = useState<MonthRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(() => {
    if (!canRead) return
    let cancelled = false
    fetch(
      `/api/ledger/monthly?propertyId=${encodeURIComponent(propertyId)}&from=${monthsAgo(11)}&to=${monthsAgo(0)}`,
      { credentials: 'include' },
    )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load report')
        return data as { months: MonthRow[] }
      })
      .then((data) => {
        if (!cancelled) setRows(data.months ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report')
      })
    return () => {
      cancelled = true
    }
  }, [propertyId, canRead])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  const generateMonth = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/charges/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, month: thisMonth() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not generate charges')
        return
      }
      const r = data.result ?? {}
      toast.success(
        `Generated ${r.month ?? thisMonth()}: ${r.rentCreated ?? 0} rent, ${r.utilitiesCreated ?? 0} utility charges`,
      )
      load()
    } catch {
      toast.error('Network error — nothing was generated')
    } finally {
      setGenerating(false)
    }
  }, [propertyId, load])

  if (!canRead) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-xs">
        You need the charge.list permission to view the monthly report.
      </p>
    )
  }
  if (error) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-destructive shadow-xs">
        {error}
      </p>
    )
  }
  if (rows === null) return <PageLoader title="Loading report…" description="" />

  const cur = currency ?? 'KES'
  const totals = rows.reduce(
    (acc, m) => ({
      rentBilled: acc.rentBilled + Number(m.rent.billed),
      rentPaid: acc.rentPaid + Number(m.rent.paid),
      utilBilled: acc.utilBilled + Number(m.utilities.billed),
      utilPaid: acc.utilPaid + Number(m.utilities.paid),
    }),
    { rentBilled: 0, rentPaid: 0, utilBilled: 0, utilPaid: 0 },
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Billed vs collected, last {rows.length} months (cash basis)
        </p>
        {canCreate ? (
          <Button size="sm" disabled={generating} onClick={generateMonth}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            {generating ? 'Generating…' : 'Generate this month'}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Rent billed', value: totals.rentBilled },
          { label: 'Rent collected', value: totals.rentPaid },
          { label: 'Utilities billed', value: totals.utilBilled },
          { label: 'Utilities collected', value: totals.utilPaid },
        ].map((t) => (
          <Card key={t.label} variant="outlined" size="sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-lg font-semibold tabular-nums">{money(t.value.toFixed(2), cur)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Month</th>
              <th className="px-4 py-2 font-medium">Rent billed</th>
              <th className="px-4 py-2 font-medium">Rent paid</th>
              <th className="px-4 py-2 font-medium">Rent status</th>
              <th className="px-4 py-2 font-medium">Utilities billed</th>
              <th className="px-4 py-2 font-medium">Utilities paid</th>
              <th className="px-4 py-2 font-medium">Utilities status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((m) => (
              <tr key={m.month}>
                <td className="px-4 py-2 font-medium">{monthLabel(m.month)}</td>
                <td className="px-4 py-2 tabular-nums">{money(m.rent.billed, cur)}</td>
                <td className="px-4 py-2 tabular-nums">{money(m.rent.paid, cur)}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[m.rent.status] ?? STATUS_TONE.NONE}`}>
                    {m.rent.status}
                  </span>
                </td>
                <td className="px-4 py-2 tabular-nums">{money(m.utilities.billed, cur)}</td>
                <td className="px-4 py-2 tabular-nums">{money(m.utilities.paid, cur)}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[m.utilities.status] ?? STATUS_TONE.NONE}`}>
                    {m.utilities.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
