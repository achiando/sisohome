'use client'

/**
 * /units — global units register (portfolio-wide, siso-design
 * portfolio.webp). Server gate = GET /api/units (unit.list, property-scoped);
 * tenant names follow the tenant.read UI gate; market rent follows
 * charge.list. View/Edit jump to the existing per-property unit pages;
 * Add tenant opens the one-dialog quick tenancy flow (the 4-step wizard
 * stays at /leasing/leases/new for multi-unit agreements).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Boxes } from 'lucide-react'

import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { AddTenantDialog } from '@/app/(dashboard)/_components/domain/add-tenant-dialog'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { buildUnitColumns, type UnitListRow } from '@/app/(dashboard)/_components/domain/listing'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { UNIT_STATUSES } from '@/lib/domain/unit-constants'

type PropertyOption = { id: string; name: string }

export default function GlobalUnitsPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [units, setUnits] = useState<UnitListRow[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [propertyFilter, setPropertyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addTenantUnit, setAddTenantUnit] = useState<UnitListRow | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/units', { credentials: 'include' }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Failed to load units')
        return ((await r.json()).units ?? []) as UnitListRow[]
      }),
      fetch('/api/properties', { credentials: 'include' })
        .then(async (r) =>
          r.ok ? (((await r.json()).properties ?? []) as { id: string; name: string }[]) : [],
        )
        .catch(() => [] as { id: string; name: string }[]),
    ])
      .then(([unitList, propList]) => {
        if (cancelled) return
        setUnits(unitList)
        setProperties(propList.map((p) => ({ id: p.id, name: p.name })))
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load units')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load])

  const filtered = useMemo(() => {
    let list = units
    if (propertyFilter) list = list.filter((u) => u.propertyId === propertyFilter)
    if (statusFilter) list = list.filter((u) => u.occupancy === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (u) =>
          u.unitRef.toLowerCase().includes(q) ||
          (u.label ?? '').toLowerCase().includes(q) ||
          (u.property?.name ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [units, search, propertyFilter, statusFilter])

  if (!hasUiPermission('unit.list')) {
    return (
      <ScopeDenied message="You need the unit.list permission to view units. Ask an owner or admin of your organization." />
    )
  }

  const { columns, cardMapper } = buildUnitColumns({
    showProperty: true,
    showTenant: hasUiPermission('tenant.read'),
    showRent: hasUiPermission('charge.list'),
    showBills: hasUiPermission('charge.list'),
    showBalance: hasUiPermission('charge.list'),
    onOpen: (u) => router.push(`/portfolio/${u.propertyId}/units/${u.id}`),
    onEdit: (u) => router.push(`/portfolio/${u.propertyId}/units/${u.id}/edit`),
    onAddTenant: hasUiPermission('lease.create') ? (u) => setAddTenantUnit(u) : undefined,
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Units" description="Every unit across your organization's properties." />

      <ResponsiveDataListing<UnitListRow>
        title="Units"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={6}
        count={units.length}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search unit, label or property"
        filters={[
          {
            key: 'property',
            label: 'Property',
            value: propertyFilter,
            onChange: setPropertyFilter,
            options: [
              { value: '', label: 'Property' },
              ...properties.map((p) => ({ value: p.id, label: p.name })),
            ],
          },
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'Status' }, ...UNIT_STATUSES],
          },
        ]}
        inlineFilters
        rowKey={(u) => u.id}
        emptyState={{
          icon: Boxes,
          title: 'No units yet',
          description:
            units.length > 0
              ? 'No units match these filters.'
              : 'Units appear here once properties have unit records.',
        }}
      />

      <AddTenantDialog
        open={Boolean(addTenantUnit)}
        unitId={addTenantUnit?.id ?? ''}
        unitLabel={addTenantUnit ? addTenantUnit.label || addTenantUnit.unitRef : null}
        onClose={() => setAddTenantUnit(null)}
        onSaved={load}
      />
    </div>
  )
}
