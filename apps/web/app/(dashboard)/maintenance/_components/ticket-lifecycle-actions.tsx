'use client'

/**
 * TicketLifecycleActions — status transition buttons derived from
 * TICKET_TRANSITIONS (plan-slice-3 §2). Each target opens a confirm
 * dialog, fires POST /api/maintenance/tickets/[id]/transition, then
 * refetches via onChanged.
 */

import { useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { toast } from '@workspace/ui/components/toast'
import { TICKET_TRANSITIONS, ticketStatusLabel } from '@/lib/domain/maintenance-constants'

const CONFIRM_COPY: Record<string, string> = {
  IN_PROGRESS: 'Moves the ticket into the working state.',
  ON_HOLD: 'Parks the ticket — no further work is expected until it is resumed.',
  RESOLVED: 'Marks the work as done. Close the ticket after the reporter confirms.',
  CLOSED: 'Closes the ticket for good. It cannot be reopened.',
  CANCELLED: 'Cancels the ticket without resolution. This cannot be undone.',
  OPEN: 'Reopens the ticket for another look.',
}

export function TicketLifecycleActions({
  ticketId,
  status,
  onChanged,
}: {
  ticketId: string
  status: string
  onChanged: () => void
}) {
  const [target, setTarget] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const transitions = TICKET_TRANSITIONS[status as keyof typeof TICKET_TRANSITIONS] ?? []
  if (transitions.length === 0) return null

  const run = async () => {
    if (!target) return
    setBusy(true)
    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/transition`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: target }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Transition failed')
      toast.success(`Ticket moved to ${ticketStatusLabel(target)}`)
      setTarget(null)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transition failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {transitions.map((to) => (
          <Button
            key={to}
            variant={
              to === 'CANCELLED'
                ? 'destructive'
                : to === 'RESOLVED' || to === 'CLOSED' || to === 'IN_PROGRESS'
                  ? 'primary'
                  : 'outline'
            }
            size="sm"
            onClick={() => setTarget(to)}
          >
            {to === 'IN_PROGRESS' && status === 'ON_HOLD' ? 'Resume' : ticketStatusLabel(to)}
          </Button>
        ))}
      </div>

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{target ? `Move ticket to ${ticketStatusLabel(target)}` : ''}</DialogTitle>
            <DialogDescription>
              {target ? (CONFIRM_COPY[target] ?? 'Update the ticket status.') : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={target === 'CANCELLED' ? 'destructive' : 'primary'}
              loading={busy}
              disabled={busy}
              onClick={run}
            >
              {target ? ticketStatusLabel(target) : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
