'use client'

/** /sales/listings/new — draft a listing (plan-slice-5 §3). */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { ListingForm, type ListingFormValues } from '../../_components/listing-form'

export default function NewListingPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (values: ListingFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create the listing')
        setSaving(false)
        return
      }
      toast.success('Listing drafted — add a pin and price, then publish')
      router.push(`/sales/listings/${data.listing.id}`)
    } catch {
      toast.error('Network error — listing not saved')
      setSaving(false)
    }
  }

  if (!hasUiPermission('listing.create')) {
    return (
      <ScopeDenied
        message="You need the listing.create permission to draft listings. Ask an owner or admin of your organization."
        backHref="/sales/listings"
        backLabel="Back to listings"
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/sales/listings')}>
          ← Listings
        </Button>
      </div>
      <PageHeader title="New listing" description="Draft a for-sale or for-rent listing." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <ListingForm
          mode="create"
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/sales/listings')}
        />
      </div>
    </div>
  )
}
