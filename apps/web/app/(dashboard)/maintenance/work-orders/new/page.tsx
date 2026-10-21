'use client'

/** /maintenance/work-orders/new — standalone work order via shared form. */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { WorkOrderFormValues } from '../../_components/work-order-form'
import { WorkOrderFormPanel } from '../../_components/work-order-form-panel'

export default function NewWorkOrderPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)

  if (!hasUiPermission('work_order.create')) {
    return (
      <ScopeDenied
        title="Cannot create work orders"
        message="You need the work_order.create permission."
        backHref="/maintenance/work-orders"
        backLabel="Back to work orders"
      />
    )
  }

  const handleSubmit = async (values: WorkOrderFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create work order')
        setSaving(false)
        return
      }
      toast.success('Work order created')
      router.push(`/maintenance/work-orders/${data.workOrder.id}`)
    } catch {
      toast.error('Network error — work order not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/maintenance/work-orders')}>
          ← Work orders
        </Button>
      </div>
      <PageHeader
        title="New work order"
        description="Authorize a repair job — assign it afterwards to staff or an external company."
      />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <WorkOrderFormPanel
          mode="create"
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/maintenance/work-orders')}
        />
      </div>
    </div>
  )
}
