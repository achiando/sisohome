'use client'

/**
 * /maintenance/tickets/[ticketId] — status stepper + transitions, work
 * orders (with escalation dialog), reporter, docs ride the work orders
 * (plan-slice-3 §4).
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Wrench } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
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
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { DetailTabs, type DetailTab } from '@/app/(dashboard)/_components/domain/detail-tabs'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { PriorityChip, StatusChip } from '../../_components/maintenance-status'
import { TicketLifecycleActions } from '../../_components/ticket-lifecycle-actions'

type TicketDetail = {
  id: string
  title: string
  description: string | null
  category: string
  priority: string
  status: string
  reportedAt: string
  resolvedAt: string | null
  closedAt: string | null
  reportedByTenant: { id: string; displayName: string; email?: string | null; phone?: string | null } | null
  property: { id: string; name: string }
  unit: { id: string; unitRef: string; label: string | null } | null
  workOrders: {
    id: string
    title: string
    status: string
    estimatedCost: string | number | null
    currency: string
    assignments: {
      id: string
      status: string
      assigneeOrganization: { id: string; name: string } | null
    }[]
  }[]
}

const STEPPER = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

function StatusStepper({ status }: { status: string }) {
  const idx = STEPPER.indexOf(status)
  // Off-path statuses (ON_HOLD / CANCELLED) render as a lone chip.
  if (idx === -1) return <StatusChip status={status} />
  return (
    <div className="flex flex-wrap items-center gap-2">
      {renderStepperPath(idx)}
    </div>
  )
}

function renderStepperPath(currentIdx: number) {
  return STEPPER.map((s, i) => (
    <span key={s} className="flex items-center gap-2">
      {i > 0 ? <span className="h-px w-6 bg-border" aria-hidden /> : null}
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

export default function TicketDetailPage() {
  const router = useRouter()
  const params = useParams<{ ticketId: string }>()
  const ticketId = params.ticketId
  const { hasUiPermission } = useUiPermission()

  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [woTitle, setWoTitle] = useState('')
  const [woEstimate, setWoEstimate] = useState('')
  const [escalating, setEscalating] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/maintenance/tickets/${ticketId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Ticket not found')
        return data.ticket as TicketDetail
      })
      .then((t) => {
        if (!cancelled) setTicket(t)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Ticket not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ticketId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('maintenance.read')) {
    return <ScopeDenied message="You need the maintenance.read permission to view tickets." />
  }

  if (loading) return <PageLoader title="Loading ticket…" />
  if (!ticket) {
    return (
      <ScopeDenied
        message="This ticket doesn't exist for your organization."
        backHref="/maintenance"
        backLabel="Back to maintenance"
      />
    )
  }

  const live = ticket.status !== 'CLOSED' && ticket.status !== 'CANCELLED'

  const openEscalate = () => {
    setWoTitle(ticket.title)
    setWoEstimate('')
    setEscalateOpen(true)
  }

  const createWorkOrder = async () => {
    setEscalating(true)
    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/work-orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: woTitle || ticket.title,
          ...(woEstimate.trim() ? { estimatedCost: woEstimate.trim() } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to create work order')
      toast.success('Work order created from ticket')
      setEscalateOpen(false)
      router.push(`/maintenance/work-orders/${data.workOrder.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create work order')
      setEscalating(false)
    }
  }

  const overview: DetailTab = {
    id: 'overview',
    label: 'Overview',
    content: (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <StatusStepper status={ticket.status} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PriorityChip priority={ticket.priority} />
            <Badge variant="neutral" size="sm" className="capitalize">
              {ticket.category.replace(/_/g, ' ').toLowerCase()}
            </Badge>
            <Badge variant="neutral" size="sm">{ticket.property.name}</Badge>
            {ticket.unit ? (
              <Badge variant="neutral" size="sm">{ticket.unit.label ?? ticket.unit.unitRef}</Badge>
            ) : null}
          </div>
          {ticket.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm">{ticket.description}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
            <span>
              Reported {formatDate(ticket.reportedAt)}
              {ticket.reportedByTenant ? ` by ${ticket.reportedByTenant.displayName} (tenant)` : ''}
            </span>
            {ticket.resolvedAt ? <span>Resolved {formatDate(ticket.resolvedAt)}</span> : null}
            {ticket.closedAt ? <span>Closed {formatDate(ticket.closedAt)}</span> : null}
          </div>
          {hasUiPermission('maintenance.update') && live ? (
            <div className="mt-4 border-t border-border pt-4">
              <TicketLifecycleActions ticketId={ticket.id} status={ticket.status} onChanged={load} />
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">Work orders</p>
              <p className="text-sm text-muted-foreground">
                {ticket.workOrders.length === 0
                  ? 'No job authorized yet.'
                  : `${ticket.workOrders.length} linked to this ticket.`}
              </p>
            </div>
            {hasUiPermission('work_order.create') && live ? (
              <Button variant="primary" leftIcon={Wrench} onClick={openEscalate}>
                Create work order
              </Button>
            ) : null}
          </div>
          <div className="mt-4 divide-y divide-border">
            {ticket.workOrders.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                Escalating authorizes a repair job — the ticket moves to In progress once the job is
                authorized.
              </p>
            ) : (
              ticket.workOrders.map((wo) => {
                const activeAssignees = wo.assignments.filter((a) => a.status === 'ASSIGNED')
                return (
                  <div key={wo.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <button
                        className="truncate text-left text-sm font-medium hover:underline"
                        onClick={() => router.push(`/maintenance/work-orders/${wo.id}`)}
                      >
                        {wo.title}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {activeAssignees.length > 0
                          ? activeAssignees
                              .map((a) => (a.assigneeOrganization ? a.assigneeOrganization.name : 'Own team'))
                              .join(', ')
                          : 'Unassigned'}
                        {wo.estimatedCost !== null
                          ? ` · est ${wo.currency} ${Number(wo.estimatedCost).toLocaleString()}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip status={wo.status} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/maintenance/work-orders/${wo.id}`)}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    ),
  }

  const detail: DetailTab = {
    id: 'detail',
    label: 'Details',
    content: (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Property</dt>
            <dd className="text-sm font-medium">{ticket.property.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Unit</dt>
            <dd className="text-sm font-medium">
              {ticket.unit ? (
                <button
                  className="hover:underline"
                  onClick={() => router.push(`/portfolio/${ticket.property.id}`)}
                >
                  {ticket.unit.label ?? ticket.unit.unitRef}
                </button>
              ) : (
                'Whole property'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Reporter (tenant)</dt>
            <dd className="text-sm font-medium">
              {ticket.reportedByTenant
                ? `${ticket.reportedByTenant.displayName}${ticket.reportedByTenant.phone ? ` · ${ticket.reportedByTenant.phone}` : ''}`
                : 'Internal report'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Category</dt>
            <dd className="text-sm font-medium capitalize">
              {ticket.category.replace(/_/g, ' ').toLowerCase()}
            </dd>
          </div>
        </dl>
      </div>
    ),
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.title}
        description={[ticket.property.name, ticket.unit?.label ?? ticket.unit?.unitRef]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push(`/maintenance/tickets/${ticketId}/edit`)}>
              Edit
            </Button>
            {hasUiPermission('work_order.create') && live ? (
              <Button variant="primary" onClick={openEscalate}>
                Create work order
              </Button>
            ) : undefined}
          </>
        }
      />

      <DetailTabs tabs={[overview, detail]} defaultTab="overview" />

      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create work order from ticket</DialogTitle>
            <DialogDescription>
              Starts a PENDING job on this property. Authorize it from the work order to move the
              ticket to In progress.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="esc-title">Job title</Label>
              <Input id="esc-title" value={woTitle} onChange={(e) => setWoTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="esc-estimate">Estimated cost (optional)</Label>
              <Input
                id="esc-estimate"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={woEstimate}
                onChange={(e) => setWoEstimate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEscalateOpen(false)} disabled={escalating}>
              Cancel
            </Button>
            <Button variant="primary" loading={escalating} disabled={escalating || !woTitle.trim()} onClick={createWorkOrder}>
              Create work order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
