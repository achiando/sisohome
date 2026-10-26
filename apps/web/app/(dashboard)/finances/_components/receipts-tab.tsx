'use client'

/**
 * Receipts tab — issued-receipts register (Slice 8): RE numbers with payment
 * context; row action View opens the printable receipt dialog. Receipts are
 * issued from the Payments tab (receipt.issue).
 */

import { useCallback, useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'

import { PageLoader } from '@workspace/ui/components/loader'
import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { Button } from '@workspace/ui/components/button'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { ReceiptDialog, usePropertyOptions } from './doc-dialogs'

type ReceiptRow = {
  id: string
  receiptNumber: string | null
  amount: string
  currency: string
  issuedAt: string
  paymentId: string
  payment: {
    id: string
    method: string
    reference: string | null
    receivedAt: string
    amount: string
    currency: string
    property: { id: string; name: string }
    unit: { id: string; unitRef: string } | null
    tenant: { id: string; displayName: string } | null
  }
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
}

function money(amount: string, currency: string) {
  const n = Number(amount)
  return `${currency} ${n.toLocaleString()}`
}

export function ReceiptsTab() {
  const propertyOptions = usePropertyOptions()
  const [rows, setRows] = useState<ReceiptRow[] | null>(null)
  const [propertyId, setPropertyId] = useState('')
  const [viewId, setViewId] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    const qs = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''
    fetch(`/api/receipts${qs}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load receipts')
        return data as { receipts: ReceiptRow[] }
      })
      .then((data) => {
        if (!cancelled) setRows(data.receipts ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load receipts')
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  if (rows === null) return <PageLoader title="Loading receipts…" description="" />

  return (
    <div className="space-y-6">
      <ResponsiveDataListing<ReceiptRow>
        title="Receipts"
        hideHeaderOnMobile
        items={rows}
        loading={false}
        skeletonCount={5}
        count={rows.length}
        rowKey={(r) => r.id}
        columns={[
          {
            header: 'Receipt',
            cell: (r) => (
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.receiptNumber ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Issued {formatDate(r.issuedAt)}</p>
              </div>
            ),
          },
          {
            header: 'Amount',
            cell: (r) => <span className="text-sm font-medium tabular-nums">{money(r.amount, r.currency)}</span>,
          },
          {
            header: 'Payment',
            cell: (r) => (
              <div className="min-w-0">
                <p className="text-sm">
                  {METHOD_LABEL[r.payment.method] ?? r.payment.method}
                  {r.payment.reference ? ` · ${r.payment.reference}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(r.payment.receivedAt)}</p>
              </div>
            ),
          },
          {
            header: 'Tenant',
            cell: (r) => <span className="text-sm">{r.payment.tenant?.displayName ?? '—'}</span>,
          },
          {
            header: 'Property / unit',
            cell: (r) => (
              <div className="min-w-0">
                <p className="truncate text-sm">{r.payment.property.name}</p>
                <p className="text-xs text-muted-foreground">{r.payment.unit?.unitRef ?? '—'}</p>
              </div>
            ),
          },
          {
            header: '',
            className: 'w-24',
            cell: (r) => (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setViewId(r.id)} aria-label="View receipt">
                  View
                </Button>
              </div>
            ),
          },
        ]}
        cardMapper={{
          id: (r) => r.id,
          title: (r) => r.receiptNumber ?? 'Receipt',
          subtitle: (r) => `${r.payment.property.name}${r.payment.unit ? ` · ${r.payment.unit.unitRef}` : ''}`,
          amount: (r) => <span className="font-semibold tabular-nums">{money(r.amount, r.currency)}</span>,
          detailFields: (r) => [
            { label: 'Tenant', value: r.payment.tenant?.displayName ?? '—' },
            { label: 'Method', value: METHOD_LABEL[r.payment.method] ?? r.payment.method },
            { label: 'Reference', value: r.payment.reference ?? '—' },
            { label: 'Received', value: formatDate(r.payment.receivedAt) },
          ],
          actions: (r) => [
            { label: 'View', variant: 'outline' as const, onClick: () => setViewId(r.id) },
          ],
        }}
        filters={[
          {
            key: 'property',
            label: 'Property',
            value: propertyId,
            onChange: setPropertyId,
            options: [{ value: '', label: 'All properties' }, ...propertyOptions],
          },
        ]}
        filterChips
        emptyState={{
          icon: Receipt,
          title: 'No receipts issued',
          description: 'Issue a receipt from a payment on the Payments tab.',
        }}
      />

      <ReceiptDialog receiptId={viewId} open={viewId !== null} onClose={() => setViewId(null)} />
    </div>
  )
}
