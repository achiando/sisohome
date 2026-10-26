'use client'

/**
 * Rent roll tab (property detail, Slice 8) — one row per unit: occupancy,
 * lease rent, open/overdue balances and a rolled state badge, grouped by
 * building with per-building subtotals and a grand total row.
 * GET /api/properties/[id]/rent-roll.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import type { CsvColumn } from '@/lib/csv'
import { ExportCsvButton } from '@/app/(dashboard)/finances/_components/export-csv-button'

type RentRollRow = {
  unitId: string
  unitRef: string
  label: string
  buildingId: string | null
  buildingName: string | null
  occupancy: 'OCCUPIED' | 'VACANT'
  tenantId: string | null
  tenantName: string | null
  leaseEndsAt: string | null
  monthlyRent: string
  openBalance: string
  overdueBalance: string
  state: string
}

type Building = {
  buildingId: string | null
  name: string
  units: number
  occupied: number
  vacant: number
  monthlyRent: string
  openBalance: string
  overdueBalance: string
}

type Totals = {
  units: number
  occupied: number
  vacant: number
  monthlyRent: string
  openBalance: string
  overdueBalance: string
}

type Result = {
  totals: Totals
  buildings: Building[]
  rows: RentRollRow[]
}

const STATE_TONE: Record<string, 'neutral' | 'error' | 'warning' | 'success' | 'info'> = {
  VACANT: 'neutral',
  OVERDUE: 'error',
  DUE: 'warning',
  PAID: 'success',
  NO_CHARGES: 'info',
}

const STATE_LABEL: Record<string, string> = {
  VACANT: 'Vacant',
  OVERDUE: 'Overdue',
  DUE: 'Due',
  PAID: 'Paid',
  NO_CHARGES: 'No charges',
}

function money(amount: string, currency: string) {
  const n = Number(amount)
  return `${currency} ${n.toLocaleString()}`
}


function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card variant="outlined" size="sm">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  )
}

export function RentRollTab({ propertyId, currency }: { propertyId: string; currency?: string | null }) {
  const router = useRouter()
  const [data, setData] = useState<Result | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/properties/${propertyId}/rent-roll`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load rent roll')
        return data as Result
      })
      .then((d) => {
        if (!cancelled) setData({ totals: d.totals, buildings: d.buildings, rows: d.rows })
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load rent roll')
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  if (data === null) return <PageLoader title="Loading rent roll…" description="" />

  const cur = currency ?? 'KES'
  const { totals, buildings, rows } = data
  const csvColumns: CsvColumn<RentRollRow>[] = [
    { header: 'Building', value: (r) => r.buildingName ?? 'No building' },
    { header: 'Unit', value: (r) => r.unitRef },
    { header: 'Label', value: (r) => r.label },
    { header: 'Occupancy', value: (r) => r.occupancy },
    { header: 'Tenant', value: (r) => r.tenantName },
    { header: 'Lease ends', value: (r) => r.leaseEndsAt },
    { header: 'Rent / month', value: (r) => r.monthlyRent },
    { header: 'Open balance', value: (r) => r.openBalance },
    { header: 'Overdue', value: (r) => r.overdueBalance },
    { header: 'State', value: (r) => r.state },
    { header: 'Currency', value: () => cur },
  ]
  const rowsByBuilding = new Map<string, RentRollRow[]>()
  for (const r of rows) {
    const key = r.buildingId ?? '__none__'
    const list = rowsByBuilding.get(key) ?? []
    list.push(r)
    rowsByBuilding.set(key, list)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tile label="Units" value={String(totals.units)} sub={`${totals.occupied} occupied · ${totals.vacant} vacant`} />
        <Tile label="Rent roll / month" value={money(totals.monthlyRent, cur)} sub="Contracted rent on occupied units" />
        <Tile label="Open balance" value={money(totals.openBalance, cur)} sub="Unsettled charges across the property" />
        <Tile label="Overdue" value={money(totals.overdueBalance, cur)} sub="Past-due portion of the open balance" />
      </div>

      <div className="flex justify-end">
        <ExportCsvButton filename="rent-roll" columns={csvColumns} rows={rows} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Unit</th>
              <th className="px-4 py-2 font-medium">Tenant</th>
              <th className="px-4 py-2 font-medium">Rent / month</th>
              <th className="px-4 py-2 text-right font-medium">Open</th>
              <th className="px-4 py-2 text-right font-medium">Overdue</th>
              <th className="px-4 py-2 font-medium">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {buildings.map((b) => {
              const list = rowsByBuilding.get(b.buildingId ?? '__none__') ?? []
              return (
                <>
                  <tr key={`h-${b.buildingId ?? 'none'}`} className="bg-muted/40">
                    <td colSpan={6} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide">
                      {b.name}
                      <span className="ml-2 font-normal normal-case text-muted-foreground">
                        {b.units} units · {b.occupied} occupied
                      </span>
                    </td>
                  </tr>
                  {list.map((r) => (
                    <tr
                      key={r.unitId}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => router.push(`/portfolio/${propertyId}/units/${r.unitId}`)}
                    >
                      <td className="px-4 py-2">
                        <span className="font-medium">{r.label || r.unitRef}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{r.unitRef}</span>
                      </td>
                      <td className="px-4 py-2">
                        {r.tenantName ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {Number(r.monthlyRent) > 0 ? money(r.monthlyRent, cur) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {Number(r.openBalance) > 0.009 ? money(r.openBalance, cur) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {Number(r.overdueBalance) > 0.009 ? (
                          <span className="font-medium text-red-700 dark:text-red-300">
                            {money(r.overdueBalance, cur)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={STATE_TONE[r.state] ?? 'neutral'} size="sm">
                          {STATE_LABEL[r.state] ?? r.state}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  <tr key={`s-${b.buildingId ?? 'none'}`} className="bg-muted/20 text-xs">
                    <td className="px-4 py-1.5 font-medium" colSpan={2}>
                      Subtotal — {b.name}
                    </td>
                    <td className="px-4 py-1.5 tabular-nums">{money(b.monthlyRent, cur)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{money(b.openBalance, cur)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{money(b.overdueBalance, cur)}</td>
                    <td />
                  </tr>
                </>
              )
            })}
            <tr className="border-t-2 border-border text-sm font-semibold">
              <td className="px-4 py-2.5" colSpan={2}>
                Grand total
              </td>
              <td className="px-4 py-2.5 tabular-nums">{money(totals.monthlyRent, cur)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{money(totals.openBalance, cur)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{money(totals.overdueBalance, cur)}</td>
              <td className="px-4 py-2.5">
                <Badge variant={totals.vacant > 0 ? 'warning' : 'success'} size="sm">
                  {totals.vacant} vacant
                </Badge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
