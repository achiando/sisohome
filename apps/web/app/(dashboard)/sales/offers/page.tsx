'use client'

/**
 * /sales/offers — the offer register (plan-slice-5 §3), portfolio side only.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Handshake } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate, formatMoney } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { OFFER_STATUSES } from '@/lib/domain/sales-constants'
import { StatusBadge } from '../_components/status-badge'

interface OfferRow {
  id: string
  amount: number
  currency: string
  status: string
  offerDate: string
  listing: { id: string; title: string }
  lead: { id: string; displayName: string } | null
}

export default function OffersPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/offers', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load offers')
        const data = await res.json()
        return (data.offers ?? []) as OfferRow[]
      })
      .then((list) => {
        if (!cancelled) setOffers(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load offers')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    let list = offers
    if (statusFilter) list = list.filter((o) => o.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (o) => o.listing.title.toLowerCase().includes(q) || (o.lead?.displayName ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [offers, search, statusFilter])

  if (!hasUiPermission('offer.list')) {
    return (
      <ScopeDenied message="You need the offer.list permission to view offers. Ask an owner or admin of your organization." />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers"
        description="Purchase offers against your listings."
        actions={
          hasUiPermission('offer.create') ? (
            <Button variant="primary" onClick={() => router.push('/sales/offers/new')}>
              Record offer
            </Button>
          ) : undefined
        }
      />
      <ResponsiveDataListing<OfferRow>
        title="Offers"
        hideHeaderOnMobile
        items={filtered}
        loading={loading}
        skeletonCount={5}
        count={offers.length}
        rowKey={(o) => o.id}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search listing or hunter…"
        columns={[
          {
            header: 'Listing',
            cell: (o) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{o.listing.title}</p>
                <p className="truncate text-xs text-muted-foreground">{o.lead?.displayName ?? 'No hunter'}</p>
              </div>
            ),
          },
          {
            header: 'Amount',
            cell: (o) => (
              <span className="text-sm font-medium tabular-nums">{formatMoney(o.amount, o.currency)}</span>
            ),
          },
          {
            header: 'Offered',
            cell: (o) => <span className="text-sm">{formatDate(o.offerDate)}</span>,
          },
          { header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
        ]}
        cardMapper={{
          id: (o) => o.id,
          title: (o) => o.listing.title,
          subtitle: (o) => o.lead?.displayName ?? 'No hunter',
          amount: (o) => (
            <span className="font-semibold tabular-nums">{formatMoney(o.amount, o.currency)}</span>
          ),
          detailFields: (o) => [{ label: 'Status', value: <StatusBadge status={o.status} /> }],
          detailHref: (o) => `/sales/offers/${o.id}`,
        }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'All statuses' }, ...OFFER_STATUSES],
          },
        ]}
        filterChips
        emptyState={{
          icon: Handshake,
          title: 'No offers yet',
          description:
            offers.length > 0 ? 'No offers match these filters.' : 'Record the first offer on a published listing.',
        }}
        primaryAction={
          hasUiPermission('offer.create')
            ? { label: 'Record offer', onClick: () => router.push('/sales/offers/new') }
            : undefined
        }
      />
    </div>
  )
}
