'use client'

/**
 * /sales/offers/[id] — offer detail (plan-slice-5 §3): counter / accept /
 * reject. Accepting creates the deal and puts the listing under offer.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { PageLoader } from '@workspace/ui/components/loader'
import { Textarea } from '@workspace/ui/components/textarea'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate, formatMoney } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { StatusBadge, labelize } from '../../_components/status-badge'

interface OfferDetail {
  id: string
  amount: number
  currency: string
  status: string
  offerDate: string
  expiresAt: string | null
  termsNote: string | null
  listing: { id: string; title: string; status: string }
  lead: { id: string; displayName: string } | null
  supersedesOffer: { id: string; amount: number } | null
  supersededByOffer: { id: string; amount: number } | null
  deal: { id: string; status: string } | null
  acceptedAt: string | null
}

export default function OfferDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { hasUiPermission } = useUiPermission()
  const [offer, setOffer] = useState<OfferDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<'counter' | 'decide' | null>(null)
  const [busy, setBusy] = useState(false)
  const [counterAmount, setCounterAmount] = useState('')
  const [counterNote, setCounterNote] = useState('')

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/offers/${id}`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? 'Offer not found')
        return body.offer as OfferDetail
      })
      .then((o) => {
        if (!cancelled) {
          setOffer(o)
          setCounterAmount(String(o.amount))
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Offer not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => load(), [load])

  const counter = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/offers/${id}/counter`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(counterAmount), note: counterNote || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Counter failed')
      toast.success('Counter offer submitted')
      setDialog(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Counter failed')
    } finally {
      setBusy(false)
    }
  }

  const decide = async (to: 'ACCEPTED' | 'REJECTED') => {
    setBusy(true)
    try {
      const res = await fetch(`/api/offers/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Decision failed')
      toast.success(to === 'ACCEPTED' ? 'Offer accepted — deal opened' : 'Offer rejected')
      setDialog(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Decision failed')
    } finally {
      setBusy(false)
    }
  }

  if (!hasUiPermission('offer.read')) {
    return (
      <ScopeDenied
        message="You need the offer.read permission to view offers. Ask an owner or admin of your organization."
        backHref="/sales/offers"
        backLabel="Back to offers"
      />
    )
  }
  if (loading) return <PageLoader title="Loading offer…" />
  if (!offer) {
    return (
      <ScopeDenied
        message="This offer doesn't exist for your organization."
        backHref="/sales/offers"
        backLabel="Back to offers"
      />
    )
  }

  const canCounter = ['SUBMITTED', 'COUNTERED'].includes(offer.status) && hasUiPermission('offer.update')
  const canDecide = ['SUBMITTED', 'COUNTERED'].includes(offer.status) && hasUiPermission('offer.approve')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`${formatMoney(offer.amount, offer.currency)} offer`}
        description={`${offer.listing.title}${offer.lead ? ` · ${offer.lead.displayName}` : ''}`}
        actions={
          <>
            {canCounter ? (
              <Button variant="outline" onClick={() => setDialog('counter')}>
                Counter
              </Button>
            ) : null}
            {canDecide ? (
              <>
                <Button variant="destructive" onClick={() => setDialog('decide')}>
                  Reject
                </Button>
                <Button variant="primary" onClick={() => decide('ACCEPTED')}>
                  Accept
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-1"><StatusBadge status={offer.status} /></div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs text-muted-foreground">Offered on</p>
          <p className="mt-1 text-sm font-medium">{formatDate(offer.offerDate)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs text-muted-foreground">Expires</p>
          <p className="mt-1 text-sm font-medium">{formatDate(offer.expiresAt)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs text-muted-foreground">Listing</p>
          <button
            type="button"
            onClick={() => router.push(`/sales/listings/${offer.listing.id}`)}
            className="mt-1 text-sm font-medium text-primary hover:underline"
          >
            {offer.listing.title}
          </button>
          <p className="text-xs text-muted-foreground">{labelize(offer.listing.status)}</p>
        </div>
      </div>

      {offer.termsNote ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs text-muted-foreground">Terms</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{offer.termsNote}</p>
        </div>
      ) : null}

      {offer.supersedesOffer ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-xs">
          Supersedes an earlier offer of {formatMoney(offer.supersedesOffer.amount, offer.currency)}.
        </div>
      ) : null}
      {offer.supersededByOffer ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-xs">
          Superseded by a {formatMoney(offer.supersededByOffer.amount, offer.currency)} counter.
        </div>
      ) : null}
      {offer.deal ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          Deal opened ({labelize(offer.deal.status)}) —{' '}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => router.push(`/sales/deals/${offer.deal?.id}`)}
          >
            open the deal room
          </button>
        </div>
      ) : null}

      <Dialog open={dialog === 'counter'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Counter the offer</DialogTitle>
            <DialogDescription>
              Submitting creates a new offer that supersedes this one; the listing price is updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="counter-amount">Counter amount ({offer.currency})</Label>
              <Input
                id="counter-amount"
                type="number"
                min="1"
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="counter-note">Note (optional)</Label>
              <Textarea
                id="counter-note"
                rows={2}
                value={counterNote}
                onChange={(e) => setCounterNote(e.target.value)}
                placeholder="Conditions, timeline…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy || !Number(counterAmount)} loading={busy} onClick={counter}>
              Submit counter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'decide'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject the offer?</DialogTitle>
            <DialogDescription>
              The offer is closed as REJECTED. The listing stays {labelize(offer.listing.status)}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Keep open
            </Button>
            <Button variant="destructive" disabled={busy} loading={busy} onClick={() => decide('REJECTED')}>
              Reject offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
