'use client'

/**
 * BulkUnitsDialog — range generator "units 101–124" (plan-slice-1 §4.3).
 * Live client preview mirrors the server's `bulkRefs`; the API is the
 * source of truth (pre-flights uniqueness per property, 409 listing the
 * conflicting refs).
 *
 * State lives in an inner component inside DialogContent — Radix unmounts
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
import { Badge } from '@workspace/ui/components/badge'
import type { FormSection, SelectOption } from '@workspace/ui/types/components'
import type { UnitType } from '@workspace/database'

import { BULK_MAX_RANGE, UNIT_KINDS } from '@/lib/domain/unit-constants'
import { RENT_FREQUENCIES } from '@/lib/domain/property-constants'
import type { UnitBuildingOption } from './unit-form'

interface Values extends Record<string, unknown> {
  prefix: string
  from: string | number
  to: string | number
  skip: string
  buildingId: string
  unitType: string
  templateId: string
  defaultRent: string | number
  depositDefault: string | number
  currency: string
  billingFrequency: string
  floor: string | number
  bedrooms: string | number
}

function seed(defaultCurrency?: string): Values {
  return {
    prefix: '',
    from: '',
    to: '',
    skip: '',
    buildingId: '',
    unitType: '',
    templateId: '',
    defaultRent: '',
    depositDefault: '',
    currency: defaultCurrency ?? '',
    billingFrequency: '',
    floor: '',
    bedrooms: '',
  }
}

/** Mirror of the server helper (domain/unit.ts) for live preview. */
function previewRefs(prefix: string, from: number, to: number, skip: number[]): string[] {
  const skipped = new Set(skip)
  const refs: string[] = []
  for (let n = from; n <= to; n += 1) {
    if (!skipped.has(n)) refs.push(`${prefix}${n}`)
  }
  return refs
}

function parseSkip(raw: string): number[] {
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0)
}

function validate(v: Values): Record<string, string> {
  const errs: Record<string, string> = {}
  const from = Number(v.from)
  const to = Number(v.to)
  if (String(v.from).trim() === '' || !Number.isInteger(from)) errs.from = 'Start must be a whole number'
  if (String(v.to).trim() === '' || !Number.isInteger(to)) errs.to = 'End must be a whole number'
  if (!errs.from && !errs.to) {
    if (from > to) errs.to = 'End must be ≥ start'
    else if (to - from + 1 > BULK_MAX_RANGE) errs.to = `Max ${BULK_MAX_RANGE} units per batch`
  }
  if (!String(v.unitType)) errs.unitType = 'Select a unit kind'
  return errs
}

const sections: FormSection[] = [
  {
    id: 'range',
    title: 'Range',
    columns: 4,
    fields: [
      { name: 'prefix', label: 'Reference prefix', type: 'text', colSpan: 1, placeholder: 'A-', helperText: 'Added before each number' },
      { name: 'from', label: 'From', type: 'number', required: true, colSpan: 1, placeholder: '101' },
      { name: 'to', label: 'To', type: 'number', required: true, colSpan: 1, placeholder: '124' },
      { name: 'skip', label: 'Skip numbers', type: 'text', colSpan: 1, placeholder: '113, 117', helperText: 'Comma-separated' },
    ],
  },
  {
    id: 'placement',
    title: 'Placement',
    columns: 4,
    fields: [
      { name: 'buildingId', label: 'Building', type: 'select', colSpan: 1, options: [] },
      { name: 'unitType', label: 'Kind', type: 'select', required: true, colSpan: 1, options: UNIT_KINDS },
      { name: 'templateId', label: 'Unit type template', type: 'select', colSpan: 1, options: [], helperText: 'Fills bedrooms, area and rent' },
    ],
  },
  {
    id: 'defaults',
    title: 'Rent & deposit',
    description:
      'Applied to every unit in the run — deposit is in months of rent (1 = one month). Meter numbers are unique per unit, so add them individually or via CSV/Excel import.',
    columns: 4,
    fields: [
      {
        name: 'defaultRent',
        label: 'Default rent',
        type: 'number',
        colSpan: 1,
        placeholder: 'e.g. 15000',
      },
      {
        name: 'depositDefault',
        label: 'Deposit (months of rent)',
        type: 'number',
        colSpan: 1,
        placeholder: 'e.g. 1',
        helperText: 'Collected up-front when a lease starts',
      },
      { name: 'currency', label: 'Currency', type: 'text', colSpan: 1, placeholder: 'KES' },
      { name: 'billingFrequency', label: 'Billing frequency', type: 'select', colSpan: 1, options: RENT_FREQUENCIES },
      { name: 'floor', label: 'Floor', type: 'number', colSpan: 1 },
      { name: 'bedrooms', label: 'Bedrooms', type: 'number', colSpan: 1 },
    ],
  },
]

