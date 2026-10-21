'use client'

/** /portfolio/[propertyId]/edit — edit page → shared PropertyForm (edit mode). */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Property } from '@workspace/database'

import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { registerUploadedPhotos } from '@/lib/upload'
import {
  PropertyForm,
  type OrgKind,
  type OwnershipSummary,
  type PropertyFormValues,
} from '../../_components/property-form'

interface OwnershipRow {
  id: string
  propertyId: string | null
  unitId?: string | null
  sharePercent?: string | number | null
  startsAt: string
  endsAt?: string | null
  ownerParty: { id: string; name: string; partyType: string }
}

interface AgreementRow {
  id: string
  status: string
  startsAt: string
  endsAt?: string | null
  managementOrganization?: { id: string; name: string } | null
}

type PropertyDetail = Property & {
  ownerships?: OwnershipRow[]
  managementAgreements?: AgreementRow[]
}

interface OrgProfile {
  id: string
  name: string
  kind: OrgKind | null
  legalName: string | null
  taxId: string | null
}

function isoDate(v: string | undefined | null): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export default function EditPropertyPage() {
  const router = useRouter()
  const params = useParams<{ propertyId: string }>()
  const propertyId = params.propertyId
  const { hasUiPermission } = useUiPermission()

  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [org, setOrg] = useState<OrgProfile | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoCount, setPhotoCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const [propRes, orgRes, docsRes] = await Promise.all([
        fetch(`/api/properties/${propertyId}`, { credentials: 'include' }),
        fetch('/api/organization/current', { credentials: 'include' }).catch(() => null),
        fetch(
          `/api/documents?entityType=PROPERTY&entityId=${encodeURIComponent(propertyId)}`,
          { credentials: 'include' },
        ).catch(() => null),
      ])
      const propData = await propRes.json().catch(() => ({}))
      if (!propRes.ok) throw new Error(propData.error ?? 'Failed to load property')
      setProperty(propData.property as PropertyDetail)

      if (orgRes && orgRes.ok) {
        const orgData = await orgRes.json().catch(() => ({}))
        if (orgData.organization) setOrg(orgData.organization as OrgProfile)
      }
      if (docsRes && docsRes.ok) {
        const docsData = await docsRes.json().catch(() => ({}))
        const photos = ((docsData.documents ?? []) as { kind: string; storageKey: string }[]).filter(
          (d) => d.kind === 'PHOTO' && /^https?:\/\//.test(d.storageKey),
        )
        setPhotoUrls(photos.map((p) => p.storageKey))
        setPhotoCount(photos.length)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Property not found')
      router.push('/portfolio')
    } finally {
      setLoading(false)
    }
  }, [propertyId, router])

  useEffect(() => {
    load()
  }, [load])

  if (!hasUiPermission('property.update')) {
    return (
      <ScopeDenied
        title="Cannot edit properties"
        message="You need the property.update permission. Ask an owner or admin of your organization."
        backHref="/portfolio"
        backLabel="Back to Portfolio"
      />
    )
  }

  if (loading) return <PageLoader title="Loading property…" />
  if (!property) return null

  const handleSubmit = async (values: PropertyFormValues) => {
    setSaving(true)
    setServerErrors({})
    const { media, ...jsonValues } = values as PropertyFormValues & { media?: unknown }
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonValues),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save changes')
        setServerErrors({})
        setSaving(false)
        return
      }

      const { failed } = await registerUploadedPhotos({
        entityType: 'PROPERTY',
        entityId: propertyId,
        media,
        existingCount: photoCount,
      })
      toast.success('Property updated')
      if (failed > 0) {
        toast.error(`${failed} photo${failed === 1 ? '' : 's'} could not be registered`, {
          description: 'Open Media & Documents to re-upload them.',
        })
      }
      router.push(`/portfolio/${propertyId}`)
    } catch {
      toast.error('Network error — changes not saved')
      setSaving(false)
    }
  }

  // Landlord legacy rows: link this org as its own owner (find-or-create the
  // self party, then a 100% property-level ownership row).
  const handleLinkSelf = async () => {
    if (!org) return
    setLinking(true)
    try {
      let partyId = ''
      const listRes = await fetch('/api/owner-parties', { credentials: 'include' })
      if (listRes.ok) {
        const listData = await listRes.json().catch(() => ({}))
        const parties = (listData.parties ?? []) as { id: string; linkedOrganizationId?: string | null }[]
        partyId = parties.find((p) => p.linkedOrganizationId === org.id)?.id ?? ''
      }
      if (!partyId) {
        const createRes = await fetch('/api/owner-parties', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partyType: 'ORGANIZATION',
            name: org.legalName ?? org.name,
            kraPin: org.taxId ?? undefined,
            linkedOrganizationId: org.id,
          }),
        })
        const createData = await createRes.json().catch(() => ({}))
        if (!createRes.ok) throw new Error(createData.error ?? 'Could not create the owner party')
        partyId = createData.party.id as string
      }
      const ownRes = await fetch(`/api/properties/${propertyId}/ownerships`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerPartyId: partyId,
          sharePercent: 100,
          startsAt: new Date().toISOString().slice(0, 10),
        }),
      })
      if (!ownRes.ok) {
        const ownData = await ownRes.json().catch(() => ({}))
        throw new Error(ownData.error ?? 'Could not link the owner')
      }
      toast.success('Organization linked as owner')
      setLoading(true)
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not link the owner')
    } finally {
      setLinking(false)
    }
  }

  // Read-only ownership card payload (property-level row only; unit-level
  // strata rows live on their units).
  const propOwnership =
    property.ownerships?.find((o) => o.propertyId === property.id && !o.unitId) ?? null
  const agreement = property.managementAgreements?.[0] ?? null
  const ownershipSummary: OwnershipSummary | null = propOwnership
    ? {
        ownerName: propOwnership.ownerParty.name,
        ownerPartyType: propOwnership.ownerParty.partyType,
        sharePercent: propOwnership.sharePercent ?? null,
        startsAt: isoDate(propOwnership.startsAt),
        agreement: agreement
          ? {
              status: agreement.status,
              startsAt: isoDate(agreement.startsAt) ?? '',
              endsAt: isoDate(agreement.endsAt),
              managerName: agreement.managementOrganization?.name ?? null,
            }
          : null,
      }
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Edit ${property.name}`} description="Changes apply immediately." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <PropertyForm
          mode="edit"
          key={property.id}
          orgKind={org?.kind}
          propertyId={propertyId}
          existingMediaUrls={photoUrls}
          ownershipSummary={ownershipSummary}
          onLinkSelf={!propOwnership && org ? handleLinkSelf : undefined}
          initialValues={property}
          saving={saving || linking}
          serverErrors={serverErrors}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/portfolio/${propertyId}`)}
        />
      </div>
    </div>
  )
}
