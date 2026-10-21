'use client'

/**
 * WorkOrderAssignDialog — the cross-org hand-off (plan-slice-3 §3/§6):
 * pick an org (own org by default + related orgs: agreements either side
 * + prior assignments), then a member of that org, then assign. Members
 * reload per selected org via GET /api/work-order-assignees?organizationId=.
 */

import { useCallback, useEffect, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { toast } from '@workspace/ui/components/toast'

interface OrgOption {
  id: string
  name: string
  kind: string | null
}

interface MemberRow {
  userId: string
  name: string
  email: string
}

export function WorkOrderAssignDialog({
  open,
  onOpenChange,
  workOrderId,
  onAssigned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: string
  onAssigned: () => void
}) {
  const [organizations, setOrganizations] = useState<OrgOption[]>([])
  const OWN = '__own__'
  const [orgId, setOrgId] = useState(OWN) // Radix Select forbids '' item values
  const [members, setMembers] = useState<MemberRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [saving, setSaving] = useState(false)

  // Load related orgs once when the dialog opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/work-order-assignees', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load assignees')
        const data = await res.json()
        return data as { organizations: OrgOption[] }
      })
      .then((data) => {
        if (!cancelled) setOrganizations(data.organizations ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load assignees')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const loadMembers = useCallback(
    (oid: string) => {
      let cancelled = false
      queueMicrotask(() => {
        if (cancelled || !open) return
        setMembersLoading(true)
        setUserId('')
        const qs = oid && oid !== OWN ? `?organizationId=${encodeURIComponent(oid)}` : ''
        fetch(`/api/work-order-assignees${qs}`, { credentials: 'include' })
          .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load members')
            const data = await res.json()
            return (data.members ?? []) as MemberRow[]
          })
          .then((list) => {
            if (!cancelled) setMembers(list)
          })
          .catch(() => {
            if (!cancelled) setMembers([])
          })
          .finally(() => {
            if (!cancelled) setMembersLoading(false)
          })
      })
      return () => {
        cancelled = true
      }
    },
    [open],
  )

  // Own-org members load first (orgId '' = own org).
  useEffect(() => loadMembers(orgId), [orgId, loadMembers])

  const assign = async () => {
    if (!userId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeUserId: userId,
          ...(orgId !== OWN ? { assigneeOrganizationId: orgId } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Assignment failed')
      toast.success('Work order assigned')
      onOpenChange(false)
      onAssigned()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assignment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setOrgId('')
          setUserId('')
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign work order</DialogTitle>
          <DialogDescription>
            Hand this job to a teammate, or to an external maintenance company your organization
            already works with (agreement or past assignments).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="assign-org">Organization</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger id="assign-org">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OWN}>My organization</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                    {org.kind ? ` · ${org.kind.replace(/_/g, ' ').toLowerCase()}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {organizations.length === 0 && orgId === OWN ? (
              <p className="text-xs text-muted-foreground">
                No external organizations linked yet — only your own members are listed.
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="assign-user">Assignee</Label>
            <Select value={userId} onValueChange={setUserId} disabled={membersLoading}>
              <SelectTrigger id="assign-user">
                <SelectValue
                  placeholder={membersLoading ? 'Loading members…' : 'Select a member…'}
                />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} disabled={saving || !userId} onClick={assign}>
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
