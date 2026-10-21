'use client'

/** /maintenance/schedule/new — recurring job via shared form. */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { ScheduleFormValues } from '../../_components/schedule-form'
import { ScheduleFormPanel } from '../../_components/schedule-form-panel'

export default function NewSchedulePage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)

  if (!hasUiPermission('schedule.create')) {
    return (
      <ScopeDenied
        title="Cannot create schedules"
        message="You need the schedule.create permission."
        backHref="/maintenance/schedule"
        backLabel="Back to schedules"
      />
    )
  }

  const handleSubmit = async (values: ScheduleFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/maintenance/schedules', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create schedule')
        setSaving(false)
        return
      }
      toast.success('Schedule created')
      router.push('/maintenance/schedule')
    } catch {
      toast.error('Network error — schedule not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/maintenance/schedule')}>
          ← Schedules
        </Button>
      </div>
      <PageHeader title="New recurring schedule" description="The next due date is computed from the frequency and start date." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <ScheduleFormPanel
          mode="create"
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/maintenance/schedule')}
        />
      </div>
    </div>
  )
}
