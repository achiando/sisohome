'use client'

/** /portfolio/[propertyId]/units/new — create unit via shared UnitForm. */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
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
} from '../../../_components/unit-form'

export default function NewUnitPage() {
  const router = useRouter()
  const params = useParams<{ propertyId: string }>()
  const propertyId = params.propertyId
  const { hasUiPermission } = useUiPermission()

  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [buildings, setBuildings] = useState<UnitBuildingOption[]>([])
  const [propertyName, setPropertyName] = useState('')
  const [propertyAmenities, setPropertyAmenities] = useState<string[]>([])
  const [propertyCurrency, setPropertyCurrency] = useState<string | undefined>(undefined)
  const [propertyPhotos, setPropertyPhotos] = useState<UnitPropertyPhoto[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/properties/${propertyId}/buildings`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load buildings')
        if (!cancelled) setBuildings((data.buildings ?? []) as UnitBuildingOption[])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load buildings')
      })
    fetch(`/api/properties/${propertyId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.property) return
        const p = data.property as { name?: string; amenities?: unknown; currency?: unknown }
        if (p.name) setPropertyName(p.name)
        if (Array.isArray(p.amenities)) {
          setPropertyAmenities(p.amenities.filter((a): a is string => typeof a === 'string'))
        }
        if (typeof p.currency === 'string' && p.currency) setPropertyCurrency(p.currency)
      })
      .catch(() => {})
    fetch(`/api/documents?entityType=PROPERTY&entityId=${propertyId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const photos = ((data.documents ?? []) as { id: string; kind: string; storageKey: string; fileName?: string | null }[])
          .filter((d) => d.kind === 'PHOTO' && typeof d.storageKey === 'string')
          .map((d) => ({ id: d.id, storageKey: d.storageKey, fileName: d.fileName ?? null }))
        setPropertyPhotos(photos)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load property photos for selection')
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  if (!hasUiPermission('unit.create')) {
    return (
      <ScopeDenied
        title="Cannot create units"
        message="You need the unit.create permission. Ask an owner or admin of your organization."
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
      const res = await fetch(`/api/properties/${propertyId}/units`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create unit')
        setSaving(false)
        return
      }
      const unitId = data.unit?.id as string | undefined

      // Media lifecycle: uploads first (first one may take the cover), then
      // gallery links (never cover when uploads already landed). Failures
      // never block navigation — the user can re-add from the edit page.
      let registered = 0
      let failed = 0
      if (unitId && (media.length > 0 || assignPhotoIds.length > 0)) {
        const uploaded = await registerUploadedPhotos({
          entityType: 'UNIT',
          entityId: unitId,
          media,
          existingCount: 0,
        })
        registered += uploaded.registered
        failed += uploaded.failed
        if (assignPhotoIds.length > 0) {
          const assigned = await registerPhotoUrls({
            entityType: 'UNIT',
            entityId: unitId,
            existingCount: uploaded.registered,
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
          ? `Unit created · ${registered} photo${registered === 1 ? '' : 's'} added${failed > 0 ? ` · ${failed} failed` : ''}`
          : 'Unit created',
      )
      // Photos were added → land where they're visible; otherwise keep the
      // existing list flow.
      if (unitId && registered + failed > 0) {
        router.push(`/portfolio/${propertyId}/units/${unitId}/edit`)
      } else {
        router.push(`/portfolio/${propertyId}/units`)
      }
    } catch {
      toast.error('Network error — unit not created')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/portfolio/${propertyId}/units`)}>
          ← Units{propertyName ? ` · ${propertyName}` : ''}
        </Button>
      </div>
      <PageHeader title="Add unit" description="One unit now — or use Bulk add to generate a whole run." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <UnitForm
          mode="create"
          propertyId={propertyId}
          buildings={buildings}
          propertyPhotos={propertyPhotos}
          propertyAmenities={propertyAmenities}
          defaultCurrency={propertyCurrency}
          saving={saving}
          serverErrors={serverErrors}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/portfolio/${propertyId}/units`)}
        />
      </div>
    </div>
  )
}
