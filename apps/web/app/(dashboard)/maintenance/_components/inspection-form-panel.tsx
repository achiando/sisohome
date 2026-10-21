'use client'

/**
 * InspectionFormPanel — loads properties + units + org members (inspector
 * picker) + open work orders (link options), renders InspectionForm.
 */

import { useEffect, useState } from 'react'
import { PageLoader } from '@workspace/ui/components/loader'
import {
  InspectionForm,
  type InspectionFormValues,
  type MemberOption,
  type WorkOrderOption,
} from './inspection-form'
import { usePropertyUnitOptions } from './use-property-unit-options'

export interface InspectionFormPanelProps {
  mode: 'create' | 'edit'
  initialValues?: {
    propertyId?: string
    unitId?: string | null
    workOrderId?: string | null
    kind?: string
    scheduledFor?: string | null
    inspectorUserId?: string
    findings?: string | null
  } | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: InspectionFormValues) => void | Promise<void>
  onCancel: () => void
}

export function InspectionFormPanel({
  mode,
  initialValues,
  saving,
  serverErrors,
  onSubmit,
  onCancel,
}: InspectionFormPanelProps) {
  const { properties, units, unitsLoading, loading, setPropertyId } = usePropertyUnitOptions(
    initialValues?.propertyId ?? '',
  )
  const [members, setMembers] = useState<MemberOption[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([])
  const [extrasLoaded, setExtrasLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      // Own-org directory (gated user.read — inspectors must be members
      // anyway; the assignee-candidates route needs work_order.assign).
      fetch('/api/members', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => (d.members ?? []) as MemberOption[]),
      fetch('/api/work-orders', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => (d.workOrders ?? []) as WorkOrderOption[]),
    ])
      .then(([mems, wos]) => {
        if (cancelled) return
        setMembers(mems)
        setWorkOrders(wos)
      })
      .catch(() => {
        if (!cancelled) setMembers([])
      })
      .finally(() => {
        if (!cancelled) setExtrasLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading || !extrasLoaded) return <PageLoader title="Loading inspection form…" />

  return (
    <InspectionForm
      mode={mode}
      properties={properties}
      units={units}
      members={members}
      workOrders={workOrders}
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
