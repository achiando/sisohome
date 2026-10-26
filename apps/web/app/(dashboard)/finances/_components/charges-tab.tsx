'use client'

/**
 * Charges tab — the charge register (Slice 8): invoice numbers, derived
 * balance (amount − allocations − approved adjustments) and the overdue
 * flag, with row actions Invoice / Adjust / Record payment plus a manual
 * "New charge" create behind `charge.create`.
 */

import { useCallback, useEffect, useState } from 'react'
import { Receipt, SlidersHorizontal, FileText, Plus } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { PageLoader } from '@workspace/ui/components/loader'
import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { Button } from '@workspace/ui/components/button'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { chargeTypeLabel } from '@/lib/domain/charge-constants'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { RecordPaymentDialog } from '@/app/(dashboard)/leasing/_components/record-payment-dialog'
import { ChargeDialog } from './charge-dialog'
import { AdjustmentDialog } from './adjustment-dialog'
import { InvoiceDialog, usePropertyOptions } from './doc-dialogs'

type ChargeRow = {
  id: string
  chargeType: string
  title: string | null
  amount: string
  currency: string
  dueDate: string
  postedAt: string | null
  invoiceNumber: string | null
  allocatedTotal: string
  adjustedTotal: string
  balance: string
  overdue: boolean
  accountType: 'RENT' | 'UTILITIES'
  tenant: { id: string; displayName: string } | null
  unit: { id: string; unitRef: string } | null
  property: { id: string; name: string }
  leaseId: string | null
  propertyId: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
]

function money(amount: string, currency: string) {
  const n = Number(amount)
  return `${currency} ${n.toLocaleString()}`
}

function statusOf(c: ChargeRow): { label: string; tone: 'success' | 'warning' | 'error' | 'info' } {
  if (Number(c.balance) <= 0.009) return { label: 'Paid', tone: 'success' }
  if (c.overdue) return { label: 'Overdue', tone: 'error' }
  return { label: c.postedAt ? 'Open' : 'Draft', tone: c.postedAt ? 'warning' : 'info' }
}

