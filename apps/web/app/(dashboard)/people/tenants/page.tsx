'use client'

/**
 * /people/tenants — tenant directory (plan-slice-2 §3).
 * UX gate: tenant.list; server gate = /api/tenants.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'

import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { buildTenantColumns, type TenantListRow } from '@/app/(dashboard)/_components/domain/listing'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { TENANT_STATUSES } from '@/lib/domain/tenant-constants'

type TenantRow = TenantListRow

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

  const { columns, cardMapper } = buildTenantColumns({
    onOpen: (t) => router.push(`/people/tenants/${t.id}`),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Tenant parties your organization has captured or manages."
        actions={
          hasUiPermission('tenant.create') ? (
            <Button variant="primary" onClick={() => router.push('/people/tenants/new')}>
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
            ? { label: 'Add tenant', onClick: () => router.push('/people/tenants/new') }
            : undefined
        }
      />
    </div>
  )
}
