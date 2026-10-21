'use client'

/**
 * InspectionLifecycleActions — SCHEDULED → IN_PROGRESS / CANCELLED ride
 * PATCH /api/maintenance/inspections/[id]; PASSED/FAILED ride
 * POST /api/maintenance/inspections/[id]/complete (FAILED requires
 * findings — plan-slice-3 §2/§3). Disabled entirely on terminal states.
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
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import { toast } from '@workspace/ui/components/toast'
import { INSPECTION_TRANSITIONS, inspectionStatusLabel } from '@/lib/domain/maintenance-constants'

const CONFIRM_COPY: Record<string, string> = {
  IN_PROGRESS: 'Start the inspection — record findings when done.',
  PASSED: 'Marks the inspection as passed. No findings required.',
  FAILED: 'Marks the inspection as failed — describe what you found.',
  CANCELLED: 'Cancels the inspection without a result. This cannot be undone.',
}

export function InspectionLifecycleActions({
  inspectionId,
  status,
  onChanged,
}: {
  inspectionId: string
  status: string
  onChanged: () => void
}) {
  const [target, setTarget] = useState<string | null>(null)
  const [findings, setFindings] = useState('')
  const [busy, setBusy] = useState(false)

  const transitions = INSPECTION_TRANSITIONS[status as keyof typeof INSPECTION_TRANSITIONS] ?? []
  if (transitions.length === 0) return null

  const run = async () => {
    if (!target) return
    if (target === 'FAILED' && findings.trim() === '') {
      toast.error('Findings are required when an inspection fails')
      return
    }
    setBusy(true)
    try {
      const finalising = target === 'PASSED' || target === 'FAILED'
      const res = finalising
        ? await fetch(`/api/maintenance/inspections/${inspectionId}/complete`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: target, findings: findings.trim() || undefined }),
          })
        : await fetch(`/api/maintenance/inspections/${inspectionId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: target }),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Inspection update failed')
      toast.success(`Inspection marked ${inspectionStatusLabel(target)}`)
      setTarget(null)
      setFindings('')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Inspection update failed')
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
            variant={to === 'CANCELLED' ? 'destructive' : to === 'FAILED' ? 'outline' : 'primary'}
            size="sm"
            onClick={() => {
              setFindings('')
              setTarget(to)
            }}
          >
            {to === 'IN_PROGRESS' ? 'Start inspection' : inspectionStatusLabel(to)}
          </Button>
        ))}
      </div>

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{target ? `Mark inspection ${inspectionStatusLabel(target)}` : ''}</DialogTitle>
            <DialogDescription>{target ? (CONFIRM_COPY[target] ?? 'Update the inspection.') : ''}</DialogDescription>
          </DialogHeader>

          {target === 'FAILED' ? (
            <div className="space-y-2">
              <Label htmlFor="inspection-findings">Findings (required)</Label>
              <Textarea
                id="inspection-findings"
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                rows={4}
                placeholder="What went wrong?"
                autoFocus
              />
            </div>
          ) : target === 'PASSED' ? (
            <div className="space-y-2">
              <Label htmlFor="inspection-findings">Findings (optional)</Label>
              <Textarea
                id="inspection-findings"
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                rows={3}
                placeholder="Notes for the record"
                autoFocus
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={target === 'CANCELLED' || target === 'FAILED' ? 'destructive' : 'primary'}
              loading={busy}
              disabled={busy}
              onClick={run}
            >
              {target ? inspectionStatusLabel(target) : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
