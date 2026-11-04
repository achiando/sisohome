'use client'

/* ── /reports — thin dashboard aggregates (roadmap Phase 5) ───────────────────────
 * UI gate: audit.read via hasUiPermission (nav hides entry for unauthorized).
 * Server gate: apiRoute permissions: 'audit.read' (enforced on every request).
 *--------------------------------------------------------------------------*/

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { PageLoader } from '@workspace/ui/components/loader'
import { downloadCsv } from '@/lib/csv'
import { formatMoney } from '@/app/(dashboard)/_components/domain/format'
import { cn } from '@workspace/ui/lib/utils'

export default function ReportsPage() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // UI permission gate — nav hides entry when user lacks audit.read,
  // but we double‑guard here so unauthful direct navigation shows ScopeDenied.
  const { hasUiPermission } = useUiPermission()
  if (!hasUiPermission('audit.read')) return <ScopeDenied />

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/reports/summary', { credentials: 'include' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: { summary: any } = await res.json()
        setSummary(json.summary)
      } catch (e) {
        console.error('Reports summary fetch error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <PageLoader title="Loading Reports" />
  if (!summary) return <p>Failed to load reports data.</p>

  /*******************************
   * Helper: per‑section CSV data
   *******************************/
  // 1. Occupancy CSV
  const occColumns = [
    { header: 'Metric', value: (r: any) => r.Metric },
    { header: 'Value', value: (r: any) => r.Value },
  ]
  const occRows = [
    { Metric: 'Occupied', Value: String(summary.occupancy.occupied) },
    { Metric: 'Vacant', Value: String(summary.occupancy.vacant) },
    { Metric: 'Total', Value: String(summary.occupancy.total) },
    { Metric: 'Occupancy rate', Value: `${summary.occupancy.rate}%` },
  ]

  // 2. Dues aging CSV
  const duesColumns = [
    { header: 'Bucket', value: (r: any) => r.bucket },
    { header: 'Tenants', value: (r: any) => String(r.tenants) },
    { header: 'Open', value: (r: any) => `KES ${r.open}` },
  ]
  const duesRows = summary.dues.buckets.map((b: any) => ({
    bucket: b.bucket,
    tenants: b.tenants,
    open: b.open,
  }))

  // 3. Month payments CSV
  const payColumns = [
    { header: 'Currency', value: (r: any) => r.currency },
    { header: 'Count', value: (r: any) => String(r.count) },
    { header: 'Total', value: (r: any) => `KES ${r.total}` },
  ]
  const payRows = summary.monthPayments.byCurrency.map((c: any) => ({
    currency: c.currency,
    count: c.count,
    total: c.total,
  }))

  // 4. Open tickets CSV
  const tickColumns = [
    { header: 'Status', value: (r: any) => r.status },
    { header: 'Count', value: (r: any) => String(r.count) },
  ]
  const tickRows = summary.openTickets.byStatus.map((s: any) => ({
    status: s.status,
    count: String(s.count),
  }))

  // 5. Live listings CSV
  const listColumns = [
    { header: 'Metric', value: (r: any) => r.Metric },
    { header: 'Value', value: (r: any) => r.Value },
  ]
  const listRows = [{ Metric: 'Live listings', Value: String(summary.liveListings.count) }]

  /*******************************
   * Render 5 cards
   *******************************/
  return (
    <div className="space-y-6">
      {/* ── Occupancy ─────────────────────────────────────── */}
      <Card variant="elevated" className="p-4">
        <CardHeader>
          <CardTitle>Occupancy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium">
            {summary.occupancy.occupied} of {summary.occupancy.total} units occupied
          </p>
          <p className="text-sm text-muted-foreground">
            {summary.occupancy.vacant} vacant · {summary.occupancy.rate}% occupancy rate
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv('reports-occupancy', occColumns, occRows)}
            className="flex items-center gap-1">
            <Download className="h-3 w-3" aria-hidden="true" />
            Export CSV
          </Button>
          <a href="/units" className={cn("text-primary", "hover:underline", "transition-colors")}>
            Open units register →
          </a>
        </CardFooter>
      </Card>

      {/* ── Dues aging ────────────────────────────────────── */}
      <Card variant="elevated" className="p-4">
        <CardHeader>
          <CardTitle>Dues Aging</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium">
            Outstanding: {formatMoney(summary.dues.outstanding)} · Overdue: {formatMoney(summary.dues.overdue)} ·
            {summary.dues.overdueCount} overdue · {summary.dues.tenantCount} tenants
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv('reports-dues', duesColumns, duesRows)}
            className="flex items-center gap-1">
            <Download className="h-3 w-3" aria-hidden="true" />
            Export CSV
          </Button>
          <a href="/finances" className={cn("text-primary", "hover:underline", "transition-colors")}>
            Open finances →
          </a>
        </CardFooter>
      </Card>

      {/* ── Payments this month ───────────────────────────── */}
      <Card variant="elevated" className="p-4">
        <CardHeader>
          <CardTitle>Payments This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium">
            {summary.monthPayments.count} payments received
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv('reports-payments', payColumns, payRows)}
            className="flex items-center gap-1">
            <Download className="h-3 w-3" aria-hidden="true" />
            Export CSV
          </Button>
          <a href="/finances" className={cn("text-primary", "hover:underline", "transition-colors")}>
            Open finances →
          </a>
        </CardFooter>
      </Card>

      {/* ── Open tickets ──────────────────────────────────── */}
      <Card variant="elevated" className="p-4">
        <CardHeader>
          <CardTitle>Open Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium">
            {summary.openTickets.count} open tickets
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv('reports-tickets', tickColumns, tickRows)}
            className="flex items-center gap-1">
            <Download className="h-3 w-3" aria-hidden="true" />
            Export CSV
          </Button>
          <a href="/maintenance" className={cn("text-primary", "hover:underline", "transition-colors")}>
            Open maintenance →
          </a>
        </CardFooter>
      </Card>

      {/* ── Live listings ─────────────────────────────────── */}
      <Card variant="elevated" className="p-4">
        <CardHeader>
          <CardTitle>Live Listings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium">
            {summary.liveListings.count} live listings
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv('reports-listings', listColumns, listRows)}
            className="flex items-center gap-1">
            <Download className="h-3 w-3" aria-hidden="true" />
            Export CSV
          </Button>
          <a href="/sales/listings" className={cn("text-primary", "hover:underline", "transition-colors")}>
            Open listings →
          </a>
        </CardFooter>
      </Card>
    </div>
  )
}