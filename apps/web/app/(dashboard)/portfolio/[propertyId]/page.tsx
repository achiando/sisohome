'use client'

/**
 * /portfolio/[propertyId] — property detail shell (plan-slice-1 §4.2,
 * redesigned per siso-design/portfolio-property.webp): vertical SectionNav
 * rail (?tab= deep links preserved) + Overview hero (cover slot, chips,
 * address/maps), KPI row (units, lease-derived occupancy ring, balance,
 * buildings) and a details grid. The Units tab reuses the SAME responsive
 * listing kit as the unit manager (ResponsiveDataListing + buildUnitColumns):
 * table on desktop, swipe cards on mobile, search + status/building filters.
 * Actions gated with hasUiPermission; the API enforces for real.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LayoutGrid, Link2, Users } from 'lucide-react'
import type { Property } from '@workspace/database'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@workspace/ui/components/alert-dialog'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { Text } from '@workspace/ui/components/text'
import { toast } from '@workspace/ui/components/toast'
import { ResponsiveDataListing } from '@workspace/ui/components/shared'

import { AddTenantDialog } from '@/app/(dashboard)/_components/domain/add-tenant-dialog'
import { SectionNav } from '@/app/(dashboard)/_components/domain/section-nav'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import {
  CoverThumb,
  MoneyCell,
  OccupancyRing,
  buildTenantColumns,
  buildUnitColumns,
  type TenantListRow,
  type UnitListRow,
} from '@/app/(dashboard)/_components/domain/listing'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import {
  hasMapPin,
  mapsAddressUrl,
  mapsDirectionsUrl,
  mapsPinUrl,
  mapsSatelliteUrl,
} from '@/lib/maps'
import { PROPERTY_CATEGORIES, type PropertyDefaultsInput } from '@/lib/domain/property-constants'
import { UNIT_STATUSES } from '@/lib/domain/unit-constants'
import { TENANT_STATUSES } from '@/lib/domain/tenant-constants'
import { PropertyStatusBadge, humanizeAction } from '../_components/property-status'
import {
  OwnershipTab,
  type OwnershipTabRow,
  type OwnerPartyOption,
} from '../_components/ownership-tab'
import {
  ManagementTab,
  type AgreementRow,
  type AssignmentRow,
  type MemberOption,
} from '../_components/management-tab'
import { MediaTab, type DocRow } from '../_components/media-tab'
import { PropertyAccountsCard, type LedgerAccountRow } from '../_components/property-accounts-card'
import { PropertyReportTab } from '../_components/property-report-tab'
import { RentRollTab } from '../_components/rent-roll-tab'
import { IntakeLinkDialog } from '../_components/intake-link-dialog'

type PropertyDetail = Property & {
  _count: { units: number; buildings: number; ownerships: number; documents: number }
  occupancy: { occupied: number; total: number; rate: number }
  coverPhoto?: string | null
  /** Derived outstanding balance — present when the caller holds charge.list. */
  balance?: { amount: string; currency: string } | null
  videoUrl?: string | null
}

type ActivityEntry = { id: string; action: string; actorUserId: string | null; createdAt: string }
type BuildingRow = { id: string; code: string; name?: string | null }

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-foreground">
      {children}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

