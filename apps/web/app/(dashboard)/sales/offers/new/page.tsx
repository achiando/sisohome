'use client'

/** /sales/offers/new — record an offer (portfolio side only). */

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { OfferForm, type OfferFormValues } from '../../_components/offer-form'

function NewOfferForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)
  const preselectedListingId = searchParams.get('listingId') ?? ''

  const handleSubmit = async (values: OfferFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to record the offer')
        setSaving(false)
        return
      }
      toast.success('Offer recorded')
      router.push(`/sales/offers/${data.offer.id}`)
    } catch {
      toast.error('Network error — offer not saved')
      setSaving(false)
    }
  }

  if (!hasUiPermission('offer.create')) {
    return (
      <ScopeDenied
        message="You need the offer.create permission to record offers. Ask an owner or admin of your organization."
        backHref="/sales/offers"
        backLabel="Back to offers"
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/sales/offers')}>
          ← Offers
        </Button>
      </div>
      <PageHeader title="Record offer" description="Log a hunter's offer against one of your listings." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <OfferForm
          mode="create"
          initialValues={preselectedListingId ? { listingId: preselectedListingId } : null}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/sales/offers')}
        />
      </div>
    </div>
  )
}

export default function NewOfferPage() {
  return (
    <Suspense>
      <NewOfferForm />
    </Suspense>
  )
}
