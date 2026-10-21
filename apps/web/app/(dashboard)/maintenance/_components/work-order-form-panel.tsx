'use client'

/**
 * WorkOrderFormPanel — loads properties + units + open tickets (link
 * options), renders WorkOrderForm.
 */

import { useEffect, useState } from 'react'
import { PageLoader } from '@workspace/ui/components/loader'
import { WorkOrderForm, type TicketOption, type WorkOrderFormValues } from './work-order-form'
import { usePropertyUnitOptions } from './use-property-unit-options'

export interface WorkOrderFormPanelProps {
  mode: 'create' | 'edit'
  initialValues?: {
    propertyId?: string
    unitId?: string | null
    ticketId?: string | null
    title?: string
    description?: string | null
    priority?: string
    scheduledFor?: string | null
    estimatedCost?: string | number | null
    currency?: string
  } | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: WorkOrderFormValues) => void | Promise<void>
  onCancel: () => void
}

export function WorkOrderFormPanel({
  mode,
  initialValues,
  saving,
  serverErrors,
  onSubmit,
  onCancel,
}: WorkOrderFormPanelProps) {
  const { properties, units, unitsLoading, loading, setPropertyId } = usePropertyUnitOptions(
    initialValues?.propertyId ?? '',
  )
  // Edit mode needs no ticket options — start "loaded" so the effect never
  // has to set state synchronously (react-hooks v7 set-state-in-effect).
  const [ticketsLoaded, setTicketsLoaded] = useState(mode !== 'create')
  const [tickets, setTickets] = useState<TicketOption[]>([])

  useEffect(() => {
    if (mode !== 'create') return
    let cancelled = false
    fetch('/api/maintenance/tickets', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setTickets((d.tickets ?? []) as TicketOption[])
      })
      .catch(() => {
        /* optional link — silently empty */
      })
      .finally(() => {
        if (!cancelled) setTicketsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [mode])

  if (loading || !ticketsLoaded) return <PageLoader title="Loading work order form…" />

  return (
    <WorkOrderForm
      mode={mode}
      properties={properties}
      units={units}
      tickets={tickets}
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
