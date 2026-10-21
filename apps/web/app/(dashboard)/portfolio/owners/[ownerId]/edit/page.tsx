'use client'

/** /portfolio/owners/[ownerId]/edit — edit owner party via shared form. */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { PropertyOwnerParty } from '@workspace/database'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { OwnerPartyForm, type OwnerPartyFormValues } from '../../../_components/owner-party-form'

export default function EditOwnerPartyPage() {
  const router = useRouter()
  const params = useParams<{ ownerId: string }>()
  const ownerId = params.ownerId
  const { hasUiPermission } = useUiPermission()

  const [party, setParty] = useState<PropertyOwnerParty | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/owner-parties/${ownerId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Owner party not found')
        return data.party as PropertyOwnerParty
      })
      .then((p) => {
        if (!cancelled) setParty(p)
      })
      .catch(() => {
        if (!cancelled) toast.error('Owner party not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ownerId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('ownership.update')) {
    return (
      <ScopeDenied
        title="Cannot edit owner parties"
        message="You need the ownership.update permission. Ask an owner or admin of your organization."
        backHref="/portfolio/owners"
        backLabel="Back to owners"
      />
    )
  }

  if (loading) return <PageLoader title="Loading owner…" />
  if (!party) {
    return (
      <ScopeDenied
        message="This owner party doesn't exist for your organization."
        backHref="/portfolio/owners"
        backLabel="Back to owners"
      />
    )
  }

  const handleSubmit = async (values: OwnerPartyFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/owner-parties/${ownerId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save owner party')
        setSaving(false)
        return
      }
      toast.success('Owner party updated')
      router.push(`/portfolio/owners/${ownerId}`)
    } catch {
      toast.error('Network error — owner party not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/portfolio/owners/${ownerId}`)}>
          ← {party.name}
        </Button>
      </div>
      <PageHeader title="Edit owner party" description={party.name} />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <OwnerPartyForm
          mode="edit"
          initialValues={party}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/portfolio/owners/${ownerId}`)}
        />
      </div>
    </div>
  )
}
