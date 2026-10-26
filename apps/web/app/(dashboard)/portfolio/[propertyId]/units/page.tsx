'use client'

/**
 * /portfolio/[propertyId]/units — unit manager (plan-slice-1 §4.3).
 *
 * Two panels: buildings (grouping, delete blocked while units reference)
 * and the units listing with lease-derived occupancy. Gates: unit.list to
 * see, unit.create for adds/bulk, unit.update to edit, unit.delete for
 * removals — server enforces for real.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { UnitType } from '@workspace/database'

import {
  ResponsiveDataListing,
} from '@workspace/ui/components/shared'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@workspace/ui/components/alert-dialog'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { Text } from '@workspace/ui/components/text'
import { toast } from '@workspace/ui/components/toast'
import { LayoutGrid, Plus, Boxes, FileSpreadsheet, Mail, Pencil, Trash2, Zap } from 'lucide-react'

import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { buildUnitColumns, type UnitListRow } from '@/app/(dashboard)/_components/domain/listing'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { UNIT_STATUSES } from '@/lib/domain/unit-constants'
import { BuildingForm, type BuildingRow } from '../../_components/building-form'
import { BulkUnitsDialog } from '../../_components/bulk-units-dialog'
import { ImportUnitsDialog } from '../../_components/import-units-dialog'
import type { UnitBuildingOption } from '../../_components/unit-form'

type UnitRow = UnitListRow

function buildOptions(b: BuildingRow): UnitBuildingOption {
  return b
}

export default function UnitManagerPage() {
  const router = useRouter()
  const params = useParams<{ propertyId: string }>()
  const propertyId = params.propertyId
  const { hasUiPermission } = useUiPermission()

  const [loading, setLoading] = useState(true)
  const [propertyName, setPropertyName] = useState('')
  const [units, setUnits] = useState<UnitRow[]>([])
  const [buildings, setBuildings] = useState<BuildingRow[]>([])
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [buildingFilter, setBuildingFilter] = useState('')
  const [buildingDialog, setBuildingDialog] = useState<{ open: boolean; building?: BuildingRow | null }>({ open: false })
  const [bulkOpen, setBulkOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UnitRow | null>(null)
  const [deleteBuilding, setDeleteBuilding] = useState<BuildingRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [propertyAmenities, setPropertyAmenities] = useState<string[]>([])
  const [propertyCurrency, setPropertyCurrency] = useState<string | undefined>(undefined)

  const load = useCallback(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/properties/${propertyId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/properties/${propertyId}/units`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/properties/${propertyId}/buildings`, { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/unit-types', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([pRes, uRes, bRes, tRes]) => {
        if (cancelled) return
        const p = pRes?.property as
          | { name?: string; amenities?: unknown; currency?: unknown }
          | undefined
        if (p?.name) setPropertyName(p.name)
        if (Array.isArray(p?.amenities)) {
          setPropertyAmenities(p.amenities.filter((a): a is string => typeof a === 'string'))
        }
        if (typeof p?.currency === 'string' && p.currency) setPropertyCurrency(p.currency)
        setUnits((uRes.units ?? []) as UnitRow[])
        setBuildings((bRes.buildings ?? []) as BuildingRow[])
        setUnitTypes((tRes.unitTypes ?? []) as UnitType[])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load unit data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  useEffect(() => load(), [load])

  const filtered = useMemo(() => {
    let list = units
    if (statusFilter) list = list.filter((u) => u.occupancy === statusFilter)
    if (buildingFilter) {
      list = buildingFilter === 'none'
        ? list.filter((u) => !u.building)
        : list.filter((u) => u.building?.id === buildingFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (u) =>
          u.unitRef.toLowerCase().includes(q) ||
          (u.label ?? '').toLowerCase().includes(q) ||
          (u.building ? `${u.building.code} ${u.building.name ?? ''}`.toLowerCase().includes(q) : false),
      )
    }
    return list
  }, [units, search, statusFilter, buildingFilter])

  const occupancy = useMemo(() => {
    const occupied = units.filter((u) => u.occupancy === 'OCCUPIED').length
    const vacant = units.filter((u) => u.occupancy === 'VACANT').length
    return { occupied, vacant, other: units.length - occupied - vacant }
  }, [units])

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
        const r = (data.result ?? {}) as { emailed?: number; filed?: number; skipped?: unknown[] }
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

  const confirmDeleteUnit = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      const res = await fetch(`/api/units/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete unit')
        return
      }
      toast.success('Unit deleted')
      setDeleteTarget(null)
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  const confirmDeleteBuilding = async () => {
    if (!deleteBuilding) return
    setBusy(true)
    try {
      const res = await fetch(`/api/buildings/${deleteBuilding.id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete building')
        return
      }
      toast.success('Building deleted')
      setDeleteBuilding(null)
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (!hasUiPermission('unit.list')) {
    return (
      <ScopeDenied
        message="You need the unit.list permission to view units. Ask an owner or admin of your organization."
        backHref={`/portfolio/${propertyId}`}
        backLabel="Back to property"
      />
    )
  }

  const { columns, cardMapper } = buildUnitColumns({
    showProperty: false,
    showTenant: hasUiPermission('tenant.read'),
    showRent: hasUiPermission('charge.list'),
    showBills: hasUiPermission('charge.list'),
    showBalance: hasUiPermission('charge.list'),
    onOpen: hasUiPermission('unit.read')
      ? (u) => router.push(`/portfolio/${propertyId}/units/${u.id}`)
      : undefined,
    onEdit: hasUiPermission('unit.update')
      ? (u) => router.push(`/portfolio/${propertyId}/units/${u.id}/edit`)
      : undefined,
    onDelete: hasUiPermission('unit.delete') ? (u) => setDeleteTarget(u) : undefined,
    onAddTenant: hasUiPermission('lease.create')
      ? (u) => router.push(`/leasing/leases/new?propertyId=${propertyId}&unitId=${u.id}`)
      : undefined,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/portfolio/${propertyId}`)}>
          ← {propertyName || 'Property'}
        </Button>
      </div>

      <PageHeader
        title="Units"
        description={`${propertyName || 'Property'} — buildings, unit records and rental defaults.`}
        actions={
          <>
            {hasUiPermission('unit.create') && (
              <Button variant="outline" leftIcon={Zap} onClick={() => setBulkOpen(true)}>
                Bulk add
              </Button>
            )}
            {hasUiPermission('unit.create') && (
              <Button variant="outline" leftIcon={FileSpreadsheet} onClick={() => setImportOpen(true)}>
                Import CSV/Excel
              </Button>
            )}
            {hasUiPermission('unit.create') && (
              <Button variant="primary" leftIcon={Plus} onClick={() => router.push(`/portfolio/${propertyId}/units/new`)}>
                Add unit
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <PageLoader title="Loading units…" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card variant="outlined" size="sm">
              <CardContent className="p-4">
                <Text variant="caption" className="text-muted-foreground">Occupied</Text>
                <Text variant="title" className="tabular-nums">{occupancy.occupied}</Text>
              </CardContent>
            </Card>
            <Card variant="outlined" size="sm">
              <CardContent className="p-4">
                <Text variant="caption" className="text-muted-foreground">Vacant</Text>
                <Text variant="title" className="tabular-nums">{occupancy.vacant}</Text>
              </CardContent>
            </Card>
            <Card variant="outlined" size="sm">
              <CardContent className="p-4">
                <Text variant="caption" className="text-muted-foreground">Other (reserved / blocked)</Text>
                <Text variant="title" className="tabular-nums">{occupancy.other}</Text>
              </CardContent>
            </Card>
          </div>

          <Card variant="outlined">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="size-4" /> Buildings
                </CardTitle>
                {hasUiPermission('unit.create') && (
                  <Button variant="outline" size="sm" leftIcon={Plus} onClick={() => setBuildingDialog({ open: true })}>
                    Add building
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {buildings.length === 0 ? (
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    No buildings yet — units can live without one, but blocks make listings tidier.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={Plus}
                    disabled={!hasUiPermission('unit.create')}
                    onClick={() => setBuildingDialog({ open: true })}
                  >
                    Add building
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {buildings.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-start justify-between gap-2 rounded-xl border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {b.code}
                          {b.name ? <span className="text-muted-foreground"> — {b.name}</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[b.floors != null ? `${b.floors} floors` : null, b.yearBuilt != null ? `built ${b.yearBuilt}` : null]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Boxes className="size-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {units.filter((u) => u.building?.id === b.id).length} units
                          </span>
                          {b.isActive === false ? <Badge variant="neutral" size="sm">Inactive</Badge> : null}
                        </div>
                      </div>
                      {hasUiPermission('unit.update') ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          leftIcon={Pencil}
                          onClick={() => setBuildingDialog({ open: true, building: b })}
                          aria-label={`Edit building ${b.code}`}
                        />
                      ) : null}
                      {hasUiPermission('unit.delete') ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          leftIcon={Trash2}
                          onClick={() => setDeleteBuilding(b)}
                          aria-label={`Delete building ${b.code}`}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <ResponsiveDataListing<UnitRow>
            title="Units"
            hideHeaderOnMobile
            items={filtered}
            columns={columns}
            cardMapper={cardMapper}
            loading={false}
            skeletonCount={5}
            count={units.length}
            searchQuery={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search reference, label or building"
            filters={[
              {
                key: 'status',
                label: 'Status',
                value: statusFilter,
                onChange: setStatusFilter,
                options: [{ value: '', label: 'Status' }, ...UNIT_STATUSES],
              },
              {
                key: 'building',
                label: 'Building',
                value: buildingFilter,
                onChange: setBuildingFilter,
                options: [
                  { value: '', label: 'Building' },
                  { value: 'none', label: 'No building' },
                  ...buildings.map((b) => ({ value: b.id, label: b.name ? `${b.code} — ${b.name}` : b.code })),
                ],
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
              icon: LayoutGrid,
              title: units.length > 0 ? 'No units match' : 'No units yet',
              description:
                units.length > 0
                  ? 'Try different filters or search terms.'
                  : 'Add a single unit or generate a numbered run like 101–124.',
            }}
            primaryAction={
              hasUiPermission('unit.create')
                ? { label: 'Add unit', onClick: () => router.push(`/portfolio/${propertyId}/units/new`) }
                : undefined
            }
          />
        </>
      )}

      <BuildingForm
        open={buildingDialog.open}
        propertyId={propertyId}
        building={buildingDialog.building}
        propertyAmenities={propertyAmenities}
        onClose={() => setBuildingDialog({ open: false })}
        onSaved={load}
      />

      <BulkUnitsDialog
        open={bulkOpen}
        propertyId={propertyId}
        buildings={buildings.map(buildOptions)}
        unitTypes={unitTypes}
        defaultCurrency={propertyCurrency}
        onClose={() => setBulkOpen(false)}
        onCreated={load}
      />

      <ImportUnitsDialog
        open={importOpen}
        propertyId={propertyId}
        buildings={buildings.map(buildOptions)}
        defaultCurrency={propertyCurrency}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete unit {deleteTarget?.unitRef}?</AlertDialogTitle>
            <AlertDialogDescription>
              The unit record is removed permanently. Units with leases or charges can’t be deleted —
              you’ll get an error and can archive instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => confirmDeleteUnit()}>
              Delete unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteBuilding)} onOpenChange={(o) => !o && setDeleteBuilding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete building {deleteBuilding?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Buildings with units can’t be deleted — move or delete their units first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => confirmDeleteBuilding()}>
              Delete building
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
