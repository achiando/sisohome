'use client'

/**
 * /sales/viewings — the appointment register (plan-slice-5 §3).
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { VIEWING_STATUSES } from '@/lib/domain/sales-constants'
import { StatusBadge } from '../_components/status-badge'

interface ViewingRow {
  id: string
  scheduledAt: string
  status: string
  outcome: string | null
  property: { id: string; name: string }
  lead: { id: string; displayName: string } | null
}

export default function ViewingsPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [viewings, setViewings] = useState<ViewingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/viewings', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load viewings')
        const data = await res.json()
        return (data.viewings ?? []) as ViewingRow[]
      })
      .then((list) => {
        if (!cancelled) setViewings(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load viewings')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    let list = viewings
    if (statusFilter) list = list.filter((v) => v.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (v) => v.property.name.toLowerCase().includes(q) || (v.lead?.displayName ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [viewings, search, statusFilter])

  if (!hasUiPermission('viewing.list')) {
    return (
      <ScopeDenied message="You need the viewing.list permission to view appointments. Ask an owner or admin of your organization." />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Viewings"
        description="Property appointments with hunters."
        actions={
          hasUiPermission('viewing.create') ? (
            <Button variant="primary" onClick={() => router.push('/sales/viewings/new')}>
              Book viewing
            </Button>
          ) : undefined
        }
      />
      <ResponsiveDataListing<ViewingRow>
        title="Viewings"
        hideHeaderOnMobile
        items={filtered}
        loading={loading}
        skeletonCount={5}
        count={viewings.length}
        rowKey={(v) => v.id}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search property or hunter…"
        columns={[
          {
            header: 'When',
            cell: (v) => <span className="text-sm">{formatDate(v.scheduledAt)}</span>,
          },
          {
            header: 'Property',
            cell: (v) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{v.property.name}</p>
                <p className="truncate text-xs text-muted-foreground">{v.lead?.displayName ?? 'No hunter'}</p>
              </div>
            ),
          },
          {
            header: 'Outcome',
            cell: (v) => <span className="text-sm text-muted-foreground">{v.outcome ?? '—'}</span>,
          },
          { header: 'Status', cell: (v) => <StatusBadge status={v.status} /> },
        ]}
        cardMapper={{
          id: (v) => v.id,
          title: (v) => v.property.name,
          subtitle: (v) => `${formatDate(v.scheduledAt)} · ${v.lead?.displayName ?? 'No hunter'}`,
          detailFields: (v) => [
            { label: 'Status', value: <StatusBadge status={v.status} /> },
            { label: 'Outcome', value: v.outcome ?? '—' },
          ],
          detailHref: (v) => `/sales/viewings/${v.id}/edit`,
        }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'All statuses' }, ...VIEWING_STATUSES],
          },
        ]}
        filterChips
        emptyState={{
          icon: CalendarDays,
          title: 'No viewings booked',
          description:
            viewings.length > 0 ? 'No viewings match these filters.' : 'Book the first appointment from a lead.',
        }}
        primaryAction={
          hasUiPermission('viewing.create')
            ? { label: 'Book viewing', onClick: () => router.push('/sales/viewings/new') }
            : undefined
        }
      />
    </div>
  )
}
