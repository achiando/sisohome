'use client'

/**
 * /maintenance/inspections — register grouped by scheduled date
 * (calendar-ish, plan-slice-3 §4).
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'

import {
  ResponsiveDataListing,
  type CardMapper,
  type ColumnDef,
} from '@workspace/ui/components/shared'
import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { INSPECTION_STATUSES } from '@/lib/domain/maintenance-constants'
import { StatusChip } from '../_components/maintenance-status'

type InspectionRow = {
  id: string
  kind: string
  status: string
  scheduledFor: string | null
  completedAt: string | null
  findings: string | null
  property: { id: string; name: string }
  unit: { id: string; unitRef: string; label: string | null } | null
  inspector: { id: string; displayName: string }
  workOrder: { id: string; title: string } | null
}

function scheduledDay(v: string | null): string {
  if (!v) return 'Unscheduled'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return 'Unscheduled'
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, tomorrow)) return 'Tomorrow'
  return formatDate(v)
}

export default function InspectionsPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [rows, setRows] = useState<InspectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/maintenance/inspections', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load inspections')
        const data = await res.json()
        return (data.inspections ?? []) as InspectionRow[]
      })
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load inspections')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    let list = rows
    if (statusFilter) list = list.filter((r) => r.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.property.name.toLowerCase().includes(q) ||
          r.inspector.displayName.toLowerCase().includes(q) ||
          r.kind.toLowerCase().includes(q),
      )
    }
    return list
  }, [rows, search, statusFilter])

  if (!hasUiPermission('inspection.list')) {
    return <ScopeDenied message="You need the inspection.list permission to view inspections." />
  }

  const columns: ColumnDef<InspectionRow>[] = [
    {
      header: 'When',
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-medium">{scheduledDay(r.scheduledFor)}</p>
          <p className="text-xs text-muted-foreground">{r.scheduledFor ? formatDate(r.scheduledFor) : 'No date set'}</p>
        </div>
      ),
    },
    {
      header: 'Inspection',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium capitalize">{r.kind.replace(/_/g, ' ').toLowerCase()}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.property.name}
            {r.unit ? ` · ${r.unit.label ?? r.unit.unitRef}` : ''}
          </p>
        </div>
      ),
    },
    { header: 'Status', cell: (r) => <StatusChip status={r.status} /> },
    {
      header: 'Inspector',
      cell: (r) => <span className="text-sm text-muted-foreground">{r.inspector.displayName}</span>,
    },
    {
      header: 'Linked job',
      cell: (r) =>
        r.workOrder ? (
          <span className="truncate text-xs text-muted-foreground">{r.workOrder.title}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      header: '',
      className: 'w-24',
      cell: (r) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/maintenance/inspections/${r.id}/edit`)}
          aria-label="Open inspection"
        >
          Open
        </Button>
      ),
    },
  ]

  const cardMapper: CardMapper<InspectionRow> = {
    id: (r) => r.id,
    title: (r) => `${r.kind.replace(/_/g, ' ').toLowerCase()} · ${r.property.name}`,
    subtitle: (r) => scheduledDay(r.scheduledFor),
    statusBadge: (r) => <StatusChip status={r.status} />,
    detailFields: (r) => [
      { label: 'Inspector', value: r.inspector.displayName },
      ...(r.findings ? [{ label: 'Findings', value: r.findings }] : []),
    ],
    actions: (r) => [
      {
        label: 'Open',
        variant: 'outline',
        onClick: () => router.push(`/maintenance/inspections/${r.id}/edit`),
      },
    ],
  }

  const upcoming = rows.filter((r) => r.status === 'SCHEDULED').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inspections"
        description={`${upcoming} scheduled · ${rows.length} total`}
        actions={
          hasUiPermission('inspection.create') ? (
            <Button variant="primary" onClick={() => router.push('/maintenance/inspections/new')}>
              Schedule inspection
            </Button>
          ) : undefined
        }
      />

      <ResponsiveDataListing<InspectionRow>
        title="Register"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={5}
        count={rows.length}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search property or inspector"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'All statuses' }, ...INSPECTION_STATUSES],
          },
        ]}
        filterChips
        rowKey={(r) => r.id}
        emptyState={{
          icon: ClipboardCheck,
          title: 'No inspections yet',
          description:
            rows.length > 0
              ? 'No inspections match these filters.'
              : 'Schedule a routine or move-in inspection to get started.',
        }}
        primaryAction={
          hasUiPermission('inspection.create')
            ? { label: 'Schedule inspection', onClick: () => router.push('/maintenance/inspections/new') }
            : undefined
        }
      />
    </div>
  )
}
