'use client'

/**
 * /sales/listings/[id] — listing detail (plan-slice-5 §3): status actions,
 * price-history timeline, offers, and a projection banner for the shared
 * (marketing) side.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate, formatMoney } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { AccessBadge, ListingStatusBadge, StatusBadge, labelize } from '../../_components/status-badge'
import { ListingLifecycleActions } from '../../_components/listing-lifecycle'
import type { ListingRow } from '../../_components/sales-types'

export default function ListingDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { hasUiPermission } = useUiPermission()
  const [listing, setListing] = useState<ListingRow | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (!hasUiPermission('listing.read')) {
    return (
      <ScopeDenied
        message="You need the listing.read permission to view listings. Ask an owner or admin of your organization."
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

  const isShared = listing.access === 'shared'
  const history = listing.priceHistory ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={listing.title}
        description={`${listing.property.name}${listing.property.locality ? ` · ${listing.property.locality}` : ''}`}
        actions={
          <>
            {hasUiPermission('listing.update') ? (
              <Button variant="outline" onClick={() => router.push(`/sales/listings/${id}/edit`)}>
                Edit
              </Button>
            ) : null}
            {hasUiPermission('listing.publish') || hasUiPermission('listing.update') ? (
              <ListingLifecycleActions listing={listing} onChanged={load} />
            ) : null}
          </>
        }
      />

      {isShared ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          Shared listing — you are viewing a projection. Content and publishing are open to you;
          price, terms and closing stay with the portfolio organization.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1"><ListingStatusBadge status={listing.status} /></div>
          </CardContent>
        </Card>
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {listing.askingPrice
                ? formatMoney(listing.askingPrice, listing.currency)
                : 'On request'}
            </p>
          </CardContent>
        </Card>
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Purpose</p>
            <p className="mt-1 text-sm font-medium">{labelize(listing.purpose)}</p>
          </CardContent>
        </Card>
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Access</p>
            <div className="mt-1"><AccessBadge access={listing.access} /></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {listing.description ? (
              <p className="whitespace-pre-wrap text-muted-foreground">{listing.description}</p>
            ) : null}
            {listing.highlights.length > 0 ? (
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {listing.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : null}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
              <div>
                <dt className="text-xs text-muted-foreground">Basis</dt>
                <dd>{labelize(listing.priceFrequency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Published</dt>
                <dd>{formatDate(listing.publishedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Contact</dt>
                <dd>{[listing.contactPhone, listing.contactEmail].filter(Boolean).join(' · ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Commission</dt>
                <dd>
                  {listing.commissionRate ? `${listing.commissionRate}% (${labelize(listing.commissionBasis)})` : '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price history</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No price events yet.</p>
            ) : (
              <ol className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatMoney(h.price, listing.currency)}{' '}
                        <Badge variant={h.event === 'REDUCED' ? 'error' : h.event === 'INCREASED' ? 'success' : 'neutral'} size="sm">
                          {labelize(h.event)}
                        </Badge>
                      </p>
                      {h.note ? <p className="truncate text-xs text-muted-foreground">{h.note}</p> : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(h.changedAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {!isShared ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Offers ({(listing.offers ?? []).length})</CardTitle>
            <Button variant="text" size="sm" onClick={() => router.push(`/sales/offers/new?listingId=${id}`)}>
              New offer
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {(listing.offers ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers yet.</p>
            ) : (
              (listing.offers ?? []).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => router.push(`/sales/offers/${o.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {formatMoney(o.amount, o.currency)} · {o.lead?.displayName ?? 'No lead'}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(o.offerDate)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
