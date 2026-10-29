'use client'

/**
 * /sales/leads — the capture inbox (plan-slice-5 §3): owned leads, with
 * received-accepted handoffs readable alongside them.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatRelativeDay } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { LEAD_STATUSES } from '@/lib/domain/sales-constants'
import { LeadStatusBadge } from '../_components/status-badge'
import type { LeadRow } from '../_components/sales-types'

export default function LeadsPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/leads', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load leads')
        const data = await res.json()
        return (data.leads ?? []) as LeadRow[]
      })
      .then((list) => {
        if (!cancelled) setLeads(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load leads')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    let list = leads
    if (statusFilter) list = list.filter((l) => l.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (l) =>
          l.displayName.toLowerCase().includes(q) ||
          (l.phone ?? '').includes(q) ||
          (l.email ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [leads, search, statusFilter])

  if (!hasUiPermission('lead.list')) {
    return (
      <ScopeDenied message="You need the lead.list permission to view the lead inbox. Ask an owner or admin of your organization." />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Hunter enquiries you own, plus leads partners handed over to you."
        actions={
          <>
            {hasUiPermission('lead.create') ? (
              <Button variant="outline" onClick={() => router.push('/sales/leads/new')}>
                Capture lead
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => router.push('/sales/handoffs')}>
              Handoffs
            </Button>
          </>
        }
      />
      <ResponsiveDataListing<LeadRow>
        title="Leads"
        hideHeaderOnMobile
        items={filtered}
        loading={loading}
        skeletonCount={5}
        count={leads.length}
        rowKey={(l) => l.id}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, phone or email…"
        columns={[
          {
            header: 'Hunter',
            cell: (l) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{l.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[l.phone, l.email].filter(Boolean).join(' · ') || 'No contact'}
                </p>
              </div>
            ),
          },
          {
            header: 'Interest',
            cell: (l) => (
              <span className="text-sm">{l.listing?.title ?? l.property?.name ?? '—'}</span>
            ),
          },
          {
            header: 'Next action',
            cell: (l) => (
              <span className="text-sm text-muted-foreground">
                {l.nextActionAt ? formatRelativeDay(l.nextActionAt) : '—'}
              </span>
            ),
          },
          { header: 'Status', cell: (l) => <LeadStatusBadge status={l.status} /> },
        ]}
        cardMapper={{
          id: (l) => l.id,
          title: (l) => l.displayName,
          subtitle: (l) => l.listing?.title ?? l.property?.name ?? 'No interest linked',
          detailFields: (l) => [
            { label: 'Status', value: <LeadStatusBadge status={l.status} /> },
            {
              label: 'Next action',
              value: l.nextActionAt ? formatRelativeDay(l.nextActionAt) : '—',
            },
          ],
          detailHref: (l) => `/sales/leads/${l.id}`,
        }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'All statuses' }, ...LEAD_STATUSES],
          },
        ]}
        filterChips
        emptyState={{
          icon: Users,
          title: 'No leads yet',
          description:
            leads.length > 0
              ? 'No leads match these filters.'
              : 'Capture your first hunter enquiry to start the pipeline.',
        }}
        primaryAction={
          hasUiPermission('lead.create')
            ? { label: 'Capture lead', onClick: () => router.push('/sales/leads/new') }
            : undefined
        }
      />
    </div>
  )
}
