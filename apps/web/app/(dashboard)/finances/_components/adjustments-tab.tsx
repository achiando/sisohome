'use client'

/**
 * Adjustments tab — the correction queue (Slice 8): PENDING first with
 * Approve/Reject actions (adjustment.approve), plus "New adjustment"
 * (adjustment.create). Approved rows reduce charge balances everywhere.
 */

import { useCallback, useEffect, useState } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { chargeTypeLabel } from '@/lib/domain/charge-constants'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { AdjustmentDialog } from './adjustment-dialog'
import { usePropertyOptions } from './doc-dialogs'

type AdjustmentRow = {
  id: string
  chargeId: string
  propertyId: string
  type: string
  amount: string
  reason: string
  status: string
  decidedAt: string | null
  createdAt: string
  charge: {
    id: string
    chargeType: string
    title: string | null
    amount: string
    currency: string
    balance: string
    dueDate: string
    unit: { id: string; unitRef: string } | null
    property: { id: string; name: string }
    tenant: { id: string; displayName: string } | null
  }
  submittedBy: { id: string; displayName: string | null; email: string } | null
  approvedBy: { id: string; displayName: string | null; email: string } | null
}

const STATUS_TONE: Record<string, 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
}

const TYPE_LABEL: Record<string, string> = {
  CREDIT: 'Credit',
  WAIVER: 'Waiver',
  REVERSAL: 'Reversal',
  WRITE_OFF: 'Write-off',
}

function money(amount: string, currency: string) {
  const n = Number(amount)
  return `${currency} ${n.toLocaleString()}`
}

export function AdjustmentsTab() {
  const { hasUiPermission } = useUiPermission()
  const propertyOptions = usePropertyOptions()
  const [rows, setRows] = useState<AdjustmentRow[] | null>(null)
  const [propertyId, setPropertyId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    const qs = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''
    fetch(`/api/adjustments${qs}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load adjustments')
        return data as { adjustments: AdjustmentRow[] }
      })
      .then((data) => {
        if (!cancelled) setRows(data.adjustments ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load adjustments')
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  const decide = useCallback(
    async (id: string, decision: 'approve' | 'reject') => {
      try {
        const res = await fetch(`/api/adjustments/${id}/${decision}`, {
          method: 'POST',
          credentials: 'include',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error ?? 'Could not decide adjustment')
          return
        }
        toast.success(decision === 'approve' ? 'Adjustment approved' : 'Adjustment rejected')
        load()
      } catch {
        toast.error('Network error — nothing changed')
      }
    },
    [load],
  )

  if (rows === null) return <PageLoader title="Loading adjustments…" description="" />

  return (
    <div className="space-y-6">
      <ResponsiveDataListing<AdjustmentRow>
        title="Adjustments"
        hideHeaderOnMobile
        items={rows}
        loading={false}
        skeletonCount={5}
        count={rows.length}
        rowKey={(a) => a.id}
        columns={[
          {
            header: 'Charge',
            cell: (a) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {a.charge.title ?? chargeTypeLabel(a.charge.chargeType)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.charge.property.name}
                  {a.charge.unit ? ` · ${a.charge.unit.unitRef}` : ''}
                  {a.charge.tenant ? ` · ${a.charge.tenant.displayName}` : ''}
                </p>
              </div>
            ),
          },
          {
            header: 'Type',
            cell: (a) => <Badge variant="info" size="sm">{TYPE_LABEL[a.type] ?? a.type}</Badge>,
          },
          {
            header: 'Amount',
            cell: (a) => (
              <span className="text-sm font-medium tabular-nums">
                {money(a.amount, a.charge.currency)}
              </span>
            ),
          },
          {
            header: 'Status',
            cell: (a) => (
              <Badge variant={STATUS_TONE[a.status] ?? 'neutral'} size="sm">
                {a.status}
              </Badge>
            ),
          },
          {
            header: 'Submitted',
            cell: (a) => (
              <div className="min-w-0">
                <p className="truncate text-sm">{a.submittedBy?.displayName ?? a.submittedBy?.email ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
              </div>
            ),
          },
          {
            header: 'Reason',
            cell: (a) => <span className="block max-w-48 truncate text-sm text-muted-foreground">{a.reason}</span>,
          },
          {
            header: '',
            className: 'w-36',
            cell: (a) =>
              a.status === 'PENDING' && hasUiPermission('adjustment.approve') ? (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => decide(a.id, 'approve')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => decide(a.id, 'reject')}>
                    Reject
                  </Button>
                </div>
              ) : null,
          },
        ]}
        cardMapper={{
          id: (a) => a.id,
          title: (a) => a.charge.title ?? chargeTypeLabel(a.charge.chargeType),
          subtitle: (a) => `${TYPE_LABEL[a.type] ?? a.type} · ${a.charge.property.name}`,
          statusBadge: (a) => (
            <Badge variant={STATUS_TONE[a.status] ?? 'neutral'} size="sm">
              {a.status}
            </Badge>
          ),
          amount: (a) => <span className="font-semibold tabular-nums">{money(a.amount, a.charge.currency)}</span>,
          detailFields: (a) => [
            { label: 'Reason', value: a.reason },
            { label: 'Submitted', value: formatDate(a.createdAt) },
            { label: 'Decided', value: a.decidedAt ? formatDate(a.decidedAt) : 'Pending' },
          ],
          actions: (a) =>
            a.status === 'PENDING' && hasUiPermission('adjustment.approve')
              ? [
                  { label: 'Approve', variant: 'outline' as const, onClick: () => decide(a.id, 'approve') },
                  { label: 'Reject', variant: 'outline' as const, onClick: () => decide(a.id, 'reject') },
                ]
              : [],
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
          icon: SlidersHorizontal,
          title: 'No adjustments',
          description: 'Corrections to charges show up here for approval.',
        }}
        primaryAction={
          hasUiPermission('adjustment.create')
            ? { label: 'New adjustment', icon: Plus, onClick: () => setDialogOpen(true) }
            : undefined
        }
      />

      <AdjustmentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={load} />
    </div>
  )
}