export function ChargesTab() {
  const { hasUiPermission } = useUiPermission()
  const propertyOptions = usePropertyOptions()
  const [rows, setRows] = useState<ChargeRow[] | null>(null)
  const [propertyId, setPropertyId] = useState('')
  const [status, setStatus] = useState('')
  const [chargeOpen, setChargeOpen] = useState(false)
  const [invoiceTarget, setInvoiceTarget] = useState<string | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<string | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [recordTarget, setRecordTarget] = useState<ChargeRow | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    const qs = new URLSearchParams()
    if (propertyId) qs.set('propertyId', propertyId)
    if (status) qs.set('status', status)
    fetch(`/api/charges?${qs.toString()}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load charges')
        return data as { charges: ChargeRow[] }
      })
      .then((data) => {
        if (!cancelled) setRows(data.charges ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load charges')
      })
    return () => {
      cancelled = true
    }
  }, [propertyId, status])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  if (rows === null) return <PageLoader title="Loading charges…" description="" />

  return (
    <div className="space-y-6">
      <ResponsiveDataListing<ChargeRow>
        title="Charge register"
        hideHeaderOnMobile
        items={rows}
        loading={false}
        skeletonCount={5}
        count={rows.length}
        rowKey={(c) => c.id}
        columns={[
          {
            header: 'Invoice',
            cell: (c) => (
              <button
                type="button"
                className="text-left text-sm font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setInvoiceTarget(c.id)}
                aria-label={`Open invoice for ${c.title ?? c.chargeType}`}
              >
                {c.invoiceNumber ?? 'Generate'}
              </button>
            ),
          },
          {
            header: 'Charge',
            cell: (c) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.title ?? chargeTypeLabel(c.chargeType)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {chargeTypeLabel(c.chargeType)} · {c.property.name}
                  {c.unit ? ` · ${c.unit.unitRef}` : ''}
                </p>
              </div>
            ),
          },
          {
            header: 'Tenant',
            cell: (c) => <span className="text-sm">{c.tenant?.displayName ?? '—'}</span>,
          },
          {
            header: 'Due',
            cell: (c) => (
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{formatDate(c.dueDate)}</span>
                {c.overdue ? (
                  <Badge variant="error" size="sm">
                    Overdue
                  </Badge>
                ) : null}
              </div>
            ),
          },
          { header: 'Amount', cell: (c) => <span className="text-sm tabular-nums">{money(c.amount, c.currency)}</span> },
          {
            header: 'Paid',
            cell: (c) => <span className="text-sm tabular-nums text-muted-foreground">{money(c.allocatedTotal, c.currency)}</span>,
          },
          {
            header: 'Balance',
            cell: (c) => {
              const bal = Number(c.balance)
              if (bal <= 0.009) return <span className="text-sm tabular-nums text-muted-foreground">—</span>
              return (
                <span className={`text-sm font-medium tabular-nums ${c.overdue ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {money(c.balance, c.currency)}
                </span>
              )
            },
          },
          {
            header: 'Status',
            cell: (c) => {
              const s = statusOf(c)
              return (
                <Badge variant={s.tone} size="sm">
                  {s.label}
                </Badge>
              )
            },
          },
          {
            header: '',
            className: 'w-12',
            cell: (c) => (
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-9 rounded-lg" aria-label={`Actions for ${c.title ?? c.chargeType}`}>
                      <SlidersHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setInvoiceTarget(c.id)}>
                      <FileText className="size-4" aria-hidden="true" /> Invoice
                    </DropdownMenuItem>
                    {hasUiPermission('adjustment.create') && Number(c.balance) > 0.009 ? (
                      <DropdownMenuItem
                        onClick={() => {
                          setAdjustTarget(c.id)
                          setAdjustOpen(true)
                        }}
                      >
                        <SlidersHorizontal className="size-4" aria-hidden="true" /> Adjust
                      </DropdownMenuItem>
                    ) : null}
                    {hasUiPermission('payment.create') && (c.unit || c.tenant || c.leaseId) && Number(c.balance) > 0.009 ? (
                      <DropdownMenuItem onClick={() => setRecordTarget(c)}>
                        <Receipt className="size-4" aria-hidden="true" /> Record payment
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          },
        ]}
        cardMapper={{
          id: (c) => c.id,
          title: (c) => c.title ?? chargeTypeLabel(c.chargeType),
          subtitle: (c) => `${c.property.name}${c.unit ? ` · ${c.unit.unitRef}` : ''}`,
          statusBadge: (c) => {
            const s = statusOf(c)
            return (
              <Badge variant={s.tone} size="sm">
                {s.label}
              </Badge>
            )
          },
          amount: (c) => <span className="font-semibold tabular-nums">{money(c.balance, c.currency)}</span>,
          detailFields: (c) => [
            { label: 'Invoice', value: c.invoiceNumber ?? '—' },
            { label: 'Tenant', value: c.tenant?.displayName ?? '—' },
            { label: 'Due', value: formatDate(c.dueDate) },
            { label: 'Amount', value: money(c.amount, c.currency) },
            { label: 'Paid', value: money(c.allocatedTotal, c.currency) },
          ],
          actions: (c) => {
            const acts: { label: string; variant?: 'outline'; onClick: () => void }[] = [
              { label: 'Invoice', variant: 'outline', onClick: () => setInvoiceTarget(c.id) },
            ]
            if (hasUiPermission('adjustment.create') && Number(c.balance) > 0.009) {
              acts.push({
                label: 'Adjust',
                variant: 'outline',
                onClick: () => {
                  setAdjustTarget(c.id)
                  setAdjustOpen(true)
                },
              })
            }
            if (hasUiPermission('payment.create') && (c.unit || c.tenant || c.leaseId) && Number(c.balance) > 0.009) {
              acts.push({ label: 'Record payment', variant: 'outline', onClick: () => setRecordTarget(c) })
            }
            return acts
          },
        }}
        filters={[
          {
            key: 'property',
            label: 'Property',
            value: propertyId,
            onChange: setPropertyId,
            options: [{ value: '', label: 'All properties' }, ...propertyOptions],
          },
          {
            key: 'status',
            label: 'Status',
            value: status,
            onChange: setStatus,
            options: STATUS_OPTIONS,
          },
        ]}
        filterChips
        emptyState={{
          icon: Receipt,
          title: 'No charges yet',
          description:
            rows.length > 0
              ? 'No charges match these filters.'
              : 'Generate monthly charges or add a one-off bill.',
        }}
        primaryAction={
          hasUiPermission('charge.create')
            ? { label: 'New charge', icon: Plus, onClick: () => setChargeOpen(true) }
            : undefined
        }
      />

      <InvoiceDialog chargeId={invoiceTarget} open={invoiceTarget !== null} onClose={() => setInvoiceTarget(null)} />
      <AdjustmentDialog
        chargeId={adjustTarget}
        open={adjustOpen}
        onClose={() => {
          setAdjustOpen(false)
          setAdjustTarget(null)
        }}
        onCreated={load}
      />
      <ChargeDialog open={chargeOpen} onClose={() => setChargeOpen(false)} onCreated={load} />
      {recordTarget ? (
        <RecordPaymentDialog
          open
          propertyId={recordTarget.propertyId}
          unitId={recordTarget.unit?.id ?? null}
          tenantId={recordTarget.tenant?.id ?? null}
          leaseId={recordTarget.leaseId}
          defaultAccountType={recordTarget.accountType}
          onClose={() => setRecordTarget(null)}
          onRecorded={load}
        />
      ) : null}
    </div>
  )
}
