'use client'

/** /portfolio/[propertyId]/units/[unitId]/edit — edit unit via shared UnitForm. */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Unit } from '@workspace/database'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { registerPhotoUrls, registerUploadedPhotos } from '@/lib/upload'
import {
  UnitForm,
  type UnitBuildingOption,
  type UnitFormValues,
  type UnitPropertyPhoto,
} from '../../../../_components/unit-form'

type DocRow = { id: string; kind: string; storageKey: string; fileName?: string | null }

export default function EditUnitPage() {
  const router = useRouter()
  const params = useParams<{ propertyId: string; unitId: string }>()
  const { propertyId, unitId } = params
  const { hasUiPermission } = useUiPermission()

  const [unit, setUnit] = useState<(Unit & { occupancy?: Unit['status'] }) | null>(null)
  const [buildings, setBuildings] = useState<UnitBuildingOption[]>([])
  const [propertyAmenities, setPropertyAmenities] = useState<string[]>([])
  const [propertyCurrency, setPropertyCurrency] = useState<string | undefined>(undefined)
  const [propertyPhotos, setPropertyPhotos] = useState<UnitPropertyPhoto[]>([])
  const [unitPhotos, setUnitPhotos] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/units/${unitId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/properties/${propertyId}/buildings`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/documents?entityType=UNIT&entityId=${unitId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/documents?entityType=PROPERTY&entityId=${propertyId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/properties/${propertyId}`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([unitRes, bRes, unitDocsRes, propDocsRes, propRes]) => {
        if (cancelled) return
        if (unitRes.unit) setUnit(unitRes.unit)
        else setNotFound(true)
        setBuildings((bRes.buildings ?? []) as UnitBuildingOption[])

        // Property amenities + currency (filtered amenities + rent prefill).
        const p = propRes?.property as { amenities?: unknown; currency?: unknown } | undefined
        if (Array.isArray(p?.amenities)) {
          setPropertyAmenities(p.amenities.filter((a): a is string => typeof a === 'string'))
        }
        if (typeof p?.currency === 'string' && p.currency) setPropertyCurrency(p.currency)

        const unitDocs = ((unitDocsRes.documents ?? []) as DocRow[]).filter(
          (d) => d.kind === 'PHOTO' && typeof d.storageKey === 'string',
        )
        setUnitPhotos(unitDocs)
        const unitKeys = new Set(unitDocs.map((d) => d.storageKey))
        // Picker shows property photos NOT already linked to this unit.
        const propPhotos = ((propDocsRes.documents ?? []) as DocRow[])
          .filter((d) => d.kind === 'PHOTO' && typeof d.storageKey === 'string' && !unitKeys.has(d.storageKey))
          .map((d) => ({ id: d.id, storageKey: d.storageKey, fileName: d.fileName ?? null }))
        setPropertyPhotos(propPhotos)
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

  if (!hasUiPermission('unit.update')) {
    return (
      <ScopeDenied
        title="Cannot edit units"
        message="You need the unit.update permission. Ask an owner or admin of your organization."
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

  const handleSubmit = async (values: UnitFormValues) => {
    setSaving(true)
    setServerErrors({})
    const media = Array.isArray(values.media) ? values.media : []
    const assignPhotoIds = Array.isArray(values.assignPhotoIds) ? (values.assignPhotoIds as string[]) : []
    const payload: Record<string, unknown> = { ...values }
    delete payload.media
    delete payload.assignPhotoIds
    try {
      const res = await fetch(`/api/units/${unitId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update unit')
        setSaving(false)
        return
      }

      // Media lifecycle: register new uploads + gallery links (failures are
      // surfaced but never block leaving the page).
      let registered = 0
      let failed = 0
      if (media.length > 0 || assignPhotoIds.length > 0) {
        const uploaded = await registerUploadedPhotos({
          entityType: 'UNIT',
          entityId: unitId,
          media,
          existingCount: unitPhotos.length,
        })
        registered += uploaded.registered
        failed += uploaded.failed
        if (assignPhotoIds.length > 0) {
          const assigned = await registerPhotoUrls({
            entityType: 'UNIT',
            entityId: unitId,
            existingCount: unitPhotos.length + uploaded.registered,
            photos: propertyPhotos
              .filter((p) => assignPhotoIds.includes(p.id))
              .map((p) => ({ storageKey: p.storageKey, fileName: p.fileName ?? undefined })),
          })
          registered += assigned.registered
          failed += assigned.failed
        }
      }

      toast.success(
        registered > 0 || failed > 0
          ? `Unit saved · ${registered} photo${registered === 1 ? '' : 's'} added${failed > 0 ? ` · ${failed} failed` : ''}`
          : 'Unit saved',
      )
      router.push(`/portfolio/${propertyId}/units`)
    } catch {
      toast.error('Network error — unit not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/portfolio/${propertyId}/units`)}>
          ← Units
        </Button>
      </div>
      <PageHeader title={`Edit ${unit.unitRef}`} description={unit.label ?? undefined} />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <UnitForm
          mode="edit"
          propertyId={propertyId}
          unitId={unitId}
          buildings={buildings}
          propertyPhotos={propertyPhotos}
          propertyAmenities={propertyAmenities}
          defaultCurrency={propertyCurrency}
          existingMediaUrls={unitPhotos.map((d) => d.storageKey)}
          initialValues={unit}
          saving={saving}
          serverErrors={serverErrors}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/portfolio/${propertyId}/units`)}
        />
      </div>
    </div>
  )
}
