'use client'

/**
 * /portfolio/[propertyId] — property detail shell (plan-slice-1 §4.2,
 * redesigned per siso-design/portfolio-property.webp): vertical SectionNav
 * rail (?tab= deep links preserved) + Overview hero (cover slot, chips,
 * address/maps), KPI row (units, lease-derived occupancy ring, balance
 * placeholder, buildings) and a details grid. Actions gated with
 * hasUiPermission; the API enforces for real.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Property, UnitStatus } from '@workspace/database'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@workspace/ui/components/alert-dialog'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { Text } from '@workspace/ui/components/text'
import { toast } from '@workspace/ui/components/toast'

import { SectionNav } from '@/app/(dashboard)/_components/domain/section-nav'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { CoverThumb, MoneyCell, OccupancyRing } from '@/app/(dashboard)/_components/domain/listing'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import {
  hasMapPin,
  mapsAddressUrl,
  mapsDirectionsUrl,
  mapsPinUrl,
  mapsSatelliteUrl,
} from '@/lib/maps'
import { PROPERTY_CATEGORIES, type PropertyDefaultsInput } from '@/lib/domain/property-constants'
import { PropertyStatusBadge, humanizeAction } from '../_components/property-status'
import { UnitStatusBadge } from '../_components/unit-status'
import { OwnershipTab } from '../_components/ownership-tab'
import { ManagementTab } from '../_components/management-tab'
import { MediaTab } from '../_components/media-tab'

type PropertyDetail = Property & {
  _count: { units: number; buildings: number; ownerships: number; documents: number }
  occupancy: { occupied: number; total: number; rate: number }
  coverPhoto?: string | null
  /** Derived outstanding balance — present when the caller holds charge.list. */
  balance?: { amount: string; currency: string } | null
}

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

/** Activity tab — own fetch (mounts only when the tab opens). */
function ActivityTab({ propertyId }: { propertyId: string }) {
  const [entries, setEntries] = useState<
    { id: string; action: string; actorUserId: string | null; createdAt: string }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/properties/${propertyId}/activity`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load activity')
        const data = await res.json()
        return (data.entries ?? []) as typeof entries
      })
      .then((list) => {
        if (!cancelled) setEntries(list)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load activity')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

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

/** Units section — occupancy summary + deep link to the unit manager. */
function UnitsTab({ propertyId }: { propertyId: string }) {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [units, setUnits] = useState<
    { id: string; unitRef: string; unitType: string; occupancy: string }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/properties/${propertyId}/units`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load units')
        const data = await res.json()
        return (data.units ?? []) as typeof units
      })
      .then((list) => {
        if (!cancelled) setUnits(list)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load units')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  if (loading) return <PageLoader title="Loading units…" description="" />

  const occupied = units.filter((u) => u.occupancy === 'OCCUPIED').length
  const vacant = units.filter((u) => u.occupancy === 'VACANT').length

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card variant="outlined" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <Text variant="caption" className="text-muted-foreground">Occupied</Text>
            <Text variant="title" className="tabular-nums">{occupied}</Text>
          </CardContent>
        </Card>
        <Card variant="outlined" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <Text variant="caption" className="text-muted-foreground">Vacant</Text>
            <Text variant="title" className="tabular-nums">{vacant}</Text>
          </CardContent>
        </Card>
        <Card variant="outlined" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <Text variant="caption" className="text-muted-foreground">Total</Text>
            <Text variant="title" className="tabular-nums">{units.length}</Text>
          </CardContent>
        </Card>
      </div>

      {units.length === 0 ? (
        <Card variant="outlined" size="sm" className="items-center p-8 text-center">
          <Text variant="bodyMuted">No units yet — add one or generate a run like 101–124.</Text>
        </Card>
      ) : (
        <Card variant="outlined">
          <CardContent className="divide-y divide-border p-0">
            {units.slice(0, 8).map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.unitRef}</p>
                  <p className="text-xs text-muted-foreground">{u.unitType.replace(/_/g, ' ').toLowerCase()}</p>
                </div>
                <UnitStatusBadge status={u.occupancy as UnitStatus} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasUiPermission('unit.list') && (
        <Button variant="outline" onClick={() => router.push(`/portfolio/${propertyId}/units`)}>
          Manage units
        </Button>
      )}
    </div>
  )
}

export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams<{ propertyId: string }>()
  const propertyId = params.propertyId
  const { hasUiPermission } = useUiPermission()

  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/properties/${propertyId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load property')
        return data.property as PropertyDetail
      })
      .then((p) => {
        if (!cancelled) setProperty(p)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setNotFound(true)
        toast.error(err instanceof Error ? err.message : 'Property not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
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
            <div className="space-y-1 text-sm">
              <p className="text-foreground">{addressText || 'No address yet'}</p>
              {property.landmark ? (
                <p className="text-muted-foreground">Near {property.landmark}</p>
              ) : null}
              {pin ? (
                <p className="text-xs text-muted-foreground">Pin: {lat.toFixed(6)}, {lng.toFixed(6)}</p>
              ) : (
                <p className="text-xs text-warning">No map pin yet</p>
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
              <p className="text-sm text-muted-foreground">{property.description}</p>
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
        </div>
      </div>
    </div>
  )

  const sections = [
    { id: 'overview', label: 'Overview', content: overview },
    { id: 'units', label: 'Units', content: <UnitsTab propertyId={propertyId} /> },
    ...(hasUiPermission('ownership.list')
      ? [{ id: 'ownership', label: 'Ownership', content: <OwnershipTab propertyId={propertyId} /> }]
      : []),
    ...(hasUiPermission('agreement.list')
      ? [{ id: 'management', label: 'Management', content: <ManagementTab propertyId={propertyId} /> }]
      : []),
    ...(hasUiPermission('document.read')
      ? [{ id: 'media', label: 'Media', content: <MediaTab propertyId={propertyId} /> }]
      : []),
    {
      id: 'activity',
      label: 'Activity',
      content: <ActivityTab propertyId={propertyId} />,
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