/** Activity tab — data arrives with the page-level fetch-all. */
function ActivityTab({ entries, loading }: { entries: ActivityEntry[]; loading: boolean }) {
  if (loading) return <PageLoader title="Loading activity…" description="" />
  if (entries.length === 0) {
    return (
      <Card variant="outlined" size="sm" className="items-center p-8 text-center">
        <Text variant="bodyMuted">No recorded activity yet.</Text>
      </Card>
    )
  }

  return (
    <Card variant="outlined">
      <CardContent className="divide-y divide-border p-0">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{humanizeAction(e.action)}</p>
              <p className="text-xs text-muted-foreground">
                {e.actorUserId ? `By user ${e.actorUserId.slice(0, 8)}…` : 'System'}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(e.createdAt)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * Units section — SAME responsive listing kit as the unit manager page
 * (ResponsiveDataListing + buildUnitColumns): desktop table, mobile cards,
 * search + status/building filters, row actions (View/Edit/Add tenant/Delete)
 * and an occupancy summary. Deeper tooling (buildings, bulk add, CSV import)
 * lives one hop away via the "Unit manager" action.
 */
function UnitsTab({
  propertyId,
  units,
  buildings,
  loading,
  onRefresh,
}: {
  propertyId: string
  units: UnitListRow[]
  buildings: BuildingRow[]
  loading: boolean
  onRefresh: () => void
}) {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [buildingFilter, setBuildingFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UnitListRow | null>(null)
  const [addTenantUnit, setAddTenantUnit] = useState<UnitListRow | null>(null)
  const [busy, setBusy] = useState(false)

  const confirmDelete = async () => {
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
      onRefresh()
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  const filtered = (() => {
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
  })()

  const occupancy = (() => {
    const occupied = units.filter((u) => u.occupancy === 'OCCUPIED').length
    const vacant = units.filter((u) => u.occupancy === 'VACANT').length
    return { occupied, vacant, other: units.length - occupied - vacant }
  })()

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
    onAddTenant: hasUiPermission('lease.create') ? (u) => setAddTenantUnit(u) : undefined,
  })

  return (
    <div className="space-y-4">
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

      <ResponsiveDataListing<UnitListRow>
        title="Units"
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
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
            ? { label: 'Add unit', icon: LayoutGrid, onClick: () => router.push(`/portfolio/${propertyId}/units/new`) }
            : undefined
        }
        secondaryActions={
          hasUiPermission('unit.list')
            ? [
                {
                  label: 'Unit manager',
                  icon: LayoutGrid,
                  onClick: () => router.push(`/portfolio/${propertyId}/units`),
                },
              ]
            : undefined
        }
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete unit {deleteTarget?.unitRef}?</AlertDialogTitle>
            <AlertDialogDescription>
              The unit record is removed permanently. Units with leases or charges can’t be deleted —
              you’ll get an error.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => confirmDelete()}>
              Delete unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddTenantDialog
        open={Boolean(addTenantUnit)}
        unitId={addTenantUnit?.id ?? ''}
        unitLabel={addTenantUnit ? addTenantUnit.label || addTenantUnit.unitRef : null}
        onClose={() => setAddTenantUnit(null)}
        onSaved={onRefresh}
      />
    </div>
  )
}

/**
 * Tenants section — parties holding a lease at THIS property (the People
 * register lists every party the org captured; this is the property-scoped
 * slice of the same directory). Shares `buildTenantColumns` so both listings
 * render identical columns and mobile cards.
 */
function TenantsTab({
  propertyId,
  tenants,
  loading,
}: {
  propertyId: string
  tenants: TenantListRow[]
  loading: boolean
}) {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [intakeOpen, setIntakeOpen] = useState(false)

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

  const { columns, cardMapper } = buildTenantColumns({
    onOpen: (t) => router.push(`/people/tenants/${t.id}`),
  })

  const withActiveLease = tenants.filter((t) =>
    t.leases.some((l) => l.status === 'ACTIVE' || l.status === 'ENDING'),
  ).length
  const portalActive = tenants.filter((t) => t.portalStatus === 'ACTIVE').length

  if (loading) return <PageLoader title="Loading tenants…" description="" />

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card variant="outlined" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <Text variant="caption" className="text-muted-foreground">Tenants</Text>
            <Text variant="title" className="tabular-nums">{tenants.length}</Text>
          </CardContent>
        </Card>
        <Card variant="outlined" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <Text variant="caption" className="text-muted-foreground">With active lease</Text>
            <Text variant="title" className="tabular-nums">{withActiveLease}</Text>
          </CardContent>
        </Card>
        <Card variant="outlined" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <Text variant="caption" className="text-muted-foreground">Portal active</Text>
            <Text variant="title" className="tabular-nums">{portalActive}</Text>
          </CardContent>
        </Card>
      </div>

      <ResponsiveDataListing<TenantListRow>
        title="Tenants"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={false}
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
          title: 'No tenants here yet',
          description:
            tenants.length > 0
              ? 'No tenants match these filters.'
              : 'Nobody is leasing at this property yet. Create a lease to bring a tenant in.',
        }}
        primaryAction={
          hasUiPermission('lease.create')
            ? {
                label: 'Add lease',
                onClick: () => router.push(`/leasing/leases/new?propertyId=${propertyId}`),
              }
            : undefined
        }
        secondaryActions={
          hasUiPermission('application.create')
            ? [
                {
                  label: 'Share intake link',
                  icon: Link2,
                  onClick: () => setIntakeOpen(true),
                },
              ]
            : undefined
        }
      />

      <IntakeLinkDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        propertyId={propertyId}
      />
    </div>
  )
}

