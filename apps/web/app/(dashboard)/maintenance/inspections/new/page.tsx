'use client'

/** /maintenance/inspections/new — schedule an inspection. */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { InspectionFormValues } from '../../_components/inspection-form'
import { InspectionFormPanel } from '../../_components/inspection-form-panel'

export default function NewInspectionPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)

  if (!hasUiPermission('inspection.create')) {
    return (
      <ScopeDenied
        title="Cannot schedule inspections"
        message="You need the inspection.create permission."
        backHref="/maintenance/inspections"
        backLabel="Back to inspections"
      />
    )
  }

  const handleSubmit = async (values: InspectionFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/maintenance/inspections', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to schedule inspection')
        setSaving(false)
        return
      }
      toast.success('Inspection scheduled')
      router.push('/maintenance/inspections')
    } catch {
      toast.error('Network error — inspection not saved')
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
      <PageHeader title="Schedule inspection" description="Plan a routine, move-in/out, safety or compliance inspection." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <InspectionFormPanel
          mode="create"
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/maintenance/inspections')}
        />
      </div>
    </div>
  )
}
