'use client'

/**
 * /leasing/leases — lease register (plan-slice-2 §3). UX gate: lease.list.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSignature } from 'lucide-react'

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
import { LEASE_STATUSES } from '@/lib/domain/lease-constants'
import { LeaseStatusBadge } from '../_components/lease-status'

type LeaseRow = {
  id: string
  leaseRef: string | null
  status: string
  startsAt: string
  endsAt: string | null
  currency: string
  billingFrequency: string
  property: { id: string; name: string }
  units: { unit: { id: string; unitRef: string; label: string | null } }[]
  parties: { relationship: string; tenant: { id: string; displayName: string } }[]
}

function primaryTenant(l: LeaseRow): string {
  const primary = l.parties.find((p) => p.relationship === 'PRIMARY') ?? l.parties[0]
  return primary?.tenant.displayName ?? '—'
}

function unitSummary(l: LeaseRow): string {
  const firstUnit = l.units[0]?.unit
  if (!firstUnit) return '—'
  const first = firstUnit.label ?? firstUnit.unitRef
  return l.units.length === 1 ? first : `${first} +${l.units.length - 1}`
}

export default function LeasesPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [leases, setLeases] = useState<LeaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/leases', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load leases')
        const data = await res.json()
        return (data.leases ?? []) as LeaseRow[]
      })
      .then((list) => {
        if (!cancelled) setLeases(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load leases')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    let list = leases
    if (statusFilter) list = list.filter((l) => l.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (l) =>
          (l.leaseRef ?? '').toLowerCase().includes(q) ||
          l.property.name.toLowerCase().includes(q) ||
          primaryTenant(l).toLowerCase().includes(q) ||
          l.units.some((u) => (u.unit.label ?? u.unit.unitRef).toLowerCase().includes(q)),
      )
    }
    return list
  }, [leases, search, statusFilter])

  if (!hasUiPermission('lease.list')) {
    return <ScopeDenied message="You need the lease.list permission to view the lease register." />
  }

  const columns: ColumnDef<LeaseRow>[] = [
    {
      header: 'Lease',
      cell: (l) => (
        <div className="min-w-0">
          <p className="font-medium">{l.leaseRef ?? `Lease ${l.id.slice(0, 8)}`}</p>
          <p className="text-xs text-muted-foreground">{l.billingFrequency.toLowerCase()} · {l.currency}</p>
        </div>
      ),
    },
    {
      header: 'Property / unit',
      cell: (l) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{l.property.name}</p>
          <p className="text-xs text-muted-foreground">{unitSummary(l)}</p>
        </div>
      ),
    },
    { header: 'Primary tenant', cell: (l) => <span className="text-sm">{primaryTenant(l)}</span> },
    { header: 'Status', cell: (l) => <LeaseStatusBadge status={l.status} /> },
    {
      header: 'Term',
      cell: (l) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(l.startsAt)} → {l.endsAt ? formatDate(l.endsAt) : 'open'}
        </span>
      ),
    },
    {
      header: '',
      className: 'w-24',
      cell: (l) => (
        <Button variant="outline" size="sm" onClick={() => router.push(`/leasing/leases/${l.id}`)} aria-label="Open lease">
          Open
        </Button>
      ),
    },
  ]

  const cardMapper: CardMapper<LeaseRow> = {
    id: (l) => l.id,
    title: (l) => l.leaseRef ?? `Lease ${l.id.slice(0, 8)}`,
    subtitle: (l) => l.property.name,
    statusBadge: (l) => <LeaseStatusBadge status={l.status} />,
    detailFields: (l) => [
      { label: 'Tenant', value: primaryTenant(l) },
      { label: 'Units', value: unitSummary(l) },
      { label: 'Term', value: `${formatDate(l.startsAt)} → ${l.endsAt ? formatDate(l.endsAt) : 'open'}` },
    ],
    actions: (l) => [
      { label: 'Open', variant: 'outline', onClick: () => router.push(`/leasing/leases/${l.id}`) },
    ],
  }

  const openCount = leases.filter((l) => l.status === 'ACTIVE' || l.status === 'SCHEDULED').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leases"
        description={
          leases.length > 0 ? `${openCount} live · ${leases.length} total` : 'Tenancy agreements across your portfolio.'
        }
        actions={
          hasUiPermission('lease.create') ? (
            <Button variant="primary" onClick={() => router.push('/leasing/leases/new')}>
              New lease
            </Button>
          ) : undefined
        }
      />

      <ResponsiveDataListing<LeaseRow>
        title="Register"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={5}
        count={leases.length}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search reference, property or tenant"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'All statuses' }, ...LEASE_STATUSES],
          },
        ]}
        filterChips
        rowKey={(l) => l.id}
        emptyState={{
          icon: FileSignature,
          title: 'No leases yet',
          description:
            leases.length > 0 ? 'No leases match these filters.' : 'Capture a lease to start a tenancy.',
        }}
        primaryAction={
          hasUiPermission('lease.create')
            ? { label: 'New lease', onClick: () => router.push('/leasing/leases/new') }
            : undefined
        }
      />
    </div>
  )
}
