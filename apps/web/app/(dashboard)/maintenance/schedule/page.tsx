'use client'

/**
 * /maintenance/schedule — recurring jobs with next-due ordering and
 * deactivate action (plan-slice-3 §4).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock } from 'lucide-react'

import {
  ResponsiveDataListing,
  type CardMapper,
  type ColumnDef,
} from '@workspace/ui/components/shared'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'

type ScheduleRow = {
  id: string
  title: string
  kind: string
  frequency: string
  startDate: string
  endDate: string | null
  nextDueAt: string | null
  isActive: boolean
  property: { id: string; name: string }
  unit: { id: string; unitRef: string; label: string | null } | null
  assignee: { id: string; displayName: string } | null
}

function isOverdue(row: ScheduleRow): boolean {
  if (!row.isActive || !row.nextDueAt) return false
  const due = new Date(row.nextDueAt)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return due < startOfToday
}

export default function SchedulePage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    fetch('/api/maintenance/schedules', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load schedules')
        const data = await res.json()
        return (data.schedules ?? []) as ScheduleRow[]
      })
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load schedules')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load])

  const deactivate = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/maintenance/schedules/${id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to deactivate')
      toast.success('Schedule deactivated')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.property.name.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q),
    )
  }, [rows, search])

  if (!hasUiPermission('schedule.list')) {
    return <ScopeDenied message="You need the schedule.list permission to view recurring jobs." />
  }

  const columns: ColumnDef<ScheduleRow>[] = [
    {
      header: 'Next due',
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {r.isActive && r.nextDueAt ? formatDate(r.nextDueAt) : 'Inactive'}
          </p>
          {isOverdue(r) ? (
            <Badge variant="neutral" size="sm" className="bg-red-500/15 text-red-700 dark:text-red-300">
              overdue
            </Badge>
          ) : null}
        </div>
      ),
    },
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
    {
      header: 'Kind',
      cell: (r) => <span className="text-sm capitalize text-muted-foreground">{r.kind.replace(/_/g, ' ').toLowerCase()}</span>,
    },
    {
      header: 'Frequency',
      cell: (r) => <Badge variant="neutral" size="sm">{r.frequency.toLowerCase()}</Badge>,
    },
    {
      header: 'Assignee',
      cell: (r) => <span className="text-sm text-muted-foreground">{r.assignee?.displayName ?? '—'}</span>,
    },
    {
      header: 'Status',
      cell: (r) => (
        <Badge variant="neutral" size="sm" className={r.isActive ? '' : 'bg-muted text-muted-foreground'}>
          {r.isActive ? 'active' : 'inactive'}
        </Badge>
      ),
    },
    {
      header: '',
      className: 'w-32',
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/maintenance/schedule/${r.id}/edit`)}
            aria-label="Edit schedule"
          >
            Edit
          </Button>
          {r.isActive && hasUiPermission('schedule.update') ? (
            <Button
              variant="ghost"
              size="sm"
              loading={busyId === r.id}
              disabled={busyId === r.id}
              onClick={() => deactivate(r.id)}
            >
              Pause
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  const cardMapper: CardMapper<ScheduleRow> = {
    id: (r) => r.id,
    title: (r) => r.title,
    subtitle: (r) => r.property.name,
    statusBadge: (r) => (
      <Badge variant="neutral" size="sm" className={r.isActive ? '' : 'bg-muted text-muted-foreground'}>
        {r.frequency.toLowerCase()}
      </Badge>
    ),
    detailFields: (r) => [
      { label: 'Next due', value: r.isActive && r.nextDueAt ? formatDate(r.nextDueAt) : 'Inactive' },
      { label: 'Assignee', value: r.assignee?.displayName ?? 'Unassigned' },
    ],
    actions: (r) => [
      {
        label: 'Edit',
        variant: 'outline',
        onClick: () => router.push(`/maintenance/schedule/${r.id}/edit`),
      },
    ],
  }

  const overdueCount = rows.filter(isOverdue).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring schedules"
        description={`${rows.filter((r) => r.isActive).length} active${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`}
        actions={
          hasUiPermission('schedule.create') ? (
            <Button variant="primary" onClick={() => router.push('/maintenance/schedule/new')}>
              New schedule
            </Button>
          ) : undefined
        }
      />

      <ResponsiveDataListing<ScheduleRow>
        title="Recurring jobs"
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
        rowKey={(r) => r.id}
        emptyState={{
          icon: CalendarClock,
          title: 'No recurring jobs yet',
          description: 'Add servicing, cleaning or inspection cycles that repeat automatically.',
        }}
        primaryAction={
          hasUiPermission('schedule.create')
            ? { label: 'New schedule', onClick: () => router.push('/maintenance/schedule/new') }
            : undefined
        }
      />
    </div>
  )
}
