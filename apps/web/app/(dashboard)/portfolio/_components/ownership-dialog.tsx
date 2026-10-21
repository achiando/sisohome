'use client'

/**
 * OwnershipDialog — add/edit an ownership row (plan-slice-1 §2.1, §4.2).
 * Exactly one of propertyId/unitId is injected by the caller (XOR —
 * the service enforces it). Share % must keep the container total ≤ 100;
 * the API returns 400 and we surface it.
 *
 * State lives in an inner component inside DialogContent: Radix unmounts
 * content on close, so each open re-seeds fresh values.
 */

import { useMemo, useState } from 'react'
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

export interface OwnershipRow {
  id: string
  ownerPartyId: string
  sharePercent: number | string
  unitFactor?: number | string | null
  titleNumber?: string | null
  startsAt: string | Date
  endsAt?: string | Date | null
  ownerParty?: { name: string; partyType: string } | null
  unit?: { unitRef: string } | null
}

interface Values extends Record<string, unknown> {
  ownerPartyId: string
  sharePercent: string | number
  unitFactor: string | number
  titleNumber: string
  startsAt: string
  endsAt: string
}

function isoDay(v: unknown): string {
  if (typeof v !== 'string' || !v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toISOString().slice(0, 10)
}

function seed(row?: OwnershipRow | null): Values {
  return {
    ownerPartyId: row?.ownerPartyId ?? '',
    sharePercent: row?.sharePercent ?? '',
    unitFactor: row?.unitFactor ?? '',
    titleNumber: row?.titleNumber ?? '',
    startsAt: isoDay(row?.startsAt) || isoDay(new Date()),
    endsAt: isoDay(row?.endsAt),
  }
}

const baseSections: FormSection[] = [
  {
    id: 'ownership',
    title: 'Ownership',
    columns: 4,
    fields: [
      { name: 'ownerPartyId', label: 'Owner party', type: 'select', required: true, colSpan: 2, options: [] },
      { name: 'sharePercent', label: 'Share %', type: 'number', required: true, colSpan: 2, placeholder: '50', helperText: 'Active shares on this property/unit must total ≤ 100' },
      { name: 'unitFactor', label: 'Unit factor', type: 'number', colSpan: 2, helperText: 'Optional income-participation factor' },
      { name: 'titleNumber', label: 'Title / share certificate no.', type: 'text', colSpan: 2 },
      { name: 'startsAt', label: 'Starts', type: 'date', required: true, colSpan: 2 },
      { name: 'endsAt', label: 'Ends (optional)', type: 'date', colSpan: 2, helperText: 'Leave blank for current ownership' },
    ],
  },
]

export function OwnershipDialog({
  open,
  partyOptions,
  /** Container endpoints — exactly one is set by the caller. */
  propertyId,
  unitId,
  row,
  onClose,
  onSaved,
}: {
  open: boolean
  partyOptions: SelectOption[]
  propertyId?: string
  unitId?: string
  row?: OwnershipRow | null
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{row ? 'Edit ownership' : 'Add owner'}</DialogTitle>
          <DialogDescription>
            Records what share of {unitId ? 'this unit' : 'this property'} belongs to an owner party.
          </DialogDescription>
        </DialogHeader>
        <OwnershipInner partyOptions={partyOptions} propertyId={propertyId} unitId={unitId} row={row} onClose={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}

function OwnershipInner({
  partyOptions,
  propertyId,
  unitId,
  row,
  onClose,
  onSaved,
}: {
  partyOptions: SelectOption[]
  propertyId?: string
  unitId?: string
  row?: OwnershipRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Values>(() => seed(row))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const sections = useMemo(() => {
    const empty: SelectOption[] = [{ value: '', label: 'No owner parties yet' }]
    const opts = partyOptions.length > 0 ? partyOptions : empty
    return baseSections.map((s) => ({
      ...s,
      fields: s.fields.map((f) => (f.name === 'ownerPartyId' && f.type === 'select' ? { ...f, options: opts } : f)),
    }))
  }, [partyOptions])

  const handleSubmit = async (v: Record<string, unknown>) => {
    const errs: Record<string, string> = {}
    if (!String(v.ownerPartyId ?? '').trim()) errs.ownerPartyId = 'Owner party is required'
    const share = Number(v.sharePercent)
    if (String(v.sharePercent ?? '').trim() === '' || Number.isNaN(share) || share <= 0 || share > 100) {
      errs.sharePercent = 'Share must be between 0 and 100'
    }
    if (v.endsAt && v.startsAt && new Date(String(v.endsAt)) <= new Date(String(v.startsAt))) {
      errs.endsAt = 'End date must be after the start date'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const editId = row?.id
      const endpoint = editId
        ? `/api/ownerships/${editId}`
        : unitId
          ? `/api/units/${unitId}/ownership`
          : `/api/properties/${propertyId}/ownerships`
      const res = await fetch(endpoint, {
        method: editId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...v,
          unitFactor: String(v.unitFactor ?? '').trim() === '' ? null : Number(v.unitFactor),
          titleNumber: String(v.titleNumber ?? '').trim() || null,
          endsAt: v.endsAt ? v.endsAt : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save ownership')
        setSaving(false)
        return
      }
      toast.success(editId ? 'Ownership updated' : 'Owner added')
      onSaved()
      onClose()
    } catch {
      toast.error('Network error — ownership not saved')
      setSaving(false)
    }
  }

  return (
    <UniversalForm
      title={row ? 'Edit ownership' : 'Add owner'}
      mode={row ? 'edit' : 'create'}
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
      primaryLabel={row ? 'Save changes' : 'Add owner'}
      bare
      formClassName="w-full"
    />
  )
}
