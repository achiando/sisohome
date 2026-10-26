'use client'

/**
 * Dues tab — tenant arrears (Slice 8). KPI totals from GET /api/dues plus
 * a tenant × property register with aging buckets; row opens the tenant.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, HandCoins, Hourglass } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { usePropertyOptions } from './doc-dialogs'

type DuesRow = {
  tenantId: string
  tenantName: string
  propertyId: string
  propertyName: string
  currency: string
  open: string
  overdue: string
  overdueCount: number
  chargeCount: number
  oldestDueDate: string | null
  ageDays: number
  bucket: string
}

type DuesTotals = {
  outstanding: string
  overdue: string
  dueThisMonth: string
  overdueCount: number
  tenantCount: number
  pendingAdjustments: number
  currency: string
}

const BUCKET_TONE: Record<string, 'success' | 'warning' | 'error'> = {
  CURRENT: 'success',
  '0-30': 'warning',
  '31-60': 'warning',
  '61-90': 'error',
  '90+': 'error',
}

function money(amount: string, currency: string) {
  const n = Number(amount)
  return `${currency} ${n.toLocaleString()}`
}

export function DuesTab() {
  const router = useRouter()
  const propertyOptions = usePropertyOptions()
  const [rows, setRows] = useState<DuesRow[] | null>(null)
  const [totals, setTotals] = useState<DuesTotals | null>(null)
  const [propertyId, setPropertyId] = useState('')
  const [view, setView] = useState('')

  const load = useCallback(() => {
    let cancelled = false
    const qs = new URLSearchParams()
    if (propertyId) qs.set('propertyId', propertyId)
    if (view === 'overdue') qs.set('overdueOnly', 'true')
    fetch(`/api/dues?${qs.toString()}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load dues')
        return data as { rows: DuesRow[]; totals: DuesTotals }
      })
      .then((data) => {
        if (!cancelled) {
          setRows(data.rows ?? [])
          setTotals(data.totals ?? null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load dues')
      })
    return () => {
      cancelled = true
    }
  }, [propertyId, view])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  const tiles = useMemo(
    () =>
      totals
        ? [
            { label: 'Outstanding', value: money(totals.outstanding, totals.currency), icon: HandCoins, sub: `${totals.tenantCount} tenants` },
            { label: 'Overdue', value: money(totals.overdue, totals.currency), icon: AlertTriangle, sub: `${totals.overdueCount} charges past due` },
            { label: 'Due this month', value: money(totals.dueThisMonth, totals.currency), icon: CalendarClock, sub: 'Open charges due in this calendar month' },
            { label: 'Pending adjustments', value: String(totals.pendingAdjustments), icon: Hourglass, sub: 'Awaiting approval' },
          ]
        : [],
    [totals],
  )

  if (rows === null) return <PageLoader title="Loading dues…" description="" />

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} variant="outlined" size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <t.icon className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="text-lg font-semibold tabular-nums">{t.value}</p>
                <p className="truncate text-xs text-muted-foreground">{t.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ResponsiveDataListing<DuesRow>
        title="Tenant dues"
        hideHeaderOnMobile
        items={rows}
        loading={false}
        skeletonCount={5}
        count={rows.length}
        rowKey={(r) => `${r.tenantId}:${r.propertyId}:${r.currency}`}
        columns={[
          {
            header: 'Tenant',
            cell: (r) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.tenantName}</p>
                <p className="truncate text-xs text-muted-foreground">{r.propertyName}</p>
              </div>
            ),
          },
          { header: 'Open', cell: (r) => <span className="text-sm font-medium tabular-nums">{money(r.open, r.currency)}</span> },
          {
            header: 'Overdue',
            cell: (r) =>
              Number(r.overdue) > 0.009 ? (
                <span className="text-sm font-medium tabular-nums text-red-700 dark:text-red-300">
                  {money(r.overdue, r.currency)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              ),
          },
          {
            header: 'Oldest due',
            cell: (r) => (
              <span className="text-xs text-muted-foreground">
                {r.oldestDueDate ? formatDate(r.oldestDueDate) : '—'}
              </span>
            ),
          },
          {
            header: 'Aging',
            cell: (r) => (
              <Badge variant={BUCKET_TONE[r.bucket] ?? 'neutral'} size="sm">
                {r.bucket === 'CURRENT' ? 'Current' : `${r.bucket}d`}
              </Badge>
            ),
          },
          { header: 'Charges', cell: (r) => <span className="text-sm tabular-nums">{r.chargeCount}</span> },
        ]}
        cardMapper={{
          id: (r) => `${r.tenantId}:${r.propertyId}:${r.currency}`,
          title: (r) => r.tenantName,
          subtitle: (r) => r.propertyName,
          statusBadge: (r) => (
            <Badge variant={BUCKET_TONE[r.bucket] ?? 'neutral'} size="sm">
              {r.bucket === 'CURRENT' ? 'Current' : `${r.bucket}d`}
            </Badge>
          ),
          amount: (r) => <span className="font-semibold tabular-nums">{money(r.open, r.currency)}</span>,
          detailFields: (r) => [
            { label: 'Overdue', value: Number(r.overdue) > 0.009 ? money(r.overdue, r.currency) : '—' },
            { label: 'Oldest due', value: r.oldestDueDate ? formatDate(r.oldestDueDate) : '—' },
            { label: 'Charges', value: String(r.chargeCount) },
          ],
          actions: (r) => [
            { label: 'Open tenant', variant: 'outline' as const, onClick: () => router.push(`/people/tenants/${r.tenantId}`) },
          ],
        }}
        filters={[
          {
            key: 'property',
            label: 'Property',
            value: propertyId,
            onChange: setPropertyId,
            options: [{ value: '', label: 'All properties' }, ...propertyOptions],
          },
          {
            key: 'view',
            label: 'View',
            value: view,
            onChange: setView,
            options: [
              { value: '', label: 'All dues' },
              { value: 'overdue', label: 'Overdue only' },
            ],
          },
        ]}
        filterChips
        searchPlaceholder=""
        emptyState={{
          icon: HandCoins,
          title: 'No open dues',
          description: 'Everything billed is settled — nothing is owed right now.',
        }}
      />
    </div>
  )
}
