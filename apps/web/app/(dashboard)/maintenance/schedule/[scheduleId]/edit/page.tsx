'use client'

/** /maintenance/schedule/[scheduleId]/edit — edit a recurring schedule. */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { ScheduleFormValues } from '../../../_components/schedule-form'
import { ScheduleFormPanel } from '../../../_components/schedule-form-panel'

type ScheduleDetail = {
  id: string
  propertyId: string
  unitId: string | null
  title: string
  kind: string
  frequency: string
  startDate: string
  endDate: string | null
  assigneeUserId: string | null
  isActive: boolean
}

export default function EditSchedulePage() {
  const router = useRouter()
  const params = useParams<{ scheduleId: string }>()
  const scheduleId = params.scheduleId
  const { hasUiPermission } = useUiPermission()

  const [row, setRow] = useState<ScheduleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/maintenance/schedules/${scheduleId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Schedule not found')
        return data.schedule as ScheduleDetail
      })
      .then((r) => {
        if (!cancelled) setRow(r)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Schedule not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [scheduleId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('schedule.update')) {
    return (
      <ScopeDenied
        title="Cannot edit schedules"
        message="You need the schedule.update permission."
        backHref="/maintenance/schedule"
        backLabel="Back to schedules"
      />
    )
  }

  if (loading) return <PageLoader title="Loading schedule…" />
  if (!row) {
    return (
      <ScopeDenied
        message="This schedule doesn't exist for your organization."
        backHref="/maintenance/schedule"
        backLabel="Back to schedules"
      />
    )
  }

  const handleSubmit = async (values: ScheduleFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/maintenance/schedules/${scheduleId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save schedule')
        setSaving(false)
        return
      }
      toast.success('Schedule updated')
      router.push('/maintenance/schedule')
    } catch {
      toast.error('Network error — changes not saved')
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
      <PageHeader title="Edit schedule" description={row.title} />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <ScheduleFormPanel
          mode="edit"
          initialValues={row}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/maintenance/schedule')}
        />
      </div>
    </div>
  )
}
