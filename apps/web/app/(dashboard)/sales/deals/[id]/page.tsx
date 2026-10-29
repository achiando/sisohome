'use client'

/**
 * /sales/deals/[id] — the deal room (plan-slice-5 §3): checklist, sale
 * price, commission, buyer party, soft status progression, completion.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
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
import { DEAL_TRANSITIONS } from '@/lib/domain/sales-constants'
import { DealChecklist } from '../../_components/deal-checklist'
import { StatusBadge, labelize } from '../../_components/status-badge'
import type { DealChecklistItem } from '../../_components/sales-types'

interface DealDetail {
  id: string
  salePrice: number | null
  currency: string
  status: string
  checklist: DealChecklistItem[]
  commissionAmount: number | null
  notes: string | null
  buyerOwnerPartyId: string | null
  openedAt: string
  completionDate: string | null
  offer: { id: string; amount: number; lead: { id: string; displayName: string } | null } | null
  property: { id: string; name: string }
  buyerLead: { id: string; displayName: string } | null
  buyerOwnerParty: { id: string; name: string } | null
}

interface OwnerParty {
  id: string
  name: string
}

export default function DealRoomPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { hasUiPermission } = useUiPermission()
  const [deal, setDeal] = useState<DealDetail | null>(null)
  const [parties, setParties] = useState<OwnerParty[]>([])
  const [loading, setLoading] = useState(true)
  const [partyId, setPartyId] = useState('')
  const [commission, setCommission] = useState('')
  const [notes, setNotes] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/deals/${id}`, { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/owner-parties', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { parties: [] })),
    ])
      .then(([dealBody, partiesBody]: [{ deal?: DealDetail }, { parties?: OwnerParty[] }]) => {
        if (cancelled) return
        if (!dealBody.deal) throw new Error('Deal not found')
        setDeal(dealBody.deal)
        setPartyId(dealBody.deal.buyerOwnerPartyId ?? '')
        setCommission(dealBody.deal.commissionAmount === null ? '' : String(dealBody.deal.commissionAmount))
        setNotes(dealBody.deal.notes ?? '')
        setParties(partiesBody.parties ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Deal not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => load(), [load])

  const patch = async (body: Record<string, unknown>, success?: string) => {
    const res = await fetch(`/api/deals/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Could not save the deal')
    if (success) toast.success(success)
    load()
    return data
  }

  const saveMeta = async () => {
    setSavingMeta(true)
    try {
      await patch(
        {
          buyerOwnerPartyId: partyId || null,
          commissionAmount: commission === '' ? null : Number(commission),
          notes,
        },
        'Deal updated',
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the deal')
    } finally {
      setSavingMeta(false)
    }
  }

  const complete = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/deals/${id}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerOwnerPartyId: partyId || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not complete the deal')
      toast.success('Deal completed — ownership transferred')
      setCompleteOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not complete the deal')
    } finally {
      setBusy(false)
    }
  }

  if (!hasUiPermission('offer.read')) {
    return (
      <ScopeDenied
        message="You need the offer.read permission to open deal rooms. Ask an owner or admin of your organization."
        backHref="/sales/offers"
        backLabel="Back to offers"
      />
    )
  }
  if (loading) return <PageLoader title="Opening the deal room…" />
  if (!deal) {
    return (
      <ScopeDenied
        message="This deal doesn't exist for your organization."
        backHref="/sales/offers"
        backLabel="Back to offers"
      />
    )
  }

  const isLive = ['AGREED', 'DUE_DILIGENCE', 'COMPLETION_PENDING'].includes(deal.status)
  const transitions = DEAL_TRANSITIONS[deal.status as keyof typeof DEAL_TRANSITIONS] ?? []
  const mandatoryLeft = deal.checklist.filter((c) => c.mandatory && !c.done)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Deal room"
        description={`${deal.property.name}${deal.buyerLead ? ` · buyer ${deal.buyerLead.displayName}` : ''}`}
        actions={
          <Button variant="text" size="sm" onClick={() => router.push('/sales/offers')}>
            ← Offers
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sale price</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {deal.salePrice ? formatMoney(deal.salePrice, deal.currency) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1"><StatusBadge status={deal.status} /></div>
          </CardContent>
        </Card>
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Opened</p>
            <p className="mt-1 text-sm font-medium">{formatDate(deal.openedAt)}</p>
          </CardContent>
        </Card>
        <Card variant="filled">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="mt-1 text-sm font-medium">{formatDate(deal.completionDate)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Checklist</CardTitle>
          {isLive && transitions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {transitions
                .filter((t) => t !== 'COLLAPSED')
                .map((t) => (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      patch({ status: t }, `Deal moved to ${labelize(t)}`).catch((err: unknown) =>
                        toast.error(err instanceof Error ? err.message : 'Could not save the deal'),
                      )
                    }
                  >
                    Move to {labelize(t)}
                  </Button>
                ))}
              <Button variant="destructive" size="sm" onClick={() => patch({ status: 'COLLAPSED' }, 'Deal collapsed').catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not save the deal'))}>
                Collapse
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <DealChecklist dealId={deal.id} items={deal.checklist} disabled={!isLive || !hasUiPermission('offer.update')} onChanged={load} />
        </CardContent>
      </Card>

      {hasUiPermission('offer.update') ? (
        <Card>
          <CardHeader>
            <CardTitle>Deal terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="buyer-party">Buyer party</Label>
                <select
                  id="buyer-party"
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  disabled={!isLive}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a buyer party…</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commission">Commission ({deal.currency})</Label>
                <Input
                  id="commission"
                  type="number"
                  min="0"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  disabled={!isLive}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-notes">Notes</Label>
              <Textarea id="deal-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!isLive} />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={!isLive || savingMeta} loading={savingMeta} onClick={saveMeta}>
                Save terms
              </Button>
              {isLive ? (
                <Button variant="primary" onClick={() => setCompleteOpen(true)}>
                  Complete deal
                </Button>
              ) : null}
            </div>
            {mandatoryLeft.length > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {mandatoryLeft.length} required checklist item{mandatoryLeft.length === 1 ? '' : 's'} still open —
                finish them before completing.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={completeOpen} onOpenChange={(o) => !o && setCompleteOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete this deal?</DialogTitle>
            <DialogDescription>
              Completing closes every seller ownership row on {deal.property.name}, opens the buyer&apos;s
              ownership, and marks the listing sold or rented. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {!partyId ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              Pick a buyer party first — the deal cannot complete without one.
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompleteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy || !partyId} loading={busy} onClick={complete}>
              Complete deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
