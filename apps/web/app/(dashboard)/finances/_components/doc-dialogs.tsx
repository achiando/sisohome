'use client'

/**
 * Shared data plumbing for the /finances tabs: property filter options and
 * the sandboxed invoice/receipt preview dialogs (server-rendered HTML in an
 * iframe with a print button — agreement-preview pattern, no stored docs).
 */

import { useEffect, useRef, useState } from 'react'
import { Printer } from 'lucide-react'
import { toast } from '@workspace/ui/components/toast'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Loader } from '@workspace/ui/components/loader'

export type Option = { value: string; label: string }

/** Property options for filter selects (all properties in scope). */
export function usePropertyOptions(): Option[] {
  const [options, setOptions] = useState<Option[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/properties', { credentials: 'include' })
      .then(async (res) => (res.ok ? res.json() : { properties: [] }))
      .then((data: { properties?: { id: string; name: string }[] }) => {
        if (!cancelled) {
          setOptions((data.properties ?? []).map((p) => ({ value: p.id, label: p.name })))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return options
}

function DocFrame({
  html,
  loading,
  label,
  frameRef,
}: {
  html: string | null
  loading: boolean
  label: string
  frameRef: React.RefObject<HTMLIFrameElement | null>
}) {
  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border">
        <Loader size="sm" />
      </div>
    )
  }
  if (!html) return null
  return (
    <iframe
      ref={frameRef}
      title={label}
      srcDoc={html}
      sandbox="allow-same-origin allow-modals"
      className="h-[28rem] w-full rounded-xl border border-border bg-white"
    />
  )
}

function useDoc(kind: 'invoice' | 'receipt', id: string | null, open: boolean) {
  // Loaded doc + failure are keyed by id so a stale document never renders
  // for a new target and all setState happens inside fetch callbacks.
  const [doc, setDoc] = useState<{ id: string; html: string; number: string } | null>(null)
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    if (!open || !id) return
    let cancelled = false
    const path = kind === 'invoice' ? `/api/charges/${id}/invoice` : `/api/receipts/${id}`
    fetch(path, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? `Failed to load ${kind}`)
        return data as { html: string; invoiceNumber?: string; receipt?: { receiptNumber: string | null } }
      })
      .then((d) => {
        if (!cancelled) {
          setDoc({
            id,
            html: d.html,
            number: d.invoiceNumber ?? d.receipt?.receiptNumber ?? '',
          })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFailed({ id, message: err instanceof Error ? err.message : `Failed to load ${kind}` })
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, id, kind])

  const print = () => {
    try {
      frameRef.current?.contentWindow?.print()
    } catch {
      toast.error('Could not open the print dialog')
    }
  }

  const ready = doc && doc.id === id ? doc : null
  const error = failed && failed.id === id && !ready ? failed.message : null
  const loading = Boolean(open && id) && !ready && !error

  return { html: ready?.html ?? null, number: ready?.number ?? '', loading, error, frameRef, print }
}

/** Printable invoice for a charge (mints the number server-side). */
export function InvoiceDialog({
  chargeId,
  open,
  onClose,
}: {
  chargeId: string | null
  open: boolean
  onClose: () => void
}) {
  const { html, number, loading, error, frameRef, print } = useDoc('invoice', chargeId, open)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{number ? `Invoice ${number}` : 'Invoice'}</DialogTitle>
          <DialogDescription>
            Printable invoice — the number is minted once and reused on every fetch.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DocFrame html={html} loading={loading} label="Invoice" frameRef={frameRef} />
        <div className="flex justify-end">
          <Button variant="outline" disabled={!html} onClick={print}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Printable receipt (RE-…) for an issued payment receipt. */
export function ReceiptDialog({
  receiptId,
  open,
  onClose,
}: {
  receiptId: string | null
  open: boolean
  onClose: () => void
}) {
  const { html, number, loading, error, frameRef, print } = useDoc('receipt', receiptId, open)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{number ? `Receipt ${number}` : 'Receipt'}</DialogTitle>
          <DialogDescription>Payment evidence — printable copy of the issued receipt.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DocFrame html={html} loading={loading} label="Receipt" frameRef={frameRef} />
        <div className="flex justify-end">
          <Button variant="outline" disabled={!html} onClick={print}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