export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams<{ propertyId: string }>()
  const propertyId = params.propertyId
  const { hasUiPermission } = useUiPermission()

  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [units, setUnits] = useState<UnitListRow[]>([])
  const [buildings, setBuildings] = useState<BuildingRow[]>([])
  const [tenants, setTenants] = useState<TenantListRow[]>([])
  const [ownerships, setOwnerships] = useState<OwnershipTabRow[]>([])
  const [ownerParties, setOwnerParties] = useState<OwnerPartyOption[]>([])
  const [agreements, setAgreements] = useState<AgreementRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [accounts, setAccounts] = useState<LedgerAccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  /**
   * Single fetch-all on open (and after every mutation via onRefresh): one
   * round-trip bundle instead of a fetch per tab activation. Slices the caller
   * lacks permission for are skipped client-side (and 401/403 degrade to an
   * empty list) so a partial-failure user never sees toast spam.
   */
  const load = useCallback(() => {
    let cancelled = false

    const list = <T,>(url: string, key: string, label: string, enabled = true): Promise<T[]> => {
      if (!enabled) return Promise.resolve([])
      return fetch(url, { credentials: 'include' })
        .then(async (res) => {
          if (res.status === 401 || res.status === 403) return []
          if (!res.ok) {
            toast.error(`Failed to load ${label}`)
            return []
          }
          const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
          return (data?.[key] ?? []) as T[]
        })
        .catch(() => {
          toast.error(`Failed to load ${label}`)
          return [] as T[]
        })
    }

    Promise.all([
      fetch(`/api/properties/${propertyId}`, { credentials: 'include' }).then(
        async (res) => {
          const data = (await res.json().catch(() => ({}))) as { error?: string; property?: PropertyDetail }
          if (!res.ok || !data.property) throw new Error(data.error ?? 'Failed to load property')
          return { ok: true as const, property: data.property }
        },
        (err: unknown) => ({ ok: false as const, error: err }),
      ),
      list<UnitListRow>(`/api/properties/${propertyId}/units`, 'units', 'units', hasUiPermission('unit.list')),
      list<BuildingRow>(`/api/properties/${propertyId}/buildings`, 'buildings', 'buildings', hasUiPermission('unit.list')),
      list<TenantListRow>(`/api/tenants?propertyId=${propertyId}`, 'tenants', 'tenants', hasUiPermission('tenant.list')),
      list<OwnershipTabRow>(`/api/properties/${propertyId}/ownerships`, 'ownerships', 'ownership', hasUiPermission('ownership.list')),
      list<OwnerPartyOption>('/api/owner-parties', 'parties', 'owner parties', hasUiPermission('ownership.list')),
      list<AgreementRow>(`/api/agreements?propertyId=${propertyId}`, 'agreements', 'agreements', hasUiPermission('agreement.list')),
      list<AssignmentRow>(`/api/properties/${propertyId}/staff`, 'assignments', 'staff', hasUiPermission('agreement.list')),
      list<MemberOption>('/api/members', 'members', 'members', hasUiPermission('property.update')),
      list<DocRow>(`/api/documents?entityType=PROPERTY&entityId=${propertyId}`, 'documents', 'documents', hasUiPermission('document.read')),
      list<ActivityEntry>(`/api/properties/${propertyId}/activity`, 'entries', 'activity'),
      list<LedgerAccountRow>(`/api/properties/${propertyId}/accounts`, 'accounts', 'accounts', hasUiPermission('payment.list')),
    ])
      .then(([propRes, u, b, t, o, op, a, s, m, d, act, acct]) => {
        if (cancelled) return
        if (!propRes.ok) {
          setNotFound(true)
          toast.error(propRes.error instanceof Error ? propRes.error.message : 'Property not found')
          return
        }
        setProperty(propRes.property)
        setUnits(u)
        setBuildings(b)
        setTenants(t)
        setOwnerships(o)
        setOwnerParties(op)
        setAgreements(a)
        setAssignments(s)
        setMembers(m.filter((row) => row.userId))
        setDocuments(d)
        setActivity(act)
        setAccounts(acct)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // hasUiPermission is a per-render closure (see use-ui-permission) — adding
    // it to deps would refetch on every render. Property change is the only
    // meaningful trigger; permission flips ride a full navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  useEffect(() => load(), [load])

  if (loading) return <PageLoader title="Loading property…" />
  if (notFound || !property) {
    return (
      <ScopeDenied
        message="This property doesn't exist for your organization, or you don't have permission to view it."
        backHref="/portfolio"
        backLabel="Back to Portfolio"
      />
    )
  }

  const defaults = (property.defaults ?? {}) as PropertyDefaultsInput;
  const pin = hasMapPin(property.latitude, property.longitude)
  const lat = Number(property.latitude)
  const lng = Number(property.longitude)
  const pinUrl = pin ? mapsPinUrl(lat, lng, property.googlePlaceId) : null
  const directionsUrl = pin ? mapsDirectionsUrl(lat, lng) : null
  const satelliteUrl = pin ? mapsSatelliteUrl(lat, lng) : null
  const addressUrl =
    mapsAddressUrl(
      [property.addressLine1, property.addressLine2, property.locality, property.region]
        .filter(Boolean)
        .join(', '),
    )

  const runArchiveAction = async (path: 'archive' | 'unarchive') => {
    setBusy(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/${path}`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? `Failed to ${path}`)
        return
      }
      toast.success(path === 'archive' ? 'Property archived' : 'Property restored')
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete property')
        return
      }
      toast.success('Property deleted')
      router.push('/portfolio')
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  const addressText = [
    property.addressLine1,
    property.addressLine2,
    [property.locality, property.region].filter(Boolean).join(', '),
    property.postalCode,
    property.country,
  ]
    .filter(Boolean)
    .join(' · ')

  const overview = (
    <div className="space-y-4">
      {/* Hero — cover slot, chips, address + maps links */}
      <Card variant="outlined">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <CoverThumb name={property.name} coverUrl={property.coverPhoto} className="size-16 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <PropertyStatusBadge status={property.status} size="md" />
              <Badge variant="neutral">
                {PROPERTY_CATEGORIES.find((c) => c.value === property.category)?.label ?? property.category}
              </Badge>
              <Badge variant="outline">{property.propertyType.replace(/_/g, ' ').toLowerCase()}</Badge>
              {property.tags.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
            <div className="space-y-1">
              <Text variant="body">{addressText || 'No address yet'}</Text>
              {property.landmark ? (
                <Text variant="bodyMuted">Near {property.landmark}</Text>
              ) : null}
              {pin ? (
                <Text variant="caption">Pin: {lat.toFixed(6)}, {lng.toFixed(6)}</Text>
              ) : (
                <Text variant="caption" className="text-warning">No map pin yet</Text>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!pinUrl} onClick={() => pinUrl && window.open(pinUrl, '_blank', 'noopener')}>
                Open in Maps
              </Button>
              <Button variant="outline" size="sm" disabled={!directionsUrl} onClick={() => directionsUrl && window.open(directionsUrl, '_blank', 'noopener')}>
                Directions
              </Button>
              <Button variant="outline" size="sm" disabled={!satelliteUrl} onClick={() => satelliteUrl && window.open(satelliteUrl, '_blank', 'noopener')}>
                Satellite
              </Button>
              <Button variant="outline" size="sm" disabled={!addressUrl} onClick={() => addressUrl && window.open(addressUrl, '_blank', 'noopener')}>
                Search address
              </Button>
            </div>
            {property.description ? (
              <Text variant="bodyMuted">{property.description}</Text>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="outlined" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <Text variant="caption" className="text-muted-foreground">Units</Text>
            <Text variant="title" className="tabular-nums">{property._count.units}</Text>
          </CardContent>
        </Card>
        <Card variant="outlined" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <Text variant="caption" className="text-muted-foreground">Occupancy Rate</Text>
            <OccupancyRing
              rate={property.occupancy.rate}
              occupied={property.occupancy.occupied}
              total={property.occupancy.total}
            />
          </CardContent>
        </Card>
        <Card variant="outlined" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <Text variant="caption" className="text-muted-foreground">Balance</Text>
            {hasUiPermission('charge.list') ? (
              property.balance ? (
                <MoneyCell
                  value={property.balance.amount}
                  currency={property.balance.currency}
                  className="text-xl font-semibold"
                />
              ) : (
                <MoneyCell value={0} currency={property.currency ?? undefined} className="text-xl font-semibold" />
              )
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </CardContent>
        </Card>
        <Card variant="outlined" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <Text variant="caption" className="text-muted-foreground">Buildings</Text>
            <Text variant="title" className="tabular-nums">{property._count.buildings}</Text>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Details grid */}
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Code" value={property.code ?? '—'} />
            <DetailRow
              label="Category"
              value={PROPERTY_CATEGORIES.find((c) => c.value === property.category)?.label ?? property.category}
            />
            <DetailRow label="Type" value={property.propertyType.replace(/_/g, ' ').toLowerCase()} />
            <DetailRow label="Currency" value={property.currency} />
            <DetailRow
              label="Rent frequency"
              value={defaults.rentFrequency ? String(defaults.rentFrequency).toLowerCase() : '—'}
            />
            <DetailRow
              label="Deposit"
              value={defaults.depositMonths != null ? `${defaults.depositMonths} month(s)` : '—'}
            />
            <DetailRow label="Notice" value={defaults.noticeDays != null ? `${defaults.noticeDays} days` : '—'} />
            <DetailRow
              label="Service charge"
              value={defaults.serviceChargeRate != null ? `${defaults.serviceChargeRate}%` : '—'}
            />
            <DetailRow label="Created" value={formatDate(property.createdAt)} />
            <DetailRow label="Updated" value={formatDate(property.updatedAt)} />
            {defaults.lateFeeRule ? (
              <p className="pt-2 text-xs text-muted-foreground">Late fee: {String(defaults.lateFeeRule)}</p>
            ) : null}
          </CardContent>
        </Card>

        {/* Quick actions + amenities */}
        <div className="space-y-4">
          <Card variant="outlined">
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {hasUiPermission('property.update') && (
                <Button variant="outline" size="sm" onClick={() => router.push(`/portfolio/${propertyId}/edit`)}>
                  Edit property
                </Button>
              )}
              {hasUiPermission('unit.list') && (
                <Button variant="outline" size="sm" onClick={() => router.push(`/portfolio/${propertyId}/units`)}>
                  Manage units
                </Button>
              )}
              {hasUiPermission('document.create') && (
                <Button variant="outline" size="sm" onClick={() => router.push(`/portfolio/${propertyId}?tab=media`)}>
                  Upload media
                </Button>
              )}
              {property.status !== 'ARCHIVED' && hasUiPermission('property.archive') && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => runArchiveAction('archive')}>
                  Archive
                </Button>
              )}
              {property.status === 'ARCHIVED' && hasUiPermission('property.update') && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => runArchiveAction('unarchive')}>
                  Restore
                </Button>
              )}
            </CardContent>
          </Card>

          {(property.amenities.length > 0 || property.utilities.length > 0) && (
            <Card variant="outlined">
              <CardHeader>
                <CardTitle>Amenities & utilities</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {property.amenities.map((a) => (
                  <Chip key={a}>{a}</Chip>
                ))}
                {property.utilities.map((u) => (
                  <Chip key={u}>{u}</Chip>
                ))}
              </CardContent>
            </Card>
          )}

          <PropertyAccountsCard accounts={accounts} />
        </div>
      </div>
    </div>
  )

  const sections = [
    { id: 'overview', label: 'Overview', content: overview },
    {
      id: 'units',
      label: 'Units',
      content: (
        <UnitsTab
          propertyId={propertyId}
          units={units}
          buildings={buildings}
          loading={loading}
          onRefresh={load}
        />
      ),
    },
    ...(hasUiPermission('tenant.list')
      ? [
          {
            id: 'tenants',
            label: 'Tenants',
            content: <TenantsTab propertyId={propertyId} tenants={tenants} loading={loading} />,
          },
        ]
      : []),
    ...(hasUiPermission('ownership.list')
      ? [
          {
            id: 'ownership',
            label: 'Ownership',
            content: (
              <OwnershipTab
                propertyId={propertyId}
                rows={ownerships}
                parties={ownerParties}
                loading={loading}
                onRefresh={load}
              />
            ),
          },
        ]
      : []),
    ...(hasUiPermission('agreement.list')
      ? [
          {
            id: 'management',
            label: 'Management',
            content: (
              <ManagementTab
                propertyId={propertyId}
                agreements={agreements}
                assignments={assignments}
                members={members}
                loading={loading}
                onRefresh={load}
              />
            ),
          },
        ]
      : []),
    ...(hasUiPermission('document.read')
      ? [
          {
            id: 'media',
            label: 'Media',
            content: (
              <MediaTab
                propertyId={propertyId}
                docs={documents}
                videoUrl={property.videoUrl ?? null}
                loading={loading}
                onRefresh={load}
              />
            ),
          },
        ]
      : []),
    ...(hasUiPermission('charge.list')
      ? [
          {
            id: 'rent-roll',
            label: 'Rent roll',
            content: <RentRollTab propertyId={propertyId} currency={property.currency} />,
          },
          {
            id: 'report',
            label: 'Report',
            content: <PropertyReportTab propertyId={propertyId} currency={property.currency} />,
          },
        ]
      : []),
    {
      id: 'activity',
      label: 'Activity',
      content: <ActivityTab entries={activity} loading={loading} />,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/portfolio')}>
          ← Portfolio
        </Button>
      </div>
      <PageHeader
        title={property.name}
        description={[property.code, property.locality ?? property.addressLine1].filter(Boolean).join(' · ')}
        actions={
          <>
            {hasUiPermission('property.update') && (
              <Button variant="outline" onClick={() => router.push(`/portfolio/${propertyId}/edit`)}>
                Edit
              </Button>
            )}
            {property.status !== 'ARCHIVED' && hasUiPermission('property.archive') && (
              <Button variant="outline" disabled={busy} onClick={() => runArchiveAction('archive')}>
                Archive
              </Button>
            )}
            {property.status === 'ARCHIVED' && hasUiPermission('property.update') && (
              <Button variant="outline" disabled={busy} onClick={() => runArchiveAction('unarchive')}>
                Restore
              </Button>
            )}
            {property.status === 'DRAFT' && hasUiPermission('property.delete') && (
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <Button variant="destructive" disabled={busy} onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                    <AlertDialogDescription>
                      “{property.name}” will be permanently removed. This only works while the property
                      is a draft with no units, leases or agreements.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => runDelete()}>Delete draft</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        }
      />
      <SectionNav sections={sections} defaultTab="overview" />
    </div>
  )
}
