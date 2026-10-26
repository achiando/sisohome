'use client'

/**
 * Pending payment messages (payment claims) — tenants reporting "I paid"
 * from the portal, shown at the top of the Payments tab while PENDING.
 * Confirm records the real payment (oldest-first allocation, tenant's paidAt)
 * and emails the tenant; reject sends a note back. Empty when there is
 * nothing to decide.
 */

import { useCallback, useEffect, useState } from 'react'

import { MessageSquareWarning } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import { toast } from '@workspace/ui/components/toast'

interface ClaimRow {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  amount: string
  currency: string
  method: string
  accountType: string
  reference: string | null
  paidAt: string
  message: string | null
  createdAt: string
  tenant: { id: string; displayName: string }
  unit: { unitRef: string; label: string | null }
  property: { name: string }
}

interface ClaimsRes {
  success: boolean
  rows: ClaimRow[]
}

function dateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function money(c: ClaimRow): string {
  return `${c.currency} ${Number(c.amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PaymentClaimsCard({
  canDecide,
  onDecided,
}: {
  canDecide: boolean
  onDecided: () => void
}) {
  const [rows, setRows] = useState<ClaimRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ClaimRow | null>(null)
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const load = useCallback(() => {
    fetch('/api/payment-claims?status=PENDING', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<ClaimsRes>) : null))
      .then((d) => setRows(d?.rows ?? []))
      .catch(() => setRows([]))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (claim: ClaimRow, action: 'confirm' | 'reject', claimNote?: string) => {
    setBusyId(claim.id)
    try {
      const res = await fetch(`/api/payment-claims/${claim.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...(claimNote ? { note: claimNote } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not save the decision')
        return
      }
      if (action === 'confirm') {
        toast.success(`Payment recorded — ${data.allocated ?? 0} charge${data.allocated === 1 ? '' : 's'} allocated, tenant emailed`)
      } else {
        toast.success('Claim rejected — the tenant was emailed your note')
      }
      onDecided()
      load()
    } catch {
      toast.error('Network error — decision not saved')
    } finally {
      setBusyId(null)
    }
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    setRejecting(true)
    await decide(rejectTarget, 'reject', note.trim() || undefined)
    setRejecting(false)
    setRejectTarget(null)
    setNote('')
  }

  if (rows === null || rows.length === 0) return null

  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareWarning className="size-4 text-muted-foreground" aria-hidden="true" />
          Payment messages
          <Badge variant="warning">{rows.length} waiting</Badge>
        </CardTitle>
        <CardDescription>
          Tenants reporting a payment from the portal — confirm to record it against their oldest
          open charges, or reject with a note.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {money(c)}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {c.accountType.toLowerCase()} · {c.property.name} · {c.unit.label ?? c.unit.unitRef}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.tenant.displayName} · paid {dateLabel(c.paidAt)} ·{' '}
                  {c.method.toLowerCase().replace(/_/g, ' ')}
                  {c.reference ? ` · ${c.reference}` : ''} · posted {dateLabel(c.createdAt)}
                </p>
                {c.message ? (
                  <p className="mt-1 text-xs text-muted-foreground">“{c.message}”</p>
                ) : null}
              </div>
              {canDecide ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === c.id}
                    onClick={() => {
                      setRejectTarget(c)
                      setNote('')
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={busyId === c.id}
                    onClick={() => decide(c, 'confirm')}
                  >
                    Confirm payment
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => (!open ? setRejectTarget(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this payment message?</DialogTitle>
            <DialogDescription>
              {rejectTarget ? `${rejectTarget.tenant.displayName} will be emailed your note.` : ''}
              No money is recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="claim-reject-note">Note for the tenant (optional)</Label>
            <Textarea
              id="claim-reject-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. No payment reached our account — please share the transaction code."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejecting}>
              Cancel
            </Button>
            <Button variant="destructive" loading={rejecting} onClick={submitReject}>
              Reject claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
