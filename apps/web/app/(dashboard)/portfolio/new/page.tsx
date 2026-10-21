'use client'

/** /portfolio/new — create page → shared PropertyForm (wizard, create mode). */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { registerUploadedPhotos } from '@/lib/upload'
import {
  PropertyForm,
  type OrgKind,
  type OwnerOption,
  type PropertyFormValues,
} from '../_components/property-form'

interface OrgProfile {
  id: string
  name: string
  kind: OrgKind | null
  legalName: string | null
  taxId: string | null
  region: string | null
  country: string | null
}

export default function NewPropertyPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [org, setOrg] = useState<OrgProfile | null>(null)
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([])
  const [loading, setLoading] = useState(true)

  // Load account type (step branching) + owner picker (non-landlord) once.
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/organization/current', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to load your organization')
      const profile = data.organization as OrgProfile
      setOrg(profile)
      if (profile.kind && profile.kind !== 'LANDLORD') {
        const partiesRes = await fetch('/api/owner-parties', { credentials: 'include' })
        const partiesData = await partiesRes.json().catch(() => ({}))
        if (partiesRes.ok) {
          setOwnerOptions(
            ((partiesData.parties ?? []) as { id: string; name: string; partyType: string }[]).map(
              (p) => ({ value: p.id, label: `${p.name} (${p.partyType.toLowerCase()})` }),
            ),
          )
        }
        // no ownership.read → empty list; the inline "create new owner" path still works
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load organization')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!hasUiPermission('property.create')) {
    return (
      <ScopeDenied
        title="Cannot create properties"
        message="You need the property.create permission. Ask an owner or admin of your organization."
        backHref="/portfolio"
        backLabel="Back to Portfolio"
      />
    )
  }

  const handleSubmit = async (values: PropertyFormValues) => {
    setSaving(true)
    setServerErrors({})
    const { media, ...jsonValues } = values as PropertyFormValues & { media?: unknown }
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonValues),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create property')
        setSaving(false)
        return
      }
      const propertyId = data.property.id as string

      // Register Cloudinary uploads as property photos (first = cover).
      const { failed } = await registerUploadedPhotos({
        entityType: 'PROPERTY',
        entityId: propertyId,
        media,
        existingCount: 0,
      })

      toast.success('Property created')
      if (failed > 0) {
        toast.error(`${failed} photo${failed === 1 ? '' : 's'} could not be registered`, {
          description: 'Open Media & Documents to re-upload them.',
        })
      }
      router.push(`/portfolio/${propertyId}`)
    } catch {
      toast.error('Network error — property not created')
      setSaving(false)
    }
  }

  if (loading) return <PageLoader title="Loading your workspace…" />

  // Auto-completed derivable values (only while empty): region + country
  // from the organization profile. Currency already defaults to KES; the
  // server auto-generates the property code when the field is left blank.
  const initialValues = {
    region: org?.region ?? '',
    country: org?.country ?? 'KE',
  }
  const soleOwner = ownerOptions.length === 1 ? ownerOptions[0]?.value : undefined

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add property"
        description={
          org?.kind === 'LANDLORD'
            ? 'Create in your portfolio — your organization is linked as the owner automatically.'
            : 'Create in your own portfolio — pick or add the owner of record.'
        }
      />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <PropertyForm
          mode="create"
          orgKind={org?.kind}
          ownerOptions={ownerOptions}
          defaultOwnerPartyId={soleOwner}
          initialValues={initialValues}
          saving={saving}
          serverErrors={serverErrors}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/portfolio')}
        />
      </div>
    </div>
  )
}
