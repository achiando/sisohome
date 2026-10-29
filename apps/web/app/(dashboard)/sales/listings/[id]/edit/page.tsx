'use client'

/** /sales/listings/[id]/edit — edit content/price (shared side = content only). */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { ListingForm, type ListingFormValues } from '../../../_components/listing-form'
import type { ListingRow } from '../../../_components/sales-types'

export default function EditListingPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { hasUiPermission } = useUiPermission()
  const [listing, setListing] = useState<ListingRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/listings/${id}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Listing not found')
        return data.listing as ListingRow
      })
      .then((l) => {
        if (!cancelled) setListing(l)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Listing not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => load(), [load])

  const handleSubmit = async (values: ListingFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save the listing')
        setSaving(false)
        return
      }
      toast.success('Listing saved')
      router.push(`/sales/listings/${id}`)
    } catch {
      toast.error('Network error — listing not saved')
      setSaving(false)
    }
  }

  if (!hasUiPermission('listing.update')) {
    return (
      <ScopeDenied
        message="You need the listing.update permission to edit listings. Ask an owner or admin of your organization."
        backHref="/sales/listings"
        backLabel="Back to listings"
      />
    )
  }
  if (loading) return <PageLoader title="Loading listing…" />
  if (!listing) {
    return (
      <ScopeDenied
        message="This listing doesn't exist for your organization."
        backHref="/sales/listings"
        backLabel="Back to listings"
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/sales/listings/${id}`)}>
          ← Listing
        </Button>
      </div>
      <PageHeader title="Edit listing" description={listing.title} />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <ListingForm
          mode="edit"
          shared={listing.access === 'shared'}
          initialValues={listing}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/sales/listings/${id}`)}
        />
      </div>
    </div>
  )
}
