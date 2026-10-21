'use client'

/** /maintenance/inspections/[inspectionId]/edit — reschedule + record findings. */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { InspectionFormValues } from '../../../_components/inspection-form'
import { InspectionFormPanel } from '../../../_components/inspection-form-panel'
import { InspectionLifecycleActions } from '../../../_components/inspection-lifecycle-actions'
import { StatusChip } from '../../../_components/maintenance-status'

type InspectionDetail = {
  id: string
  status: string
  propertyId: string
  unitId: string | null
  workOrderId: string | null
  kind: string
  scheduledFor: string | null
  inspectorUserId: string
  findings: string | null
}

export default function EditInspectionPage() {
  const router = useRouter()
  const params = useParams<{ inspectionId: string }>()
  const inspectionId = params.inspectionId
  const { hasUiPermission } = useUiPermission()

  const [row, setRow] = useState<InspectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/maintenance/inspections/${inspectionId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Inspection not found')
        return data.inspection as InspectionDetail
      })
      .then((r) => {
        if (!cancelled) setRow(r)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Inspection not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [inspectionId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('inspection.update')) {
    return (
      <ScopeDenied
        title="Cannot edit inspections"
        message="You need the inspection.update permission."
        backHref="/maintenance/inspections"
        backLabel="Back to inspections"
      />
    )
  }

  if (loading) return <PageLoader title="Loading inspection…" />
  if (!row) {
    return (
      <ScopeDenied
        message="This inspection doesn't exist for your organization."
        backHref="/maintenance/inspections"
        backLabel="Back to inspections"
      />
    )
  }

  const handleSubmit = async (values: InspectionFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/maintenance/inspections/${inspectionId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save inspection')
        setSaving(false)
        return
      }
      toast.success('Inspection updated')
      router.push('/maintenance/inspections')
    } catch {
      toast.error('Network error — changes not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/maintenance/inspections')}>
          ← Inspections
        </Button>
      </div>
      <PageHeader title="Edit inspection" description={`${row.kind.replace(/_/g, ' ').toLowerCase()} inspection`} />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <StatusChip status={row.status} />
          <InspectionLifecycleActions
            inspectionId={inspectionId}
            status={row.status}
            onChanged={() => load()}
          />
        </div>
        <div className="pt-4">
          <InspectionFormPanel
            mode="edit"
            initialValues={row}
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/maintenance/inspections')}
          />
        </div>
      </div>
    </div>
  )
}
