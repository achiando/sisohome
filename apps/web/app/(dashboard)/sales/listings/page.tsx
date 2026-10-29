'use client'

/**
 * /sales/listings — the listing register (plan-slice-5 §3): Mine /
 * Shared-with-me badge per row, status + purpose filters.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tag } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatMoney } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { LISTING_PURPOSES, LISTING_STATUSES } from '@/lib/domain/sales-constants'
import { AccessBadge, ListingStatusBadge, labelize } from '../_components/status-badge'
import type { ListingRow } from '../_components/sales-types'

export default function ListingsPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [listings, setListings] = useState<ListingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [purposeFilter, setPurposeFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/listings', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load listings')
        const data = await res.json()
        return (data.listings ?? []) as ListingRow[]
      })
      .then((list) => {
        if (!cancelled) setListings(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load listings')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    let list = listings
    if (statusFilter) list = list.filter((l) => l.status === statusFilter)
    if (purposeFilter) list = list.filter((l) => l.purpose === purposeFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (l) => l.title.toLowerCase().includes(q) || l.property.name.toLowerCase().includes(q),
      )
    }
    return list
  }, [listings, search, statusFilter, purposeFilter])

  if (!hasUiPermission('listing.list')) {
    return (
      <ScopeDenied message="You need the listing.list permission to view listings. Ask an owner or admin of your organization." />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listings"
        description="For-sale and for-rent listings you own, manage, or share with your organization."
        actions={
          hasUiPermission('listing.create') ? (
            <Button variant="primary" onClick={() => router.push('/sales/listings/new')}>
              New listing
            </Button>
          ) : undefined
        }
      />
      <ResponsiveDataListing<ListingRow>
        title="Listings"
        hideHeaderOnMobile
        items={filtered}
        loading={loading}
        skeletonCount={5}
        count={listings.length}
        rowKey={(l) => l.id}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title or property…"
        columns={[
          {
            header: 'Listing',
            cell: (l) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{l.title}</p>
                <p className="truncate text-xs text-muted-foreground">{l.property.name}</p>
              </div>
            ),
          },
          {
            header: 'Purpose',
            cell: (l) => (
              <span className="text-sm">{labelize(l.purpose)}</span>
            ),
          },
          {
            header: 'Price',
            cell: (l) =>
              l.askingPrice ? (
                <span className="text-sm font-medium tabular-nums">
                  {formatMoney(l.askingPrice, l.currency)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">On request</span>
              ),
          },
          { header: 'Status', cell: (l) => <ListingStatusBadge status={l.status} /> },
          { header: 'Access', cell: (l) => <AccessBadge access={l.access} /> },
        ]}
        cardMapper={{
          id: (l) => l.id,
          title: (l) => l.title,
          subtitle: (l) => `${l.property.name} · ${labelize(l.purpose)}`,
          amount: (l) =>
            l.askingPrice ? (
              <span className="font-semibold tabular-nums">{formatMoney(l.askingPrice, l.currency)}</span>
            ) : (
              <span className="text-xs text-muted-foreground">On request</span>
            ),
          detailFields: (l) => [
            { label: 'Status', value: <ListingStatusBadge status={l.status} /> },
            { label: 'Access', value: <AccessBadge access={l.access} /> },
          ],
          detailHref: (l) => `/sales/listings/${l.id}`,
        }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'All statuses' }, ...LISTING_STATUSES],
          },
          {
            key: 'purpose',
            label: 'Purpose',
            value: purposeFilter,
            onChange: setPurposeFilter,
            options: [{ value: '', label: 'All purposes' }, ...LISTING_PURPOSES],
          },
        ]}
        filterChips
        emptyState={{
          icon: Tag,
          title: 'No listings yet',
          description:
            listings.length > 0
              ? 'No listings match these filters.'
              : 'Draft your first for-sale or for-rent listing to start the board.',
        }}
        primaryAction={
          hasUiPermission('listing.create')
            ? { label: 'New listing', onClick: () => router.push('/sales/listings/new') }
            : undefined
        }
      />
    </div>
  )
}
