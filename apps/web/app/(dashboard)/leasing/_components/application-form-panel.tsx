'use client'

/**
 * ApplicationFormPanel — shared fetch wrapper for the application
 * create/edit pages: loads properties + tenant directory once, units per
 * selected property, then renders ApplicationForm.
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from '@workspace/ui/components/toast'
import { PageLoader } from '@workspace/ui/components/loader'
import {
  ApplicationForm,
  type ApplicationFormValues,
  type PropertyOption,
  type TenantOption,
  type UnitOption,
} from './application-form'

export interface ApplicationFormPanelProps {
  mode: 'create' | 'edit'
  initialValues?: {
    propertyId?: string
    unitId?: string
    applicantTenantId?: string
    internalNotes?: string | null
  } | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: ApplicationFormValues) => void | Promise<void>
  onCancel: () => void
}

export function ApplicationFormPanel({
  mode,
  initialValues,
  saving,
  serverErrors,
  onSubmit,
  onCancel,
}: ApplicationFormPanelProps) {
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [unitsLoading, setUnitsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [propertyId, setPropertyId] = useState(initialValues?.propertyId ?? '')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/properties', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => (d.properties ?? []) as PropertyOption[]),
      fetch('/api/tenants', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => ((d.tenants ?? []) as TenantOption[])),
    ])
      .then(([props, tens]) => {
        if (cancelled) return
        setProperties(props)
        setTenants(tens)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load form options')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Units re-fetch whenever the selected property changes. State writes are
  // deferred to a microtask so the effect body itself stays pure (the
  // react-hooks v7 set-state-in-effect rule).
  const loadUnits = useCallback((pid: string) => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (!pid) {
        setUnits([])
        setUnitsLoading(false)
        return
      }
      setUnitsLoading(true)
      fetch(`/api/properties/${pid}/units`, { credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load units')
          const data = await res.json()
          return (data.units ?? []) as UnitOption[]
        })
        .then((list) => {
          if (!cancelled) setUnits(list)
        })
        .catch(() => {
          if (!cancelled) toast.error('Failed to load units')
        })
        .finally(() => {
          if (!cancelled) setUnitsLoading(false)
        })
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => loadUnits(propertyId), [propertyId, loadUnits])

  if (loading) return <PageLoader title="Loading application form…" />

  return (
    <ApplicationForm
      mode={mode}
      properties={properties}
      tenants={tenants}
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
