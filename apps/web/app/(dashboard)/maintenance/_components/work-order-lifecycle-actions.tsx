'use client'

/**
 * WorkOrderLifecycleActions — authorize / transition buttons from
 * WORK_ORDER_TRANSITIONS (plan-slice-3 §2/§3). AUTHORIZED posts to the
 * dedicated authorize endpoint; COMPLETED opens a dialog that can record
 * final cost; everything else confirms and posts to transition.
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
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { toast } from '@workspace/ui/components/toast'
import {
  WORK_ORDER_TRANSITIONS,
  workOrderStatusLabel,
} from '@/lib/domain/maintenance-constants'

const CONFIRM_COPY: Record<string, string> = {
  AUTHORIZED:
    'Authorizes the job (records who signed off) and moves the linked ticket to In progress.',
  SCHEDULED: 'Marks the job as scheduled — set the date on the edit form if needed.',
  IN_PROGRESS: 'The crew is on it.',
  ON_HOLD: 'Parks the job until further notice.',
  COMPLETED: 'Finishes the job, stamps completion, and closes every open assignment.',
  CANCELLED: 'Cancels the job. This cannot be undone.',
}

export function WorkOrderLifecycleActions({
  workOrderId,
  status,
  onChanged,
}: {
  workOrderId: string
  status: string
  onChanged: () => void
}) {
  const [target, setTarget] = useState<string | null>(null)
  const [finalCost, setFinalCost] = useState('')
  const [busy, setBusy] = useState(false)

  const transitions = WORK_ORDER_TRANSITIONS[status as keyof typeof WORK_ORDER_TRANSITIONS] ?? []
  if (transitions.length === 0) return null

  const open = (to: string) => {
    setFinalCost('')
    setTarget(to)
  }

  const run = async () => {
    if (!target) return
    setBusy(true)
    try {
      const path =
        target === 'AUTHORIZED'
          ? `/api/work-orders/${workOrderId}/authorize`
          : `/api/work-orders/${workOrderId}/transition`
      const body: Record<string, unknown> =
        target === 'AUTHORIZED' ? {} : { to: target }
      if (target === 'COMPLETED' && finalCost.trim()) body.finalCost = finalCost.trim()
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Transition failed')
      toast.success(`Work order moved to ${workOrderStatusLabel(target)}`)
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
                : to === 'AUTHORIZED' || to === 'COMPLETED'
                  ? 'primary'
                  : 'outline'
            }
            size="sm"
            onClick={() => open(to)}
          >
            {to === 'AUTHORIZED' ? 'Authorize' : workOrderStatusLabel(to)}
          </Button>
        ))}
      </div>

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{target ? `Move work order to ${workOrderStatusLabel(target)}` : ''}</DialogTitle>
            <DialogDescription>
              {target ? (CONFIRM_COPY[target] ?? 'Update the work order status.') : ''}
            </DialogDescription>
          </DialogHeader>
          {target === 'COMPLETED' ? (
            <div className="space-y-1">
              <Label htmlFor="wo-final-cost">Final cost (optional)</Label>
              <Input
                id="wo-final-cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="Leave blank to keep the current value"
                value={finalCost}
                onChange={(e) => setFinalCost(e.target.value)}
              />
            </div>
          ) : null}
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
              {target === 'AUTHORIZED' ? 'Authorize' : target ? workOrderStatusLabel(target) : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
