'use client'

/**
 * ListingLifecycleActions — publish / pause / resume / close on a listing
 * detail page (plan-slice-5 §3). Close is dialog-confirmed; MK marketing
 * agents can publish shared listings; closing stays portfolio-side.
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
import { RadioGroup, RadioGroupItem } from '@workspace/ui/components/radio-group'
import { toast } from '@workspace/ui/components/toast'
import { LISTING_CLOSEABLE, LISTING_PUBLISHABLE } from '@/lib/domain/sales-constants'
import type { ListingRow } from './sales-types'
import { labelize } from './status-badge'

export interface ListingLifecycleProps {
  listing: ListingRow
  onChanged?: () => void
}

export function ListingLifecycleActions({ listing, onChanged }: ListingLifecycleProps) {
  const [closeOpen, setCloseOpen] = useState(false)
  const [target, setTarget] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const run = async (path: string, body?: unknown, success?: string) => {
    setBusy(true)
    try {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      toast.success(success ?? 'Listing updated')
      setCloseOpen(false)
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const patchStatus = async (status: 'PUBLISHED' | 'PAUSED') => {
    setBusy(true)
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      toast.success(status === 'PAUSED' ? 'Listing paused' : 'Listing resumed')
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const closeTargets = LISTING_CLOSEABLE[listing.status as keyof typeof LISTING_CLOSEABLE] ?? []

  return (
    <>
      {LISTING_PUBLISHABLE.includes(listing.status as never) ? (
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => run(`/api/listings/${listing.id}/publish`, undefined, 'Listing published')}
        >
          Publish
        </Button>
      ) : null}
      {listing.status === 'PUBLISHED' ? (
        <Button variant="outline" disabled={busy} onClick={() => patchStatus('PAUSED')}>
          Pause
        </Button>
      ) : null}
      {listing.status === 'PAUSED' ? (
        <Button variant="outline" disabled={busy} onClick={() => patchStatus('PUBLISHED')}>
          Resume
        </Button>
      ) : null}
      {closeTargets.length > 0 ? (
        <>
          <Button variant="destructive" disabled={busy} onClick={() => {
            setTarget(closeTargets[0] ?? '')
            setCloseOpen(true)
          }}>
            Close
          </Button>
          <Dialog open={closeOpen} onOpenChange={(o) => !o && setCloseOpen(false)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Close “{listing.title}”</DialogTitle>
                <DialogDescription>
                  Closing is terminal. Sold and withdrawn moves are recorded in the price history.
                </DialogDescription>
              </DialogHeader>
              <RadioGroup value={target} onValueChange={setTarget} orientation="vertical">
                {closeTargets.map((t) => (
                  <RadioGroupItem key={t} value={t} label={labelize(t)} />
                ))}
              </RadioGroup>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCloseOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy || !target}
                  loading={busy}
                  onClick={() => run(`/api/listings/${listing.id}/close`, { to: target }, `Listing closed as ${labelize(target ?? '')}`)}
                >
                  Close listing
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
  )
}
