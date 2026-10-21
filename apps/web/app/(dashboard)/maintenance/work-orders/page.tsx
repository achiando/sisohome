'use client'

/**
 * /maintenance/work-orders — register with status filter, cost columns
 * and the technician scope toggle (All / My jobs — UX filter, plan-slice-3
 * §1).
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench } from 'lucide-react'

import {
  ResponsiveDataListing,
  type CardMapper,
  type ColumnDef,
} from '@workspace/ui/components/shared'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { WORK_ORDER_STATUSES } from '@/lib/domain/maintenance-constants'
import { PriorityChip, StatusChip } from '../_components/maintenance-status'

type WorkOrderRow = {
  id: string
  title: string
  status: string
  priority: string
  scheduledFor: string | null
  estimatedCost: string | number | null
  finalCost: string | number | null
  currency: string
  property: { id: string; name: string }
  unit: { id: string; unitRef: string; label: string | null } | null
  ticket: { id: string; title: string } | null
  assignments: {
    id: string
    status: string
    assigneeUser: { id: string; displayName: string }
    assigneeOrganization: { id: string; name: string } | null
  }[]
}

function money(v: string | number | null, currency: string): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${currency} ${n.toLocaleString()}`
}

export default function WorkOrdersPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [rows, setRows] = useState<WorkOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [scope, setScope] = useState<'all' | 'mine'>('all')

  useEffect(() => {
    let cancelled = false
    const qs = scope === 'mine' ? '?scope=mine' : ''
    fetch(`/api/work-orders${qs}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load work orders')
        const data = await res.json()
        return (data.workOrders ?? []) as WorkOrderRow[]
      })
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load work orders')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [scope])

  const filtered = useMemo(() => {
    let list = rows
    if (statusFilter) list = list.filter((r) => r.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.property.name.toLowerCase().includes(q) ||
          (r.unit?.label ?? r.unit?.unitRef ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [rows, search, statusFilter])

  if (!hasUiPermission('work_order.list')) {
    return <ScopeDenied message="You need the work_order.list permission to view work orders." />
  }

  const columns: ColumnDef<WorkOrderRow>[] = [
    {
      header: 'Job',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.property.name}
            {r.unit ? ` · ${r.unit.label ?? r.unit.unitRef}` : ''}
          </p>
        </div>
      ),
    },
    { header: 'Status', cell: (r) => <StatusChip status={r.status} /> },
    { header: 'Priority', cell: (r) => <PriorityChip priority={r.priority} /> },
    {
      header: 'Assignee',
      cell: (r) => {
        const active = r.assignments.filter((a) => a.status === 'ASSIGNED')
        if (active.length === 0) return <span className="text-xs text-muted-foreground">Unassigned</span>
        return (
          <div className="min-w-0 text-xs">
            {active.map((a) => (
              <p key={a.id} className="truncate text-muted-foreground">
                {a.assigneeOrganization ? `${a.assigneeOrganization.name}: ` : ''}
                {a.assigneeUser.displayName}
              </p>
            ))}
          </div>
        )
      },
    },
    {
      header: 'Estimate',
      cell: (r) => <span className="text-sm text-muted-foreground">{money(r.estimatedCost, r.currency)}</span>,
    },
    {
      header: 'Final',
      cell: (r) => <span className="text-sm text-muted-foreground">{money(r.finalCost, r.currency)}</span>,
    },
    {
      header: 'Scheduled',
      cell: (r) => <span className="text-sm text-muted-foreground">{r.scheduledFor ? formatDate(r.scheduledFor) : '—'}</span>,
    },
    {
      header: '',
      className: 'w-24',
      cell: (r) => (
        <Button variant="outline" size="sm" onClick={() => router.push(`/maintenance/work-orders/${r.id}`)} aria-label="Open work order">
          Open
        </Button>
      ),
    },
  ]

  const cardMapper: CardMapper<WorkOrderRow> = {
    id: (r) => r.id,
    title: (r) => r.title,
    subtitle: (r) => r.property.name,
    statusBadge: (r) => <StatusChip status={r.status} />,
    detailFields: (r) => [
      { label: 'Priority', value: r.priority.toLowerCase() },
      { label: 'Estimate', value: money(r.estimatedCost, r.currency) },
      { label: 'Scheduled', value: r.scheduledFor ? formatDate(r.scheduledFor) : '—' },
    ],
    actions: (r) => [
      { label: 'Open', variant: 'outline', onClick: () => router.push(`/maintenance/work-orders/${r.id}`) },
    ],
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work orders"
        description={`${rows.length} job${rows.length === 1 ? '' : 's'} in scope`}
        actions={
          hasUiPermission('work_order.create') ? (
            <Button variant="primary" onClick={() => router.push('/maintenance/work-orders/new')}>
              New work order
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-3">
        <Tabs value={scope} onValueChange={(v) => setScope(v as 'all' | 'mine')}>
          <TabsList variant="pill" size="md">
            <TabsTrigger value="all">All jobs</TabsTrigger>
            <TabsTrigger value="mine">My jobs</TabsTrigger>
          </TabsList>
        </Tabs>
        <Badge variant="neutral" size="sm" className="text-muted-foreground">
          {filtered.length} shown
        </Badge>
      </div>

      <ResponsiveDataListing<WorkOrderRow>
        title="Work orders"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={5}
        count={rows.length}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search job or property"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'All statuses' }, ...WORK_ORDER_STATUSES],
          },
        ]}
        filterChips
        rowKey={(r) => r.id}
        emptyState={{
          icon: Wrench,
          title: 'No work orders yet',
          description:
            rows.length > 0
              ? 'No work orders match these filters.'
              : 'Create a job from a ticket, or start a standalone work order.',
        }}
        primaryAction={
          hasUiPermission('work_order.create')
            ? { label: 'New work order', onClick: () => router.push('/maintenance/work-orders/new') }
            : undefined
        }
      />
    </div>
  )
}
