'use client'

/**
 * ApplicationDecisionDialog — Approve/Reject with optional "start lease"
 * hand-off (plan-slice-2 §3). Posts /decision once; on approve with the
 * lease checkbox, navigates to the lease wizard prefilled.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { toast } from '@workspace/ui/components/toast'

export interface ApplicationDecisionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  applicantName: string
  decision: 'APPROVED' | 'REJECTED'
  onDecided?: () => void
}

export function ApplicationDecisionDialog({
  open,
  onOpenChange,
  applicationId,
  applicantName,
  decision,
  onDecided,
}: ApplicationDecisionDialogProps) {
  const router = useRouter()
  const [startLease, setStartLease] = useState(false)
  const [saving, setSaving] = useState(false)

  const isApprove = decision === 'APPROVED'

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}/decision`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Decision failed')
      toast.success(isApprove ? `${applicantName} approved` : `${applicantName} rejected`)
      onOpenChange(false)
      if (isApprove && startLease) {
        router.push(`/leasing/leases/new?applicationId=${applicationId}`)
        return
      }
      onDecided?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Decision failed')
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isApprove ? 'Approve application' : 'Reject application'}</DialogTitle>
          <DialogDescription>
            {isApprove
              ? `Approve ${applicantName}'s application? The tenant becomes ACTIVE.`
              : `Reject ${applicantName}'s application? This is final (single decision per application).`}
          </DialogDescription>
        </DialogHeader>
        {isApprove ? (
          <div className="flex items-center gap-2">
            <input
              id="start-lease"
              type="checkbox"
              className="size-4 rounded border-border"
              checked={startLease}
              onChange={(e) => setStartLease(e.target.checked)}
            />
            <Label htmlFor="start-lease" className="font-normal">
              Start a lease now (opens the wizard)
            </Label>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant={isApprove ? 'primary' : 'destructive'}
            onClick={submit}
            loading={saving}
            disabled={saving}
          >
            {isApprove ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
