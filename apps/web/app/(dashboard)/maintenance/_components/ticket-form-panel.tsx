'use client'

/** TicketFormPanel — loads properties + units, renders TicketForm. */

import { PageLoader } from '@workspace/ui/components/loader'
import { TicketForm, type TicketFormValues } from './ticket-form'
import { usePropertyUnitOptions } from './use-property-unit-options'

export interface TicketFormPanelProps {
  mode: 'create' | 'edit'
  initialValues?: {
    propertyId?: string
    unitId?: string | null
    title?: string
    description?: string | null
    category?: string
    priority?: string
  } | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: TicketFormValues) => void | Promise<void>
  onCancel: () => void
}

export function TicketFormPanel({
  mode,
  initialValues,
  saving,
  serverErrors,
  onSubmit,
  onCancel,
}: TicketFormPanelProps) {
  const { properties, units, unitsLoading, loading, setPropertyId } = usePropertyUnitOptions(
    initialValues?.propertyId ?? '',
  )

  if (loading) return <PageLoader title="Loading ticket form…" />

  return (
    <TicketForm
      mode={mode}
      properties={properties}
      units={units}
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