export function BulkUnitsDialog(props: {
  open: boolean
  propertyId: string
  buildings: UnitBuildingOption[]
  unitTypes: UnitType[]
  /** Property currency — prefills the Rent & deposit section. */
  defaultCurrency?: string
  onClose: () => void
  onCreated: () => void
}) {
  const { open, onClose } = props
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk add units</DialogTitle>
          <DialogDescription>
            Generate a numbered run (e.g. 101–124). Created only if every reference is free on this
            property — conflicts cancel the whole batch.
          </DialogDescription>
        </DialogHeader>
        <BulkUnitsInner {...props} />
      </DialogContent>
    </Dialog>
  )
}

function BulkUnitsInner({
  propertyId,
  buildings,
  unitTypes,
  defaultCurrency,
  onClose,
  onCreated,
}: {
  propertyId: string
  buildings: UnitBuildingOption[]
  unitTypes: UnitType[]
  defaultCurrency?: string
  onClose: () => void
  onCreated: () => void
}) {
  const [values, setValues] = useState<Values>(() => seed(defaultCurrency))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dynamicSections = useMemo(() => {
    const buildingOptions: SelectOption[] = [
      { value: '', label: 'No building' },
      ...buildings.map((b) => ({ value: b.id, label: [b.code, b.name].filter(Boolean).join(' — ') })),
    ]
    const templateOptions: SelectOption[] = [
      { value: '', label: 'No template' },
      ...unitTypes.map((t) => ({
        value: t.id,
        label: [t.name, t.bedrooms != null ? `${t.bedrooms} bed` : null, t.baseRent != null ? `rent ${Number(t.baseRent)}` : null]
          .filter(Boolean)
          .join(' · '),
      })),
    ]
    return sections.map((s) => ({
      ...s,
      fields: s.fields.map((f) =>
        f.name === 'buildingId' && f.type === 'select'
          ? { ...f, options: buildingOptions }
          : f.name === 'templateId' && f.type === 'select'
            ? { ...f, options: templateOptions }
            : f,
      ),
    }))
  }, [buildings, unitTypes])

  const preview = useMemo(() => {
    const from = Number(values.from)
    const to = Number(values.to)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to || to - from + 1 > BULK_MAX_RANGE) {
      return [] as string[]
    }
    return previewRefs(String(values.prefix), from, to, parseSkip(String(values.skip ?? '')))
  }, [values])

  const handleSubmit = async (v: Record<string, unknown>) => {
    const errs = validate(v as Values)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      setSummary(Object.values(errs).join(' · '))
      return
    }
    setSummary(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/units/bulk`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: v.prefix ?? '',
          from: Number(v.from),
          to: Number(v.to),
          skip: parseSkip(String(v.skip ?? '')),
          buildingId: String(v.buildingId ?? '') || null,
          unitTypeTemplateId: String(v.templateId ?? '') || null,
          defaults: {
            unitType: v.unitType,
            defaultRent: v.defaultRent,
            depositDefault: v.depositDefault,
            currency: v.currency,
            billingFrequency: v.billingFrequency,
            floor: v.floor,
            bedrooms: v.bedrooms,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create units')
        setSaving(false)
        return
      }
      toast.success(`Created ${data.created} unit${data.created === 1 ? '' : 's'}`)
      onCreated()
      onClose()
    } catch {
      toast.error('Network error — units not created')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Preview</span>
          <Badge variant="primary" size="sm">
            {preview.length} unit{preview.length === 1 ? '' : 's'}
          </Badge>
        </div>
        {preview.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.slice(0, 16).map((ref) => (
              <Badge key={ref} variant="neutral" size="sm">
                {ref}
              </Badge>
            ))}
            {preview.length > 16 ? (
              <span className="text-xs text-muted-foreground">+{preview.length - 16} more…</span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Enter a range to preview generated refs.</p>
        )}
      </div>

      {summary ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {summary}
        </p>
      ) : null}

      <UniversalForm
        title="Range settings"
        mode="create"
        variant="standard"
        sections={dynamicSections}
        values={values}
        errors={errors}
        onChange={(name, value) => {
          setErrors((prev) => {
            if (!prev[name]) return prev
            const next = { ...prev }
            delete next[name]
            return next
          })
          setSummary(null)
          setValues((prev) => ({ ...prev, [name]: value }))
        }}
        onSubmit={handleSubmit}
        onCancel={onClose}
        isLoading={saving}
        primaryLabel={`Create ${preview.length || ''} unit${preview.length === 1 ? '' : 's'}`.replace('  ', ' ')}
        bare
        formClassName="w-full"
      />
    </>
  )
}
