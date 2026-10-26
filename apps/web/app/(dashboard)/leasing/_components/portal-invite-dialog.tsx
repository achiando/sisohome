'use client'

/**
 * PortalInviteDialog — issues a portal invite and shows the raw link ONCE
 * (plan-slice-2 §3). The server returns the URL only on create; copy it
 * before closing. The tenant redeems it at /portal/accept (slice 7); an
 * unused invite can be revoked from the tenant profile.
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

export interface PortalInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  tenantName: string
  defaultEmail?: string | null
  onInvited?: () => void
}

export function PortalInviteDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  defaultEmail,
  onInvited,
}: PortalInviteDialogProps) {
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const reset = () => {
    setInviteUrl(null)
    setSending(false)
  }

  const send = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/tenants/${tenantId}/portal-invite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to create invite')
      setInviteUrl(data.inviteUrl as string)
      toast.success('Invite created — share the link with the tenant')
      onInvited?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invite')
      setSending(false)
    }
  }

  const copy = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('Invite link copied')
    } catch {
      toast.error('Copy failed — select the link manually')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite {tenantName} to the portal</DialogTitle>
          <DialogDescription>
            Creates a single-use link valid for 7 days. The tenant sets their password on
            first open (acceptance flow).
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-3">
            <Label htmlFor="invite-link">Invite link (shown once)</Label>
            <Input id="invite-link" readOnly value={inviteUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <p className="text-xs text-muted-foreground">
              Copy it now — it cannot be shown again after closing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={defaultEmail ?? 'tenant@example.com'}
            />
            {!defaultEmail && !email.trim() ? (
              <p className="text-xs text-muted-foreground">
                The tenant needs an email address for the invite.
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {inviteUrl ? (
            <>
              <Button variant="outline" onClick={copy}>
                Copy link
              </Button>
              <Button variant="primary" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={send} loading={sending} disabled={sending}>
                Create invite
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
