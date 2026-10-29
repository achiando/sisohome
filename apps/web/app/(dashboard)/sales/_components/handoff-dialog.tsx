'use client'

/**
 * HandoffDialog — send an own-org lead to another organization
 * (plan-slice-5 §3). Free org search against `GET /api/handoffs?orgQuery=`
 * with a name preview before send; the lead row is never re-pointed.
 */

import { useEffect, useState } from 'react'
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
import { Textarea } from '@workspace/ui/components/textarea'
import { toast } from '@workspace/ui/components/toast'
import { labelize } from './status-badge'

type OrgHit = { id: string; name: string; slug: string; kind: string | null }

export interface HandoffDialogProps {
  open: boolean
  onClose: () => void
  leadId: string
  listingId?: string | null
  onSent?: () => void
}

export function HandoffDialog({ open, onClose, leadId, listingId, onSent }: HandoffDialogProps) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<OrgHit[]>([])
  const [target, setTarget] = useState<OrgHit | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Reset when the dialog opens (render-time state adjustment — no effect).
  const [prevOpen, setPrevOpen] = useState(false)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) {
      setQuery('')
      setHits([])
      setTarget(null)
      setMessage('')
    }
  }

  useEffect(() => {
    if (!open || query.trim().length < 2 || target) return
    const timer = setTimeout(() => {
      fetch(`/api/handoffs?orgQuery=${encodeURIComponent(query.trim())}`, { credentials: 'include' })
        .then(async (res) => (res.ok ? res.json() : { orgs: [] }))
        .then((data: { orgs?: OrgHit[] }) => setHits(data.orgs ?? []))
        .catch(() => setHits([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, open, target])

  const send = async () => {
    if (!target) return
    setSending(true)
    try {
      const res = await fetch('/api/handoffs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          toOrganizationId: target.id,
          listingId: listingId ?? undefined,
          message: message.trim() ? message.trim() : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not send the handoff')
        setSending(false)
        return
      }
      toast.success(`Handoff offered to ${target.name}`)
      setSending(false)
      onSent?.()
      onClose()
    } catch {
      toast.error('Network error — handoff not sent')
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send handoff</DialogTitle>
          <DialogDescription>
            Offer this lead to another landlord or management organization. They gain read access
            once they accept — the lead stays with your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {target ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{target.name}</p>
                <p className="text-xs text-muted-foreground">
                  {target.kind ? labelize(target.kind) : target.slug}
                </p>
              </div>
              <Button variant="text" size="sm" onClick={() => setTarget(null)} disabled={sending}>
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="handoff-org">Target organization</Label>
              <Input
                id="handoff-org"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHits([])
                }}
                placeholder="Search by organization name or slug…"
              />
              {query.trim().length >= 2 && hits.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matching organizations.</p>
              ) : null}
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => setTarget(hit)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-muted/40"
                >
                  <span className="truncate font-medium">{hit.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {hit.kind ? labelize(hit.kind) : hit.slug}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="handoff-msg">Message (optional)</Label>
            <Textarea
              id="handoff-msg"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Context for the receiving team — budget, timeline, matching units…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={send} disabled={!target || sending} loading={sending}>
            {target ? `Send to ${target.name}` : 'Send handoff'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
