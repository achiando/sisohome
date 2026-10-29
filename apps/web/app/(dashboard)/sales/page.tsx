'use client'

/**
 * /sales — pipeline overview (plan-slice-5 §3): stage counters, the active
 * listings board, and the leads whose next action is due. MK marketing orgs
 * land here too (listing.list) and see their shared listings + own leads.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Handshake, Inbox, Tag, Users } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate, formatMoney, formatRelativeDay } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { AccessBadge, LeadStatusBadge, ListingStatusBadge } from './_components/status-badge'
import type { LeadRow, ListingRow } from './_components/sales-types'

function CounterCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Tag
  label: string
  value: number
  hint?: string
}) {
  return (
    <Card variant="filled">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default function SalesOverviewPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [listings, setListings] = useState<ListingRow[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/listings', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { listings: [] })),
      fetch('/api/leads', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { leads: [] })),
    ])
      .then(([l, d]: [{ listings?: ListingRow[] }, { leads?: LeadRow[] }]) => {
        if (cancelled) return
        setListings(l.listings ?? [])
        setLeads(d.leads ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load the sales board')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const counters = useMemo(() => {
    const published = listings.filter((l) => l.status === 'PUBLISHED' || l.status === 'UNDER_OFFER')
    const newLeads = leads.filter((l) => l.status === 'NEW')
    const viewing = leads.filter((l) => l.status === 'VIEWING')
    const offering = leads.filter((l) => l.status === 'OFFERING')
    const due = leads.filter((l) => l.needsAction)
    return { published, newLeads, viewing, offering, due }
  }, [listings, leads])

  if (!hasUiPermission('listing.list')) {
    return (
      <ScopeDenied message="You need the listing.list permission to view the sales board. Ask an owner or admin of your organization." />
    )
  }
  if (loading) return <PageLoader title="Loading the sales board…" />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Listings, leads, viewings, offers and cross-org handoffs."
        actions={
          hasUiPermission('lead.create') ? (
            <Button variant="primary" onClick={() => router.push('/sales/leads/new')}>
              Capture lead
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CounterCard icon={Tag} label="Live listings" value={counters.published.length} hint="Published or under offer" />
        <CounterCard icon={Users} label="New leads" value={counters.newLeads.length} />
        <CounterCard
          icon={Handshake}
          label="In viewing / offering"
          value={counters.viewing.length + counters.offering.length}
          hint={`${counters.viewing.length} viewing · ${counters.offering.length} offering`}
        />
        <CounterCard icon={Inbox} label="Leads needing action" value={counters.due.length} hint="Next action due" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Active listings</CardTitle>
            <Button variant="text" size="sm" onClick={() => router.push('/sales/listings')}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {counters.published.length === 0 ? (
              <p className="text-sm text-muted-foreground">No live listings yet.</p>
            ) : (
              counters.published.slice(0, 6).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => router.push(`/sales/listings/${l.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.property.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {l.askingPrice ? (
                      <span className="text-sm font-medium tabular-nums">
                        {formatMoney(l.askingPrice, l.currency)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Price on request</span>
                    )}
                    <ListingStatusBadge status={l.status} />
                    {l.access === 'shared' ? <AccessBadge access={l.access} /> : null}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Leads needing action</CardTitle>
            <Button variant="text" size="sm" onClick={() => router.push('/sales/leads')}>
              Inbox
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {counters.due.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due — you are on top of the pipeline.</p>
            ) : (
              counters.due.slice(0, 6).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => router.push(`/sales/leads/${l.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.listing?.title ?? l.property?.name ?? 'No interest linked'} · due{' '}
                      {l.nextActionAt ? formatRelativeDay(l.nextActionAt) : formatDate(l.nextActionAt)}
                    </p>
                  </div>
                  <LeadStatusBadge status={l.status} />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
