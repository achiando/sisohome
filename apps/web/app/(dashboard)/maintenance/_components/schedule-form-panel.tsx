'use client'

/**
 * ScheduleFormPanel — loads properties + units + org members (assignee
 * picker), renders ScheduleForm.
 */

import { useEffect, useState } from 'react'
import { PageLoader } from '@workspace/ui/components/loader'
import type { ScheduleFormValues } from './schedule-form'
import { ScheduleForm } from './schedule-form'
import type { MemberOption } from './inspection-form'
import { usePropertyUnitOptions } from './use-property-unit-options'

export interface ScheduleFormPanelProps {
  mode: 'create' | 'edit'
  initialValues?: {
    propertyId?: string
    unitId?: string | null
    title?: string
    kind?: string
    frequency?: string
    startDate?: string | null
    endDate?: string | null
    assigneeUserId?: string | null
    isActive?: boolean
  } | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: ScheduleFormValues) => void | Promise<void>
  onCancel: () => void
}

export function ScheduleFormPanel({
  mode,
  initialValues,
  saving,
  serverErrors,
  onSubmit,
  onCancel,
}: ScheduleFormPanelProps) {
  const { properties, units, unitsLoading, loading, setPropertyId } = usePropertyUnitOptions(
    initialValues?.propertyId ?? '',
  )
  const [members, setMembers] = useState<MemberOption[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Own-org directory (gated user.read — assignees must be members anyway).
    fetch('/api/members', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMembers((d.members ?? []) as MemberOption[])
      })
      .catch(() => {
        if (!cancelled) setMembers([])
      })
      .finally(() => {
        if (!cancelled) setMembersLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading || !membersLoaded) return <PageLoader title="Loading schedule form…" />

  return (
    <ScheduleForm
      mode={mode}
      properties={properties}
      units={units}
      members={members}
      unitsLoading={unitsLoading}
      onPropertyChange={setPropertyId}
      initialValues={initialValues}
      saving={saving}
      serverErrors={serverErrors}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  )
}
