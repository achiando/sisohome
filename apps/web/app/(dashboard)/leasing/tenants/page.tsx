'use client'

/**
 * /leasing/tenants — tenant directory (plan-slice-2 §3).
 * UX gate: tenant.list; server gate = /api/tenants.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'

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
import { TENANT_STATUSES } from '@/lib/domain/tenant-constants'
import { TenantPortalBadge, TenantStatusBadge } from '../_components/tenant-status'

type TenantRow = {
  id: string
  tenantRef: string | null
  displayName: string
  partyType: string
  phone: string | null
  email: string | null
  status: string
  portalStatus: string
  incomeVerified: boolean
  createdAt: string
  leases: { id: string; status: string }[]
}

export default function TenantsPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/tenants', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load tenants')
        const data = await res.json()
        return (data.tenants ?? []) as TenantRow[]
      })
      .then((list) => {
        if (!cancelled) setTenants(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load tenants')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    let list = tenants
    if (statusFilter) list = list.filter((t) => t.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.displayName.toLowerCase().includes(q) ||
          (t.email ?? '').toLowerCase().includes(q) ||
          (t.phone ?? '').includes(q) ||
          (t.tenantRef ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [tenants, search, statusFilter])

  if (!hasUiPermission('tenant.list')) {
    return (
      <ScopeDenied message="You need the tenant.list permission to view tenants. Ask an owner or admin of your organization." />
    )
  }

  const activeLeaseLabel = (t: TenantRow) => {
    const active = t.leases.find((l) => l.status === 'ACTIVE' || l.status === 'ENDING')
    return active ? active.status : '—'
  }

  const columns: ColumnDef<TenantRow>[] = [
    {
      header: 'Tenant',
      cell: (t) => (
        <div className="min-w-0">
          <p className="font-medium">{t.displayName}</p>
          <p className="text-xs text-muted-foreground">{[t.tenantRef, t.email ?? t.phone].filter(Boolean).join(' · ')}</p>
        </div>
      ),
    },
    { header: 'Phone', cell: (t) => <span className="text-sm tabular-nums">{t.phone ?? '—'}</span> },
    { header: 'Status', cell: (t) => <TenantStatusBadge status={t.status} /> },
    { header: 'Portal', cell: (t) => <TenantPortalBadge status={t.portalStatus} /> },
    { header: 'Lease', cell: (t) => <Badge variant="neutral" size="sm">{activeLeaseLabel(t)}</Badge> },
    { header: 'Added', cell: (t) => <span className="text-sm text-muted-foreground">{formatDate(t.createdAt)}</span> },
    {
      header: '',
      className: 'w-24',
      cell: (t) => (
        <Button variant="outline" size="sm" onClick={() => router.push(`/leasing/tenants/${t.id}`)} aria-label={`Open ${t.displayName}`}>
          Open
        </Button>
      ),
    },
  ]

  const cardMapper: CardMapper<TenantRow> = {
    id: (t) => t.id,
    title: (t) => t.displayName,
    subtitle: (t) => [t.tenantRef, t.email ?? t.phone].filter(Boolean).join(' · ') || undefined,
    statusBadge: (t) => <TenantStatusBadge status={t.status} />,
    detailFields: (t) => [
      { label: 'Portal', value: t.portalStatus.replace(/_/g, ' ').toLowerCase() },
      { label: 'Lease', value: activeLeaseLabel(t) },
    ],
    actions: (t) => [{ label: 'Open', variant: 'outline', onClick: () => router.push(`/leasing/tenants/${t.id}`) }],
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Tenant parties your organization has captured or manages."
        actions={
          hasUiPermission('tenant.create') ? (
            <Button variant="primary" onClick={() => router.push('/leasing/tenants/new')}>
              Add tenant
            </Button>
          ) : undefined
        }
      />

      <ResponsiveDataListing<TenantRow>
        title="Tenants"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={5}
        count={tenants.length}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, phone or ref"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'All statuses' }, ...TENANT_STATUSES],
          },
        ]}
        filterChips
        rowKey={(t) => t.id}
        emptyState={{
          icon: Users,
          title: 'No tenants yet',
          description:
            tenants.length > 0
              ? 'No tenants match these filters.'
              : 'Add your first tenant to start screening and leasing.',
        }}
        primaryAction={
          hasUiPermission('tenant.create')
            ? { label: 'Add tenant', onClick: () => router.push('/leasing/tenants/new') }
            : undefined
        }
      />
    </div>
  )
}
