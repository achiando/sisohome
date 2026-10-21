'use client'

/**
 * ImportUnitsDialog — CSV/Excel unit import wrapped around the shared
 * @workspace/ui BulkUploadDialog (upload → column mapping → preview →
 * import → per-row errors).
 *
 * Client side does what only the browser can: maps building CODE → id
 * (unknown codes fail the row instead of silently creating a unit with no
 * building), turns the comma-separated amenities cell into a list, and
 * prefills currency from the property. Everything else (unique ref per
 * property, kind required, amenities stripped against the property's own
 * list) runs through the same server path as single-unit create, partially:
 * good rows land, bad rows come back keyed by their original file row.
 */

import { useMemo } from 'react'
import {
  BulkUploadDialog,
  type BulkUploadConfig,
  type FieldDefinition,
  type ParsedRow,
} from '@workspace/ui/components'

import { AREA_UNITS, RENT_FREQUENCIES } from '@/lib/domain/property-constants'
import { IMPORT_MAX_ROWS, UNIT_KINDS } from '@/lib/domain/unit-constants'
import type { UnitBuildingOption } from './unit-form'

const fields: FieldDefinition[] = [
  { key: 'unitRef', label: 'Unit reference', type: 'text', required: true, aiHint: 'unit code like A-101' },
  { key: 'unitType', label: 'Kind', type: 'select', required: true, options: UNIT_KINDS, aiHint: 'apartment, bed-sitter, office…' },
  { key: 'label', label: 'Display label', type: 'text', helpText: 'Shown in UI — defaults to the reference' },
  { key: 'buildingId', label: 'Building code', type: 'text', helpText: 'Building CODE, e.g. BLK-A (blank = no building)' },
  { key: 'floor', label: 'Floor', type: 'number' },
  { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
  { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
  { key: 'parkingBays', label: 'Parking bays', type: 'number' },
  { key: 'areaValue', label: 'Floor area', type: 'number' },
  { key: 'areaUnit', label: 'Area unit', type: 'select', options: AREA_UNITS },
  { key: 'defaultRent', label: 'Default rent', type: 'currency' },
  { key: 'depositDefault', label: 'Deposit (months of rent)', type: 'number', helpText: 'e.g. 1 or 2' },
  { key: 'currency', label: 'Currency', type: 'text', helpText: 'Blank = property currency' },
  { key: 'billingFrequency', label: 'Billing frequency', type: 'select', options: RENT_FREQUENCIES },
  { key: 'accountNumber', label: 'Account number', type: 'text', helpText: 'Utility / billing account' },
  { key: 'waterMeterNumber', label: 'Water meter no.', type: 'text' },
  { key: 'electricityMeterNumber', label: 'Token meter no.', type: 'text', helpText: 'Prepaid electricity meter' },
  { key: 'notes', label: 'Notes', type: 'text' },
  {
    key: 'amenities',
    label: 'Unit amenities',
    type: 'text',
    helpText: 'Comma-separated unit extras — property-wide amenities are ignored',
  },
]

export function ImportUnitsDialog({
  open,
  propertyId,
  buildings,
  defaultCurrency,
  onClose,
  onImported,
}: {
  open: boolean
  propertyId: string
  buildings: UnitBuildingOption[]
  /** Property currency — used when the currency column is blank. */
  defaultCurrency?: string
  onClose: () => void
  onImported: () => void
}) {
  const config = useMemo<BulkUploadConfig>(
    () => ({
      title: 'Import units',
      description:
        'CSV or Excel — one row per unit. Map your columns, preview, then import: valid rows are created even if others fail, and failures list the exact row to fix.',
      accept: '.csv,.xlsx,.xls',
      maxRows: IMPORT_MAX_ROWS,
      fields,
      onSubmit: async (rows: ParsedRow[]) => {
        const byCode = new Map<string, string>()
        buildings.forEach((b) => byCode.set(b.code.trim().toLowerCase(), b.id))

        const payload: Record<string, unknown>[] = []
        const sentRowNumbers: number[] = []
        const clientErrors: Record<number, string> = {}

        rows.forEach((row) => {
          const d: Record<string, unknown> = { ...row.data }

          const code = typeof d.buildingId === 'string' ? d.buildingId.trim() : ''
          if (code) {
            const id = byCode.get(code.toLowerCase())
            if (!id) {
              clientErrors[row.rowIndex] = `Unknown building code “${code}” — fix the code or leave the cell blank`
              return
            }
            d.buildingId = id
          } else {
            delete d.buildingId
          }

          if (typeof d.amenities === 'string') {
            const list = d.amenities.split(',').map((s) => s.trim()).filter(Boolean)
            if (list.length > 0) d.amenities = list
            else delete d.amenities
          }

          const currency = typeof d.currency === 'string' ? d.currency.trim() : ''
          if (currency) d.currency = currency
          else if (defaultCurrency) d.currency = defaultCurrency
          else delete d.currency

          payload.push(d)
          sentRowNumbers.push(row.rowIndex)
        })

        if (payload.length === 0) {
          // Every row was rejected client-side — surface them as row errors.
          return { success: 0, failed: rows.length, errors: clientErrors }
        }

        const res = await fetch(`/api/properties/${propertyId}/units/import`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: payload }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Import failed')

        // Server keys errors by payload index (0-based) → original file row.
        const errors: Record<number, string> = { ...clientErrors }
        const serverErrors = (data.errors ?? {}) as Record<string, unknown>
        Object.entries(serverErrors).forEach(([key, value]) => {
          const original = sentRowNumbers[Number(key)]
          if (original !== undefined) errors[original] = String(value)
        })

        const success = Number(data.success ?? 0)
        const failed = Number(data.failed ?? 0) + Object.keys(clientErrors).length
        if (success > 0) onImported()
        return { success, failed, errors }
      },
    }),
    [propertyId, buildings, defaultCurrency, onImported],
  )

  return <BulkUploadDialog open={open} onOpenChange={(o) => !o && onClose()} config={config} />
}
