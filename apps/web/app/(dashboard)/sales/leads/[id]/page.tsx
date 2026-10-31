'use client'

/**
 * /sales/leads/[id] — lead detail (plan-slice-5 §3): pipeline card, viewings,
 * offers, and the handoff timeline (outbound + received).
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
import { formatDate, formatMoney, formatRelativeDay } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { HandoffDialog } from '../../_components/handoff-dialog'
import { LeadStatusBadge, StatusBadge, labelize } from '../../_components/status-badge'

interface ViewingHit {
  id: string
  scheduledAt: string
  status: string
  feedback: string | null
  property: { id: string; name: string }
}

interface OfferHit {
  id: string
  amount: number
  currency: string
  status: string
  offerDate: string
  listing: { id: string; title: string }
  deal: { id: string; status: string } | null
}

interface HandoffHit {
  id: string
  status: string
  message: string | null
  createdAt: string
  fromOrganization?: { id: string; name: string } | null
  toOrganization?: { id: string; name: string } | null
}

interface LeadDetail {
  id: string
  displayName: string
  phone: string | null
  email: string | null
  preferredChannel: string
  source: string
  status: string
  budgetMin: number | null
  budgetMax: number | null
  nextActionAt: string | null
  notes: string | null
  listing: { id: string; title: string } | null
  property: { id: string; name: string } | null
  viewings: ViewingHit[]
  offers: OfferHit[]
  handoffs: HandoffHit[]
}

interface LeadResponse {
  lead: LeadDetail
}

export default function LeadDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { hasUiPermission } = useUiPermission()
  const [data, setData] = useState<LeadResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [handoffOpen, setHandoffOpen] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/leads/${id}`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? 'Lead not found')
        return body as LeadResponse
      })
      .then((body) => {
        if (!cancelled) setData(body)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Lead not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => load(), [load])

  if (!hasUiPermission('lead.read')) {
    return (
      <ScopeDenied
        message="You need the lead.read permission to view leads. Ask an owner or admin of your organization."
        backHref="/sales/leads"
        backLabel="Back to leads"
      />
    )
  }
  if (loading) return <PageLoader title="Loading lead…" />
  if (!data) {
    return (
      <ScopeDenied
        message="This lead doesn't exist for your organization."
        backHref="/sales/leads"
        backLabel="Back to leads"
      />
    )
  }

  const { lead } = data
  const { viewings, offers, handoffs } = lead

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.displayName}
        description={[lead.listing?.title, lead.property?.name].filter(Boolean).join(' · ') || 'No interest linked'}
        actions={
          <>
            {hasUiPermission('lead.update') ? (
              <Button variant="outline" onClick={() => router.push(`/sales/leads/${id}/edit`)}>
                Edit
              </Button>
            ) : null}
            {hasUiPermission('handoff.create') ? (
              <Button variant="primary" onClick={() => setHandoffOpen(true)}>
                Hand off
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1"><LeadStatusBadge status={lead.status} /></div>
          </CardContent>
        </Card>
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Next action</p>
            <p className="mt-1 text-sm font-medium">
              {lead.nextActionAt ? formatRelativeDay(lead.nextActionAt) : 'Not scheduled'}
            </p>
          </CardContent>
        </Card>
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Budget</p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {lead.budgetMin && lead.budgetMax
                ? `${formatMoney(lead.budgetMin)} – ${formatMoney(lead.budgetMax)}`
                : lead.budgetMin
                  ? `From ${formatMoney(lead.budgetMin)}`
                  : lead.budgetMax
                    ? `Up to ${formatMoney(lead.budgetMax)}`
                    : '—'}
            </p>
          </CardContent>
        </Card>
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Contact</p>
            <p className="mt-1 text-sm font-medium">
              {[lead.phone, lead.email].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {labelize(lead.preferredChannel)} · {labelize(lead.source)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Viewings ({viewings.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {viewings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No viewings booked yet.</p>
            ) : (
              viewings.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => router.push(`/sales/viewings/${v.id}/edit`)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {v.property.name} · {formatDate(v.scheduledAt)}
                    </p>
                    {v.feedback ? <p className="truncate text-xs text-muted-foreground">{v.feedback}</p> : null}
                  </div>
                  <StatusBadge status={v.status} />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Offers ({offers.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers on the table yet.</p>
            ) : (
              offers.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => router.push(`/sales/offers/${o.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {formatMoney(o.amount, o.currency)} · {o.listing.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(o.offerDate)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Handoffs ({handoffs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {handoffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">This lead has never been handed over.</p>
          ) : (
            handoffs.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {[h.fromOrganization?.name, h.toOrganization?.name].filter(Boolean).join(' → ')}
                  </p>
                  {h.message ? <p className="truncate text-xs text-muted-foreground">{h.message}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatDate(h.createdAt)}</span>
                  <Badge variant={h.status === 'ACCEPTED' ? 'success' : h.status === 'DECLINED' ? 'neutral' : 'info'} size="sm">
                    {labelize(h.status)}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <HandoffDialog
        open={handoffOpen}
        onClose={() => setHandoffOpen(false)}
        leadId={id}
        listingId={lead.listing?.id ?? null}
        onSent={() => {
          setHandoffOpen(false)
          load()
        }}
      />
    </div>
  )
}
