'use client'

/**
 * /maintenance — board first: OPEN / IN_PROGRESS / RESOLVED columns of
 * ticket cards (priority chip, property, age, assignee org) + overdue
 * filter; secondary tabs: Tickets list | Work orders (plan-slice-3 §4).
 * Full kanban DnD deferred — status moves happen on the ticket detail.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Wrench } from 'lucide-react'

import {
  ResponsiveDataListing,
  type CardMapper,
  type ColumnDef,
} from '@workspace/ui/components/shared'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Switch } from '@workspace/ui/components/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { MAINTENANCE_STATUSES } from '@/lib/domain/maintenance-constants'
import { PriorityChip, StatusChip } from './_components/maintenance-status'

type TicketRow = {
  id: string
  title: string
  status: string
  priority: string
  category: string
  reportedAt: string
  property: { id: string; name: string }
  unit: { id: string; unitRef: string; label: string | null } | null
  workOrders: {
    id: string
    status: string
    assignments: {
      id: string
      status: string
      assigneeOrganization: { id: string; name: string } | null
    }[]
  }[]
}

type WoRow = {
  id: string
  title: string
  status: string
  priority: string
  estimatedCost: string | number | null
  currency: string
  property: { id: string; name: string }
  assignments: {
    id: string
    status: string
    assigneeOrganization: { id: string; name: string } | null
  }[]
}

const BOARD_COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'open', label: 'Open', statuses: ['OPEN'] },
  { key: 'progress', label: 'In progress', statuses: ['IN_PROGRESS', 'ON_HOLD'] },
  { key: 'resolved', label: 'Resolved', statuses: ['RESOLVED'] },
]

function ageInDays(iso: string): number {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

function isOverdue(t: TicketRow): boolean {
  if (t.status !== 'OPEN' && t.status !== 'IN_PROGRESS' && t.status !== 'ON_HOLD') return false
  return ageInDays(t.reportedAt) >= 7
}

export default function MaintenanceBoardPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [workOrders, setWorkOrders] = useState<WoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/maintenance/tickets', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => (d.tickets ?? []) as TicketRow[]),
      fetch('/api/work-orders', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => (d.workOrders ?? []) as WoRow[]),
    ])
      .then(([ts, wos]) => {
        if (cancelled) return
        setTickets(ts)
        setWorkOrders(wos)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load maintenance data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visibleTickets = useMemo(() => {
    let list = tickets
    if (overdueOnly) list = list.filter(isOverdue)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.property.name.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      )
    }
    if (statusFilter) list = list.filter((t) => t.status === statusFilter)
    return list
  }, [tickets, overdueOnly, search, statusFilter])

  if (!hasUiPermission('maintenance.list')) {
    return (
      <ScopeDenied message="You need the maintenance.list permission to view the maintenance board." />
    )
  }

  const openCount = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'ON_HOLD').length
  const overdueCount = tickets.filter(isOverdue).length

  // ── board ──────────────────────────────────────────────────────────────────
  const board = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Switch id="overdue-only" checked={overdueOnly} onCheckedChange={setOverdueOnly} />
          <label htmlFor="overdue-only" className="text-sm text-muted-foreground">
            Overdue only ({overdueCount})
          </label>
        </div>
        {hasUiPermission('maintenance.create') ? (
          <Button variant="primary" onClick={() => router.push('/maintenance/tickets/new')}>
            Report issue
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {BOARD_COLUMNS.map((col) => {
          const items = visibleTickets.filter((t) => col.statuses.includes(t.status))
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold">{col.label}</p>
                <Badge variant="neutral" size="sm" className="bg-muted text-muted-foreground">
                  {items.length}
                </Badge>
              </div>
              {items.length === 0 ? (
                <Card variant="outlined" size="sm" className="p-4 text-center text-sm text-muted-foreground">
                  Nothing here.
                </Card>
              ) : (
                items.map((t) => {
                  const assigneeOrgs = [
                    ...new Set(
                      t.workOrders
                        .flatMap((w) => w.assignments)
                        .filter((a) => a.status === 'ASSIGNED' && a.assigneeOrganization)
                        .map((a) => a.assigneeOrganization!.name),
                    ),
                  ]
                  const age = ageInDays(t.reportedAt)
                  return (
                    <Card key={t.id} variant="interactive" onClick={() => router.push(`/maintenance/tickets/${t.id}`)}>
                      <CardContent className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-medium">{t.title}</p>
                          <PriorityChip priority={t.priority} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.property.name}
                          {t.unit ? ` · ${t.unit.label ?? t.unit.unitRef}` : ''}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`text-xs ${isOverdue(t) ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                          >
                            {age}d old · {formatDate(t.reportedAt)}
                          </span>
                          {assigneeOrgs.length > 0 ? (
                            <span className="truncate text-xs text-muted-foreground">{assigneeOrgs.join(', ')}</span>
                          ) : null}
                        </div>
                        <StatusChip status={t.status} />
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── tickets register tab ───────────────────────────────────────────────────
  const ticketColumns: ColumnDef<TicketRow>[] = [
    {
      header: 'Issue',
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t.property.name}
            {t.unit ? ` · ${t.unit.label ?? t.unit.unitRef}` : ''}
          </p>
        </div>
      ),
    },
    { header: 'Status', cell: (t) => <StatusChip status={t.status} /> },
    { header: 'Priority', cell: (t) => <PriorityChip priority={t.priority} /> },
    {
      header: 'Category',
      cell: (t) => <span className="text-sm capitalize text-muted-foreground">{t.category.replace(/_/g, ' ').toLowerCase()}</span>,
    },
    { header: 'Reported', cell: (t) => <span className="text-sm text-muted-foreground">{formatDate(t.reportedAt)}</span> },
    {
      header: '',
      className: 'w-24',
      cell: (t) => (
        <Button variant="outline" size="sm" onClick={() => router.push(`/maintenance/tickets/${t.id}`)} aria-label="Open ticket">
          Open
        </Button>
      ),
    },
  ]

  const ticketCardMapper: CardMapper<TicketRow> = {
    id: (t) => t.id,
    title: (t) => t.title,
    subtitle: (t) => t.property.name,
    statusBadge: (t) => <StatusChip status={t.status} />,
    detailFields: (t) => [
      { label: 'Priority', value: t.priority.toLowerCase() },
      { label: 'Reported', value: formatDate(t.reportedAt) },
    ],
    actions: (t) => [
      { label: 'Open', variant: 'outline', onClick: () => router.push(`/maintenance/tickets/${t.id}`) },
    ],
  }

  // ── work orders register tab ───────────────────────────────────────────────
  const woColumns: ColumnDef<WoRow>[] = [
    {
      header: 'Job',
      cell: (w) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{w.title}</p>
          <p className="truncate text-xs text-muted-foreground">{w.property.name}</p>
        </div>
      ),
    },
    { header: 'Status', cell: (w) => <StatusChip status={w.status} /> },
    { header: 'Priority', cell: (w) => <PriorityChip priority={w.priority} /> },
    {
      header: 'Assignee',
      cell: (w) => {
        const active = w.assignments.filter((a) => a.status === 'ASSIGNED')
        if (active.length === 0) return <span className="text-xs text-muted-foreground">Unassigned</span>
        return (
          <p className="truncate text-xs text-muted-foreground">
            {active
              .map((a) => (a.assigneeOrganization ? `${a.assigneeOrganization.name}` : 'Own team'))
              .join(', ')}
          </p>
        )
      },
    },
    {
      header: '',
      className: 'w-24',
      cell: (w) => (
        <Button variant="outline" size="sm" onClick={() => router.push(`/maintenance/work-orders/${w.id}`)} aria-label="Open work order">
          Open
        </Button>
      ),
    },
  ]

  const woCardMapper: CardMapper<WoRow> = {
    id: (w) => w.id,
    title: (w) => w.title,
    subtitle: (w) => w.property.name,
    statusBadge: (w) => <StatusChip status={w.status} />,
    detailFields: (w) => [
      { label: 'Priority', value: w.priority.toLowerCase() },
      {
        label: 'Estimate',
        value: w.estimatedCost !== null ? `${w.currency} ${Number(w.estimatedCost).toLocaleString()}` : '—',
      },
    ],
    actions: (w) => [
      { label: 'Open', variant: 'outline', onClick: () => router.push(`/maintenance/work-orders/${w.id}`) },
    ],
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description={`${openCount} live ticket${openCount === 1 ? '' : 's'} · ${workOrders.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED').length} open jobs`}
        actions={
          <>
            {hasUiPermission('work_order.create') ? (
              <Button variant="outline" onClick={() => router.push('/maintenance/work-orders/new')}>
                New work order
              </Button>
            ) : null}
            {hasUiPermission('maintenance.create') ? (
              <Button variant="primary" onClick={() => router.push('/maintenance/tickets/new')}>
                Report issue
              </Button>
            ) : undefined}
          </>
        }
      />

      <Tabs defaultValue="board">
        <TabsList variant="line" size="md">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="tickets" count={tickets.length}>
            Tickets
          </TabsTrigger>
          <TabsTrigger value="work-orders" count={workOrders.length}>
            Work orders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          {board}
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <ResponsiveDataListing<TicketRow>
            title="Tickets"
            hideHeaderOnMobile
            items={visibleTickets}
            columns={ticketColumns}
            cardMapper={ticketCardMapper}
            loading={loading}
            skeletonCount={5}
            count={tickets.length}
            searchQuery={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search issue or property"
            filters={[
              {
                key: 'status',
                label: 'Status',
                value: statusFilter,
                onChange: setStatusFilter,
                options: [{ value: '', label: 'All statuses' }, ...MAINTENANCE_STATUSES],
              },
            ]}
            filterChips
            rowKey={(t) => t.id}
            emptyState={{
              icon: ClipboardList,
              title: 'No tickets yet',
              description: 'Report an issue to start the queue.',
            }}
            primaryAction={
              hasUiPermission('maintenance.create')
                ? { label: 'Report issue', onClick: () => router.push('/maintenance/tickets/new') }
                : undefined
            }
          />
        </TabsContent>

        <TabsContent value="work-orders" className="mt-4">
          <ResponsiveDataListing<WoRow>
            title="Work orders"
            hideHeaderOnMobile
            items={workOrders}
            columns={woColumns}
            cardMapper={woCardMapper}
            loading={loading}
            skeletonCount={5}
            count={workOrders.length}
            rowKey={(w) => w.id}
            emptyState={{
              icon: Wrench,
              title: 'No work orders yet',
              description: 'Escalate a ticket or create a standalone job.',
            }}
            primaryAction={
              hasUiPermission('work_order.create')
                ? { label: 'New work order', onClick: () => router.push('/maintenance/work-orders/new') }
                : undefined
            }
          />
          <div className="pt-3 text-right">
            <Button variant="text" size="sm" onClick={() => router.push('/maintenance/work-orders')}>
              Open full register →
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
