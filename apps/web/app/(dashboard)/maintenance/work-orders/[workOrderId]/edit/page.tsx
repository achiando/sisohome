'use client'

/** /maintenance/work-orders/[workOrderId]/edit — costs/dates/scope edits. */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { WorkOrderFormValues } from '../../../_components/work-order-form'
import { WorkOrderFormPanel } from '../../../_components/work-order-form-panel'

type WorkOrderDetail = {
  id: string
  status: string
  propertyId: string
  unitId: string | null
  ticketId: string | null
  title: string
  description: string | null
  priority: string
  scheduledFor: string | null
  estimatedCost: string | number | null
  currency: string
}

export default function EditWorkOrderPage() {
  const router = useRouter()
  const params = useParams<{ workOrderId: string }>()
  const workOrderId = params.workOrderId
  const { hasUiPermission } = useUiPermission()

  const [wo, setWo] = useState<WorkOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  if (!hasUiPermission('work_order.update')) {
    return (
      <ScopeDenied
        title="Cannot edit work orders"
        message="You need the work_order.update permission."
        backHref="/maintenance/work-orders"
        backLabel="Back to work orders"
      />
    )
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

  const handleSubmit = async (values: WorkOrderFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save work order')
        setSaving(false)
        return
      }
      toast.success('Work order updated')
      router.push(`/maintenance/work-orders/${workOrderId}`)
    } catch {
      toast.error('Network error — changes not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/maintenance/work-orders/${workOrderId}`)}>
          ← Work order
        </Button>
      </div>
      <PageHeader title="Edit work order" description={wo.title} />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <WorkOrderFormPanel
          mode="edit"
          initialValues={wo}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/maintenance/work-orders/${workOrderId}`)}
        />
      </div>
    </div>
  )
}
