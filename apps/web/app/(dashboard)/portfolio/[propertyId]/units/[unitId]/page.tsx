'use client'

/**
 * /portfolio/[propertyId]/units/[unitId] — unit detail (mirrors the lease
 * detail pattern): back link, header with the LEASE-DERIVED status badge +
 * gated actions, and DetailTabs — Overview (identity, space, rental defaults,
 * utility accounts, amenities, current occupant), Leases (register filtered
 * to this unit via ?unitId) and Photos (UNIT document gallery).
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, Camera, Car, FileText, Hash, Home, Ruler, StickyNote, User } from 'lucide-react'
import type { UnitStatus } from '@workspace/database'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'

import { DetailTabs, type DetailTab } from '@/app/(dashboard)/_components/domain/detail-tabs'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate, formatMoney, formatRelativeDay } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { formatDocumentKind } from '@/lib/domain/document-constants'
import { formatUnitKind } from '@/lib/domain/unit-constants'
import { UnitStatusBadge, unitStatusLabel } from '@/app/(dashboard)/portfolio/_components/unit-status'

type UnitDetail = {
  id: string
  unitRef: string
  label: string
  unitType: string
  floor: number | null
  areaValue: string | null
  areaUnit: string | null
  bedrooms: number | null
  bathrooms: number | null
  parkingBays: number | null
  status: UnitStatus
  occupancy: UnitStatus
  amenities: string[]
  notes: string | null
  isActive: boolean
  accountNumber: string | null
  waterMeterNumber: string | null
  electricityMeterNumber: string | null
  defaultRent: string | null
  currency: string | null
  billingFrequency: string | null
  depositDefault: string | null
  building: { id: string; code: string; name?: string | null } | null
  occupant: {
    tenantId: string
    displayName: string
    email?: string | null
    phone?: string | null
    relationship: string
    leaseId: string
    leaseEndsAt: string | null
    monthlyRent: string
    jointCount: number
  } | null
}

type LeaseListRow = {
  id: string
  leaseRef: string | null
  status: string
  startsAt: string
  endsAt: string | null
  currency: string
  billingFrequency: string
  units: { id: string; monthlyRent: string }[]
  parties: { id: string; relationship: string; tenant: { id: string; displayName: string } }[]
}

type DocRow = { id: string; kind: string; fileName: string; storageKey: string; caption: string | null }

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

function infoRow(icon: ReactNode, label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex size-9 items-center justify-center rounded-xl bg-muted">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate font-medium">{String(value)}</span>
      </span>
    </div>
  )
}

/** Leases tab — own fetch (mounts only when the tab opens). */
function LeasesTab({ unitId }: { unitId: string }) {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const allowed = hasUiPermission('lease.list')
  const [leases, setLeases] = useState<LeaseListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    fetch(`/api/leases?unitId=${encodeURIComponent(unitId)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load leases')
        return (data.leases ?? []) as LeaseListRow[]
      })
      .then((list) => {
        if (!cancelled) setLeases(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load leases')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [unitId, allowed])

  if (!allowed) {
    return (
      <Card variant="outlined" size="sm" className="items-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          You need the lease.list permission to see leases for this unit.
        </p>
      </Card>
    )
  }
  if (loading) return <PageLoader title="Loading leases…" description="" />
  if (error) {
    return (
      <Card variant="outlined" size="sm" className="items-center p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    )
  }
  if (!leases || leases.length === 0) {
    return (
      <Card variant="outlined" size="sm" className="items-center p-8 text-center">
        <p className="text-sm font-medium">No leases for this unit</p>
        {hasUiPermission('lease.create') ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              const params = new URLSearchParams({ unitId })
              router.push(`/leasing/leases/new?${params.toString()}`)
            }}
          >
            Add tenant
          </Button>
        ) : null}
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {leases.map((l) => {
        const primary = l.parties.find((p) => p.relationship === 'PRIMARY') ?? l.parties[0]
        const rent = l.units[0]?.monthlyRent
        return (
          <div
            key={l.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{l.leaseRef ?? l.id.slice(0, 8)}</p>
                <Badge variant="neutral" size="sm">{l.status}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {primary ? `${primary.tenant.displayName} · ` : ''}
                {formatDate(l.startsAt)} → {l.endsAt ? formatDate(l.endsAt) : 'open'}
                {rent ? ` · ${formatMoney(rent, l.currency)}` : ''}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push(`/leasing/leases/${l.id}`)}>
              Open
            </Button>
          </div>
        )
      })}
    </div>
  )
}

/** Photos tab — UNIT document gallery (uploads live on the edit page). */
function PhotosTab({ unitId, canManage, editHref }: { unitId: string; canManage: boolean; editHref: string }) {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const allowed = hasUiPermission('document.read')
  const [docs, setDocs] = useState<DocRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    fetch(`/api/documents?entityType=UNIT&entityId=${encodeURIComponent(unitId)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load photos')
        return (data.documents ?? []) as DocRow[]
      })
      .then((list) => {
        if (!cancelled) setDocs(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load photos')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [unitId, allowed])

  if (!allowed) {
    return (
      <Card variant="outlined" size="sm" className="items-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          You need the document.read permission to see unit media.
        </p>
      </Card>
    )
  }
  if (loading) return <PageLoader title="Loading photos…" description="" />
  if (error) {
    return (
      <Card variant="outlined" size="sm" className="items-center p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    )
  }

  const all = docs ?? []
  const photos = all.filter((d) => d.kind === 'PHOTO' && /^https?:\/\//.test(d.storageKey))
  const files = all.filter((d) => !photos.some((p) => p.id === d.id))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage ? (
          <Button variant="outline" size="sm" onClick={() => router.push(editHref)}>
            <Camera className="size-4" aria-hidden />
            Manage photos
          </Button>
        ) : null}
      </div>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-xs">
          <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No photos yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canManage ? 'Upload photos from the unit edit page.' : 'No media registered for this unit.'}
          </p>
        </div>
      ) : (
        <>
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => (
                <figure key={p.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.storageKey}
                    alt={p.fileName}
                    loading="lazy"
                    className="aspect-video w-full bg-muted object-cover"
                  />
                  <figcaption className="truncate px-3 py-2 text-xs text-muted-foreground" title={p.fileName}>
                    {p.fileName}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}

          {files.length > 0 ? (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-xs">
              {files.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={d.fileName}>
                      {d.fileName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{d.caption ?? '—'}</p>
                  </div>
                  <Badge variant="neutral" size="sm">{formatDocumentKind(d.kind)}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  )
}

export default function UnitDetailPage() {
  const router = useRouter()
  const params = useParams<{ propertyId: string; unitId: string }>()
  const propertyId = params.propertyId
  const unitId = params.unitId
  const { hasUiPermission } = useUiPermission()

  const [unit, setUnit] = useState<UnitDetail | null>(null)
  const [propertyName, setPropertyName] = useState<string | null>(null)
  const [propertyCurrency, setPropertyCurrency] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/units/${unitId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/properties/${propertyId}`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([unitRes, propRes]) => {
        if (cancelled) return
        if (unitRes.unit) setUnit(unitRes.unit)
        else setNotFound(true)
        const p = propRes?.property as { name?: string; currency?: string | null } | undefined
        if (typeof p?.name === 'string') setPropertyName(p.name)
        if (typeof p?.currency === 'string' && p.currency) setPropertyCurrency(p.currency)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [propertyId, unitId])

  useEffect(() => load(), [load])

  const confirmDelete = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/units/${unitId}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete unit')
        return
      }
      toast.success('Unit deleted')
      setDeleteOpen(false)
      router.push(`/portfolio/${propertyId}/units`)
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (!hasUiPermission('unit.read')) {
    return (
      <ScopeDenied
        title="Cannot view unit"
        message="You need the unit.read permission to view units. Ask an owner or admin of your organization."
        backHref={`/portfolio/${propertyId}/units`}
        backLabel="Back to units"
      />
    )
  }

  if (loading) return <PageLoader title="Loading unit…" />
  if (notFound || !unit) {
    return (
      <ScopeDenied
        message="This unit doesn’t exist for your organization, or you don’t have permission to view it."
        backHref={`/portfolio/${propertyId}/units`}
        backLabel="Back to units"
      />
    )
  }

  const currency = unit.currency ?? propertyCurrency ?? 'KES'
  const hasUtilityAccounts = Boolean(unit.accountNumber || unit.waterMeterNumber || unit.electricityMeterNumber)
  const statusMismatch = unit.status !== unit.occupancy
  const editHref = `/portfolio/${propertyId}/units/${unitId}/edit`
  const buildingLabel = unit.building
    ? [unit.building.code, unit.building.name].filter(Boolean).join(' ')
    : 'Directly on property'
  const description = [
    unit.label !== unit.unitRef ? unit.label : null,
    buildingLabel,
    propertyName,
    unit.isActive ? null : 'Inactive',
  ]
    .filter(Boolean)
    .join(' · ')

  const overview: DetailTab = {
    id: 'overview',
    label: 'Overview',
    content: (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {infoRow(<Home size={18} />, 'Kind', formatUnitKind(unit.unitType))}
          {infoRow(<Building2 size={18} />, 'Building', buildingLabel)}
          {infoRow(<Hash size={18} />, 'Floor', unit.floor != null ? `Floor ${unit.floor}` : null)}
          {infoRow(
            <Ruler size={18} />,
            'Area',
            unit.areaValue != null ? `${unit.areaValue} ${unit.areaUnit ?? ''}`.trim() : null,
          )}
          {infoRow(<Home size={18} />, 'Bedrooms', unit.bedrooms)}
          {infoRow(<Home size={18} />, 'Bathrooms', unit.bathrooms)}
          {infoRow(<Car size={18} />, 'Parking bays', unit.parkingBays)}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card variant="outlined">
            <CardContent className="space-y-1 p-4">
              <DetailRow label="Status" value={<UnitStatusBadge status={unit.occupancy} />} />
              {statusMismatch ? (
                <DetailRow label="Stored status" value={unitStatusLabel(unit.status)} />
              ) : null}
              <DetailRow label="Record" value={unit.isActive ? 'Active' : 'Inactive'} />
              <DetailRow label="Unit reference" value={unit.unitRef} />
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent className="space-y-1 p-4">
              <DetailRow
                label="Default rent"
                value={unit.defaultRent != null ? formatMoney(unit.defaultRent, currency) : '—'}
              />
              <DetailRow
                label="Billing"
                value={unit.billingFrequency ? `${unit.billingFrequency.toLowerCase()} · ${currency}` : `— · ${currency}`}
              />
              <DetailRow
                label="Deposit default"
                value={unit.depositDefault != null ? `${Number(unit.depositDefault)} months` : '—'}
              />
            </CardContent>
          </Card>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          Rental defaults are templates — live leases and posted charges are unaffected by edits here.
        </p>

        {hasUtilityAccounts ? (
          <Card variant="outlined">
            <CardContent className="space-y-1 p-4">
              <DetailRow label="Billing account" value={unit.accountNumber ?? '—'} />
              <DetailRow label="Water meter" value={unit.waterMeterNumber ?? '—'} />
              <DetailRow label="Electricity meter" value={unit.electricityMeterNumber ?? '—'} />
            </CardContent>
          </Card>
        ) : null}

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Unit amenities</p>
          {unit.amenities.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {unit.amenities.map((a) => (
                <Chip key={a}>{a}</Chip>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No unit-specific amenities. Building and property amenities apply.
            </p>
          )}
        </div>

        {unit.occupant ? (
          <Card variant="outlined">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-muted">
                      <User size={18} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{unit.occupant.displayName}</p>
                      <p className="text-xs text-muted-foreground">{unit.occupant.relationship}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Lease ends {formatDate(unit.occupant.leaseEndsAt)} ({formatRelativeDay(unit.occupant.leaseEndsAt)})
                    {unit.occupant.jointCount > 0 ? ` · +${unit.occupant.jointCount} joint tenant(s)` : ''}
                  </p>
                  {unit.occupant.email || unit.occupant.phone ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[unit.occupant.email, unit.occupant.phone].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatMoney(unit.occupant.monthlyRent, currency)}</p>
                  <p className="text-xs text-muted-foreground">per month</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => router.push(`/leasing/leases/${unit.occupant!.leaseId}`)}
                  >
                    View lease
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {unit.notes ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <StickyNote size={16} aria-hidden /> Notes
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{unit.notes}</p>
          </div>
        ) : null}
      </div>
    ),
  }

  const leasesTab: DetailTab = {
    id: 'leases',
    label: 'Leases',
    content: <LeasesTab unitId={unitId} />,
  }

  const photosTab: DetailTab = {
    id: 'photos',
    label: 'Photos',
    content: <PhotosTab unitId={unitId} canManage={hasUiPermission('unit.update')} editHref={editHref} />,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/portfolio/${propertyId}/units`)}>
          ← {propertyName || 'Units'}
        </Button>
      </div>

      <PageHeader
        title={unit.unitRef}
        description={description}
        actions={
          <>
            <UnitStatusBadge status={unit.occupancy} size="md" />
            {hasUiPermission('unit.update') ? (
              <Button variant="outline" onClick={() => router.push(editHref)}>
                Edit
              </Button>
            ) : null}
            {hasUiPermission('lease.create') && unit.occupancy === 'VACANT' ? (
              <Button
                variant="primary"
                onClick={() =>
                  router.push(`/leasing/leases/new?propertyId=${propertyId}&unitId=${unitId}`)
                }
              >
                Add tenant
              </Button>
            ) : null}
            {hasUiPermission('unit.delete') ? (
              <Button variant="text" className="text-destructive" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      <DetailTabs tabs={[overview, leasesTab, photosTab]} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete unit {unit.unitRef}?</AlertDialogTitle>
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
    </div>
  )
}
