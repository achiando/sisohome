'use client'

/**
 * /maintenance/work-orders/[workOrderId] — stepper + lifecycle, costs,
 * Assign dialog (cross-org hook), assignments with decline/complete,
 * linked inspections, documents (quotes/completion photos, plan-slice-3 §4).
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { DetailTabs, type DetailTab } from '@/app/(dashboard)/_components/domain/detail-tabs'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { EntityDocumentsTab } from '@/app/(dashboard)/leasing/_components/entity-documents-tab'
import { AssignmentsList, type AssignmentRow } from '../../_components/assignments-list'
import { PriorityChip, StatusChip } from '../../_components/maintenance-status'
import { WorkOrderAssignDialog } from '../../_components/work-order-assign-dialog'
import { WorkOrderLifecycleActions } from '../../_components/work-order-lifecycle-actions'

type WorkOrderDetail = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  estimatedCost: string | number | null
  finalCost: string | number | null
  currency: string
  scheduledFor: string | null
  completedAt: string | null
  authorizedAt: string | null
  createdAt: string
  property: { id: string; name: string }
  unit: { id: string; unitRef: string; label: string | null } | null
  ticket: { id: string; title: string; status: string } | null
  assignments: AssignmentRow[]
  inspections: {
    id: string
    kind: string
    status: string
    scheduledFor: string | null
    inspector: { id: string; displayName: string }
  }[]
}

const STEPPER = ['PENDING', 'AUTHORIZED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED']

function renderStepperPath(currentIdx: number) {
  return STEPPER.map((s, i) => (
    <span key={s} className="flex items-center gap-2">
      {i > 0 ? <span className="h-px w-5 bg-border" aria-hidden /> : null}
      <Badge
        variant="neutral"
        size="sm"
        className={
          i === currentIdx
            ? 'bg-primary text-primary-foreground'
            : i < currentIdx
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground'
        }
      >
        {s.replace(/_/g, ' ').toLowerCase()}
      </Badge>
    </span>
  ))
}

function StatusStepper({ status }: { status: string }) {
  const idx = STEPPER.indexOf(status)
  if (idx === -1) return <StatusChip status={status} />
  return <div className="flex flex-wrap items-center gap-2">{renderStepperPath(idx)}</div>
}

function money(v: string | number | null, currency: string): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${currency} ${n.toLocaleString()}`
}

export default function WorkOrderDetailPage() {
  const router = useRouter()
  const params = useParams<{ workOrderId: string }>()
  const workOrderId = params.workOrderId
  const { hasUiPermission } = useUiPermission()

  const [wo, setWo] = useState<WorkOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignOpen, setAssignOpen] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/work-orders/${workOrderId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Work order not found')
        return data.workOrder as WorkOrderDetail
      })
      .then((row) => {
        if (!cancelled) setWo(row)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Work order not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workOrderId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('work_order.read')) {
    return <ScopeDenied message="You need the work_order.read permission to view work orders." />
  }

  if (loading) return <PageLoader title="Loading work order…" />
  if (!wo) {
    return (
      <ScopeDenied
        message="This work order doesn't exist for your organization."
        backHref="/maintenance/work-orders"
        backLabel="Back to work orders"
      />
    )
  }

  const editable = wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED'
  const canAssign =
    hasUiPermission('work_order.assign') &&
    editable &&
    wo.assignments.filter((a) => a.status === 'ASSIGNED').length === 0

  const overview: DetailTab = {
    id: 'overview',
    label: 'Overview',
    content: (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <StatusStepper status={wo.status} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PriorityChip priority={wo.priority} />
            <Badge variant="neutral" size="sm">{wo.property.name}</Badge>
            {wo.unit ? (
              <Badge variant="neutral" size="sm">{wo.unit.label ?? wo.unit.unitRef}</Badge>
            ) : null}
            {wo.ticket ? (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => router.push(`/maintenance/tickets/${wo.ticket!.id}`)}
              >
                ← ticket: {wo.ticket.title}
              </button>
            ) : null}
          </div>
          {wo.description ? <p className="mt-4 whitespace-pre-wrap text-sm">{wo.description}</p> : null}

          <dl className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Estimate</dt>
              <dd className="text-sm font-medium">{money(wo.estimatedCost, wo.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Final cost</dt>
              <dd className="text-sm font-medium">{money(wo.finalCost, wo.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Scheduled</dt>
              <dd className="text-sm font-medium">{wo.scheduledFor ? formatDate(wo.scheduledFor) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Authorized</dt>
              <dd className="text-sm font-medium">{wo.authorizedAt ? formatDate(wo.authorizedAt) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Completed</dt>
              <dd className="text-sm font-medium">{wo.completedAt ? formatDate(wo.completedAt) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Created</dt>
              <dd className="text-sm font-medium">{formatDate(wo.createdAt)}</dd>
            </div>
          </dl>

          {hasUiPermission('work_order.update') && editable ? (
            <div className="mt-4 border-t border-border pt-4">
              <WorkOrderLifecycleActions workOrderId={wo.id} status={wo.status} onChanged={load} />
            </div>
          ) : null}
        </div>

        <AssignmentsList
          assignments={wo.assignments}
          canUpdate={hasUiPermission('work_order.update')}
          onChanged={load}
        />

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">Inspections</p>
              <p className="text-sm text-muted-foreground">Evidence checks linked to this job.</p>
            </div>
            {hasUiPermission('inspection.create') ? (
              <Button variant="outline" onClick={() => router.push('/maintenance/inspections/new')}>
                Schedule inspection
              </Button>
            ) : null}
          </div>
          <div className="mt-4 divide-y divide-border">
            {wo.inspections.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No inspections linked yet.</p>
            ) : (
              wo.inspections.map((ins) => (
                <div key={ins.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium capitalize">
                      {ins.kind.replace(/_/g, ' ').toLowerCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ins.scheduledFor ? formatDate(ins.scheduledFor) : 'No date'} ·{' '}
                      {ins.inspector.displayName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip status={ins.status} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/maintenance/inspections/${ins.id}/edit`)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    ),
  }

  const documents: DetailTab = {
    id: 'documents',
    label: 'Documents',
    content: (
      <EntityDocumentsTab
        entityType="WORK_ORDER"
        entityId={wo.id}
        storageHint="Quotes, completion photos and job evidence"
      />
    ),
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={wo.title}
        description={[wo.property.name, wo.unit?.label ?? wo.unit?.unitRef].filter(Boolean).join(' · ')}
        actions={
          <>
            {hasUiPermission('work_order.update') && editable ? (
              <Button variant="outline" onClick={() => router.push(`/maintenance/work-orders/${workOrderId}/edit`)}>
                Edit
              </Button>
            ) : null}
            {canAssign ? (
              <Button variant="primary" onClick={() => setAssignOpen(true)}>
                Assign
              </Button>
            ) : undefined}
          </>
        }
      />

      <DetailTabs tabs={[overview, documents]} defaultTab="overview" />

      <WorkOrderAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        workOrderId={workOrderId}
        onAssigned={load}
      />
    </div>
  )
}
