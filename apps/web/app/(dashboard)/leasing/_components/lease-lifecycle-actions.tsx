'use client'

/**
 * LeaseLifecycleActions — approve / cancel / terminate / close / renew
 * (plan-slice-2 §3). Actions derive from the LEASE_TRANSITIONS map; each
 * fires the matching lifecycle endpoint and calls `onChanged` to refetch.
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
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@workspace/ui/components/select'
import { Switch } from '@workspace/ui/components/switch'
import { toast } from '@workspace/ui/components/toast'
import {
  LEASE_TRANSITIONS,
  type LeaseStatusValue,
} from '@/lib/domain/lease-constants'

export interface LeaseLifecycleTarget {
  id: string
  status: string
  startsAt: string
  endsAt: string | null
}

type ActionKey = 'approve' | 'cancel' | 'terminate' | 'close' | 'renew'

const ACTION_LABEL: Record<ActionKey, string> = {
  approve: 'Approve',
  cancel: 'Cancel lease',
  terminate: 'Terminate',
  close: 'Close',
  renew: 'Renew',
}

const CONFIRM_COPY: Record<Exclude<ActionKey, 'renew' | 'terminate'>, string> = {
  approve:
    'Approving locks the lease in and marks its units occupied from the start date (scheduled if the start is in the future).',
  cancel: 'Cancelling releases the units and archives the draft. This cannot be undone.',
  close: 'Closing ends the lease record. Charges and payments ride the charge domain.',
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LeaseLifecycleActions({
  lease,
  onChanged,
}: {
  lease: LeaseLifecycleTarget
  onChanged: () => void
}) {
  const router = useRouter()
  const status = lease.status as LeaseStatusValue
  const [dialog, setDialog] = useState<ActionKey | null>(null)
  const [busy, setBusy] = useState(false)

  // Terminate extras
  const [noticeDate, setNoticeDate] = useState('')
  const [endsToday, setEndsToday] = useState(true)

  // Renew extras
  const [renewStartsAt, setRenewStartsAt] = useState('')
  const [renewEndsAt, setRenewEndsAt] = useState('')
  const [renewOldStatus, setRenewOldStatus] = useState('ENDING')
  const [renewStatus, setRenewStatus] = useState('PENDING_APPROVAL')

  const transitions = LEASE_TRANSITIONS[status] ?? []
  const actions: ActionKey[] = []
  if (status === 'PENDING_APPROVAL') actions.push('approve')
  if (transitions.includes('CANCELLED')) actions.push('cancel')
  if (transitions.includes('TERMINATED') && status !== 'ENDING' && status !== 'TERMINATED') actions.push('terminate')
  if (transitions.includes('CLOSED')) actions.push('close')
  actions.push('renew')

  const open = (key: ActionKey) => {
    if (key === 'terminate') {
      setNoticeDate('')
      setEndsToday(true)
    }
    if (key === 'renew') {
      const old = lease.endsAt ? new Date(lease.endsAt) : new Date()
      const next = new Date(old)
      next.setFullYear(next.getFullYear() + 1)
      setRenewStartsAt(old.toISOString().slice(0, 10))
      setRenewEndsAt(next.toISOString().slice(0, 10))
      setRenewOldStatus(status === 'TERMINATED' ? 'TERMINATED' : 'ENDING')
      setRenewStatus('PENDING_APPROVAL')
    }
    setDialog(key)
  }

  const run = async (key: ActionKey) => {
    setBusy(true)
    try {
      let body: Record<string, unknown> = {}
      if (key === 'approve') body = { signedAt: todayISO() }
      if (key === 'terminate') {
        body = { endsToday }
        if (noticeDate) body.noticeDate = noticeDate
      }
      if (key === 'renew') {
        body = {
          startsAt: renewStartsAt,
          endsAt: renewEndsAt || null,
          oldStatus: renewOldStatus,
          status: renewStatus,
        }
      }
      const res = await fetch(`/api/leases/${lease.id}/${key}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Failed to ${key} lease`)
      if (key === 'renew' && data.lease?.id) {
        toast.success('Renewal lease created')
        router.push(`/leasing/leases/${data.lease.id}`)
        return
      }
      toast.success(
        key === 'approve'
          ? 'Lease approved'
          : key === 'cancel'
            ? 'Lease cancelled'
            : key === 'terminate'
              ? 'Lease terminated'
              : 'Lease closed',
      )
      setDialog(null)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${key} lease`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((key) => (
          <Button
            key={key}
            variant={key === 'approve' ? 'primary' : key === 'cancel' || key === 'terminate' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => open(key)}
          >
            {ACTION_LABEL[key]}
          </Button>
        ))}
      </div>

      <Dialog open={dialog !== null && dialog !== 'renew' && dialog !== 'terminate'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          {dialog && dialog !== 'renew' && dialog !== 'terminate' ? (
            <>
              <DialogHeader>
                <DialogTitle>{ACTION_LABEL[dialog]}</DialogTitle>
                <DialogDescription>{CONFIRM_COPY[dialog]}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
                  Keep as is
                </Button>
                <Button
                  variant={dialog === 'approve' ? 'primary' : 'destructive'}
                  loading={busy}
                  disabled={busy}
                  onClick={() => run(dialog)}
                >
                  {ACTION_LABEL[dialog]}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'terminate'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Terminate lease</DialogTitle>
            <DialogDescription>
              Ends the tenancy immediately (or keep the end date and just record notice).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div>
                <Label htmlFor="terminate-ends-today">End the lease today</Label>
                <p className="text-xs text-muted-foreground">Otherwise the recorded end date stays.</p>
              </div>
              <Switch id="terminate-ends-today" checked={endsToday} onCheckedChange={setEndsToday} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="terminate-notice">Notice / move-out date (optional)</Label>
              <Input
                id="terminate-notice"
                type="date"
                value={noticeDate}
                onChange={(e) => setNoticeDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Keep as is
            </Button>
            <Button variant="destructive" loading={busy} disabled={busy} onClick={() => run('terminate')}>
              Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'renew'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renew lease</DialogTitle>
            <DialogDescription>
              Creates a NEW lease (units + parties copied) linked as a renewal. The current lease
              moves to the chosen closing status.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="renew-starts">New start</Label>
              <Input id="renew-starts" type="date" value={renewStartsAt} onChange={(e) => setRenewStartsAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="renew-ends">New end</Label>
              <Input id="renew-ends" type="date" value={renewEndsAt} onChange={(e) => setRenewEndsAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Current lease moves to</Label>
              <Select value={renewOldStatus} onValueChange={setRenewOldStatus}>
                <SelectTrigger size="sm" />
                <SelectContent>
                  <SelectItem value="ENDING">Ending</SelectItem>
                  <SelectItem value="TERMINATED">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>New lease status</Label>
              <Select value={renewStatus} onValueChange={setRenewStatus}>
                <SelectTrigger size="sm" />
                <SelectContent>
                  <SelectItem value="PENDING_APPROVAL">Pending approval</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} disabled={busy || !renewStartsAt} onClick={() => run('renew')}>
              Create renewal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
