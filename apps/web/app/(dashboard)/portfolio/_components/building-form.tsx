'use client'

/**
 * BuildingForm — create/edit building in a dialog (unit rows group under
 * buildings; a building can't be deleted while units reference it —
 * surfaced from the API as 409).
 *
 * State lives in an inner component rendered inside DialogContent: Radix
 * unmounts content on close, so reopening re-seeds fresh state (no
 * reset-in-effect).
 */

import { useState } from 'react'
import { toast } from '@workspace/ui/components/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection, SelectOption } from '@workspace/ui/types/components'

import { AMENITY_OPTIONS } from '@/lib/domain/property-constants'

export interface BuildingRow {
  id: string
  code: string
  name?: string | null
  floors?: number | null
  yearBuilt?: number | null
  description?: string | null
  isActive?: boolean
  amenities?: string[]
  accountNumber?: string | null
  waterMeterNumber?: string | null
  electricityMeterNumber?: string | null
}

interface Values extends Record<string, unknown> {
  code: string
  name: string
  floors: string | number
  yearBuilt: string | number
  description: string
  isActive: boolean
  amenities: string[]
  accountNumber: string
  waterMeterNumber: string
  electricityMeterNumber: string
}

function seed(b?: BuildingRow | null): Values {
  return {
    code: b?.code ?? '',
    name: b?.name ?? '',
    floors: b?.floors ?? '',
    yearBuilt: b?.yearBuilt ?? '',
    description: b?.description ?? '',
    isActive: b?.isActive ?? true,
    amenities: Array.isArray(b?.amenities) ? [...b.amenities] : [],
    accountNumber: b?.accountNumber ?? '',
    waterMeterNumber: b?.waterMeterNumber ?? '',
    electricityMeterNumber: b?.electricityMeterNumber ?? '',
  }
}

/**
 * Building amenities hold ONLY what this building adds — property-wide rows
 * (shared parking, security…) are filtered out of the options, with any
 * selected-but-filtered value kept visible so an existing row never silently
 * disappears (the server strips property-level entries again on save).
 */
function buildSections(propertyAmenities: string[] = [], selectedAmenities: string[] = []): FormSection[] {
  const propertySet = new Set(propertyAmenities.map((a) => a.trim().toLowerCase()))
  const pool = AMENITY_OPTIONS.filter((a) => !propertySet.has(a.toLowerCase()))
  const keptSelected = selectedAmenities.filter((a) => !pool.includes(a))
  const amenityOptions: SelectOption[] = [...pool, ...keptSelected].map((a) => ({ value: a, label: a }))

  return [
    {
      id: 'building',
      title: 'Building',
      columns: 4,
      fields: [
        { name: 'code', label: 'Code', type: 'text', required: true, colSpan: 1, placeholder: 'BLK-A', helperText: 'Unique per property' },
        { name: 'name', label: 'Name', type: 'text', colSpan: 1, placeholder: 'Block A' },
        { name: 'floors', label: 'Floors', type: 'number', colSpan: 1 },
        { name: 'yearBuilt', label: 'Year built', type: 'number', colSpan: 1 },
        { name: 'description', label: 'Description', type: 'textarea', rows: 2, colSpan: 'full' },
        { name: 'isActive', label: 'In use', type: 'toggle', colSpan: 1, toggleLabel: 'Active building' },
      ],
    },
    {
      id: 'utilities',
      title: 'Utility accounts',
      description:
        'Service identifiers shared by every unit in this building — kept in one place so a block is easy to hand over, repair or bill.',
      columns: 4,
      fields: [
        {
          name: 'accountNumber',
          label: 'Account number',
          type: 'text',
          colSpan: 1,
          placeholder: 'e.g. WC-004512',
          helperText: 'Utility / billing account',
        },
        { name: 'waterMeterNumber', label: 'Water meter no.', type: 'text', colSpan: 1, placeholder: 'WM-88231' },
        {
          name: 'electricityMeterNumber',
          label: 'Token meter no.',
          type: 'text',
          colSpan: 1,
          placeholder: 'Prepaid electricity meter',
          helperText: 'KPLC / prepaid token meter',
        },
      ],
    },
    {
      id: 'amenities',
      title: 'Building amenities',
      columns: 4,
      fields: [
        {
          name: 'amenities',
          label: 'What this building adds',
          type: 'checkbox-group',
          colSpan: 'full',
          options: amenityOptions,
          helperText:
            'Shared with every unit inside this block — property-wide amenities live on the property instead.',
        },
      ],
    },
  ]
}

export function BuildingForm({
  open,
  propertyId,
  building,
  propertyAmenities,
  onClose,
  onSaved,
}: {
  open: boolean
  propertyId: string
  building?: BuildingRow | null
  /** Property-level amenities — excluded from the building's amenity options. */
  propertyAmenities?: string[]
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{building ? 'Edit building' : 'Add building'}</DialogTitle>
          <DialogDescription>
            {building
              ? 'Code must stay unique within this property.'
              : 'Group units into blocks, phases or wings — e.g. BLK-A.'}
          </DialogDescription>
        </DialogHeader>
        <BuildingFormInner
          propertyId={propertyId}
          building={building}
          propertyAmenities={propertyAmenities}
          onClose={onClose}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

function BuildingFormInner({
  propertyId,
  building,
  propertyAmenities = [],
  onClose,
  onSaved,
}: {
  propertyId: string
  building?: BuildingRow | null
  propertyAmenities?: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Values>(() => seed(building))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const sections = buildSections(propertyAmenities, Array.isArray(values.amenities) ? values.amenities : [])

  const handleSubmit = async (v: Record<string, unknown>) => {
    const errs: Record<string, string> = {}
    if (!String(v.code ?? '').trim()) errs.code = 'Code is required'
    const floors = String(v.floors ?? '').trim()
    if (floors !== '' && (!Number.isInteger(Number(floors)) || Number(floors) < 0)) {
      errs.floors = 'Floors must be a whole number ≥ 0'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const editId = building?.id
      const res = await fetch(editId ? `/api/buildings/${editId}` : `/api/properties/${propertyId}/buildings`, {
        method: editId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save building')
        setSaving(false)
        return
      }
      toast.success(editId ? 'Building updated' : 'Building added')
      onSaved()
      onClose()
    } catch {
      toast.error('Network error — building not saved')
      setSaving(false)
    }
  }

  return (
    <UniversalForm
      title={building ? 'Edit building' : 'Add building'}
      mode={building ? 'edit' : 'create'}
      variant="standard"
      sections={sections}
      values={values}
      errors={errors}
      onChange={(name, value) => {
        setErrors((prev) => {
          if (!prev[name]) return prev
          const next = { ...prev }
          delete next[name]
          return next
        })
        setValues((prev) => ({ ...prev, [name]: value }))
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      isLoading={saving}
      primaryLabel={building ? 'Save changes' : 'Add building'}
      bare
      formClassName="w-full"
    />
  )
}
