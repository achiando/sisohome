'use client'

/**
 * usePropertyUnitOptions — shared option loading for every maintenance
 * form panel: properties once, units re-fetched per selected property
 * (same pattern as leasing' ApplicationFormPanel, minus the duplication).
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from '@workspace/ui/components/toast'
import type { PropertyOption, UnitOption } from './ticket-form'

export interface PropertyUnitOptions {
  properties: PropertyOption[]
  units: UnitOption[]
  unitsLoading: boolean
  loading: boolean
  propertyId: string
  setPropertyId: (id: string) => void
}

export function usePropertyUnitOptions(initialPropertyId = ''): PropertyUnitOptions {
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [unitsLoading, setUnitsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [propertyId, setPropertyId] = useState(initialPropertyId)

  useEffect(() => {
    let cancelled = false
    fetch('/api/properties', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load properties')
        const data = await res.json()
        return (data.properties ?? []) as PropertyOption[]
      })
      .then((list) => {
        if (!cancelled) setProperties(list)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load properties')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Units re-fetch on property change; state writes deferred to a microtask
  // (react-hooks v7 set-state-in-effect rule).
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

  return { properties, units, unitsLoading, loading, propertyId, setPropertyId }
}
