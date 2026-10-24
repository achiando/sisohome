'use client'

/**
 * IntakeLinkDialog — mints a public self-onboarding link for THIS property
 * (people plan §5). Pick an expiry, generate, then copy/open the signed URL
 * (shown once per generation; stateless, so re-open to mint a fresh one).
 * Mirrors PortalInviteDialog: one field, one action, toast on success.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { toast } from '@workspace/ui/components/toast'

import { formatDate } from '@/app/(dashboard)/_components/domain/format'

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

export interface IntakeLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
}

export function IntakeLinkDialog({ open, onOpenChange, propertyId }: IntakeLinkDialogProps) {
  const [expiresInDays, setExpiresInDays] = useState('30')
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [creating, setCreating] = useState(false)

  const reset = () => {
    setLink(null)
    setCreating(false)
  }

  const generate = async () => {
    setCreating(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/intake-link`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: Number(expiresInDays) }),
      })
      const data: { success?: boolean; error?: string; url?: string; expiresAt?: string } = await res
        .json()
        .catch(() => ({}))
      if (!res.ok || !data.url || !data.expiresAt) {
        throw new Error(data.error ?? 'Failed to create intake link')
      }
      setLink({ url: data.url, expiresAt: data.expiresAt })
      toast.success('Intake link created — share it with the applicant')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create intake link')
      setCreating(false)
    }
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      toast.success('Intake link copied')
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
          <DialogTitle>Share intake link</DialogTitle>
          <DialogDescription>
            Anyone with this link can apply to this property — no account needed. The link stops
            accepting applications when it expires or if your access ends.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="space-y-3">
            <Label htmlFor="intake-link">Intake link (shown once)</Label>
            <Input
              id="intake-link"
              readOnly
              value={link.url}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <p className="text-xs text-muted-foreground">
              Works until {formatDate(link.expiresAt)} — copy it before closing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Label htmlFor="intake-expiry">Link expires after</Label>
            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
              <SelectTrigger id="intake-expiry" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Issue one link per applicant or share a property-wide link for open listings.
            </p>
          </div>
        )}

        <DialogFooter>
          {link ? (
            <>
              <Button variant="outline" onClick={copy}>
                Copy link
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
              >
                Open
              </Button>
              <Button variant="primary" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
                Cancel
              </Button>
              <Button variant="primary" onClick={generate} loading={creating} disabled={creating}>
                Generate link
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
