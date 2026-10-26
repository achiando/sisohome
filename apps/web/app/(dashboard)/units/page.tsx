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
import { Boxes, Mail } from 'lucide-react'

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
  const [sending, setSending] = useState(false)

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

  const sendNotices = async () => {
    const target = filtered.filter((u) => u.occupancy === 'OCCUPIED')
    if (target.length === 0) {
      toast.error('No occupied units match these filters')
      return
    }
    setSending(true)
    try {
      const ids = target.map((u) => u.id)
      let emailed = 0
      let filed = 0
      let skipped = 0
      for (let i = 0; i < ids.length; i += 50) {
        const res = await fetch('/api/units/billing-notices', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unitIds: ids.slice(i, i + 50) }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error ?? 'Could not send billing notices')
          return
        }
        const r = (data.result ?? {}) as {
          emailed?: number
          filed?: number
          skipped?: unknown[]
        }
        emailed += r.emailed ?? 0
        filed += r.filed ?? 0
        skipped += r.skipped?.length ?? 0
      }
      toast.success(
        `Billing notices sent — ${emailed} emailed, ${filed} filed${
          skipped ? `, ${skipped} skipped (vacant or no email)` : ''
        }`,
      )
    } catch {
      toast.error('Network error — notices may not have been sent')
    } finally {
      setSending(false)
    }
  }

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
        secondaryActions={
          hasUiPermission('charge.manage')
            ? [
                {
                  label: sending ? 'Sending…' : 'Send bills to tenants',
                  icon: Mail,
                  onClick: sendNotices,
                },
              ]
            : []
        }
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
