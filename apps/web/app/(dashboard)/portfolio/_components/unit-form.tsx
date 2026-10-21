'use client'

/**
 * UnitForm — shared create/edit unit form (plan-slice-1 §4.3, standard
 * variant). Same pattern as PropertyForm: page owns fetching/navigation,
 * this owns values + validation. Select options arrive as props so the
 * form stays fetch-free. Rental fields are TEMPLATES (unit defaultRent /
 * deposit) — never rewrites live leases or posted charges.
 *
 * Media: files upload straight to Cloudinary (folder under the property);
 * pages register them as UNIT document rows after save. The "From the
 * property gallery" picker links EXISTING property photos (passed in as
 * `propertyPhotos`, already filtered to ones the unit doesn't have) —
 * `assignPhotoIds` rides the submit payload to the page.
 */

import { useMemo, useState } from 'react'
import type { Unit } from '@workspace/database'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection, SelectOption, UploadedFile } from '@workspace/ui/types/components'
import { cn } from '@workspace/ui/lib/utils'

import {
  AREA_UNITS,
  AMENITY_OPTIONS,
  RENT_FREQUENCIES,
} from '@/lib/domain/property-constants'
import { UNIT_KINDS, UNIT_MANUAL_STATUSES, UNIT_STATUSES } from '@/lib/domain/unit-constants'
import { cloudinaryUploadHandler } from '@/lib/upload'

export type UnitFormValues = Record<string, unknown>

export interface UnitBuildingOption {
  id: string
  code: string
  name?: string | null
}

export interface UnitPropertyPhoto {
  id: string
  storageKey: string
  fileName?: string | null
}

export interface UnitFormProps {
  mode: 'create' | 'edit'
  buildings?: UnitBuildingOption[]
  initialValues?: Partial<Unit> | null
  saving?: boolean
  serverErrors?: Record<string, string>
  /** Property the unit belongs to — drives the Cloudinary folder + gallery picker. */
  propertyId: string
  /** Present in edit mode — uploads land in `properties/<id>/units/<unitId>`. */
  unitId?: string
  /** Property photos NOT already linked to this unit (deduped by the page). */
  propertyPhotos?: UnitPropertyPhoto[]
  /** Current UNIT photo URLs shown as existing media (edit only). */
  existingMediaUrls?: string[]
  /** Property-level amenities — excluded from the unit's amenity options. */
  propertyAmenities?: string[]
  /** Property currency — prefills the Rent & deposit section on create. */
  defaultCurrency?: string
  onSubmit: (values: UnitFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  return String(v)
}

function decimalStr(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : str(v)
}

export function seedUnitValues(
  u?: Partial<Unit> | null,
  opts?: { defaultCurrency?: string },
): UnitFormValues {
  return {
    unitRef: u?.unitRef ?? '',
    label: u?.label ?? '',
    unitType: u?.unitType ?? '',
    buildingId: u?.buildingId ?? '',
    floor: u?.floor ?? '',
    status: u?.status && UNIT_MANUAL_STATUSES.includes(u.status) ? u.status : '',
    isActive: u?.isActive ?? true,
    bedrooms: u?.bedrooms ?? '',
    bathrooms: u?.bathrooms ?? '',
    parkingBays: u?.parkingBays ?? '',
    areaValue: u?.areaValue != null ? decimalStr(u.areaValue) : '',
    areaUnit: u?.areaUnit ?? '',
    amenities: Array.isArray(u?.amenities) ? [...u.amenities] : [],
    accountNumber: u?.accountNumber ?? '',
    waterMeterNumber: u?.waterMeterNumber ?? '',
    electricityMeterNumber: u?.electricityMeterNumber ?? '',
    notes: u?.notes ?? '',
    defaultRent: u?.defaultRent != null ? decimalStr(u.defaultRent) : '',
    currency: u?.currency ?? opts?.defaultCurrency ?? '',
    billingFrequency: u?.billingFrequency ?? '',
    depositDefault: u?.depositDefault != null ? decimalStr(u.depositDefault) : '',
    media: [],
    assignPhotoIds: [],
  }
}

function validateUnit(v: UnitFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.unitRef).trim()) errs.unitRef = 'Unit reference is required'
  if (!str(v.unitType)) errs.unitType = 'Select a unit kind'
  const media = Array.isArray(v.media) ? (v.media as UploadedFile[]) : []
  if (media.some((f) => f.status === 'uploading')) errs.media = 'Wait for photos to finish uploading'
  else if (media.some((f) => f.status === 'error')) errs.media = 'Re-add or remove photos that failed to upload'
  for (const [name, label] of [
    ['floor', 'Floor'],
    ['bedrooms', 'Bedrooms'],
    ['bathrooms', 'Bathrooms'],
    ['parkingBays', 'Parking bays'],
  ] as const) {
    const raw = str(v[name]).trim()
    if (raw !== '') {
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 0) errs[name] = `${label} must be a whole number ≥ 0`
    }
  }
  for (const [name, label] of [
    ['defaultRent', 'Default rent'],
    ['depositDefault', 'Deposit default'],
    ['areaValue', 'Area'],
  ] as const) {
    const raw = str(v[name]).trim()
    if (raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
      errs[name] = `${label} must be a number ≥ 0`
    }
  }
  return errs
}

export function UnitForm({
  mode,
  buildings = [],
  initialValues,
  saving = false,
  serverErrors,
  propertyId,
  unitId,
  propertyPhotos = [],
  existingMediaUrls,
  propertyAmenities = [],
  defaultCurrency,
  onSubmit,
  onCancel,
}: UnitFormProps) {
  const [values, setValues] = useState<UnitFormValues>(() =>
    seedUnitValues(initialValues, { defaultCurrency }),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)

  const isEdit = mode === 'edit'
  // Edit: stable per-unit folder. Create: pending folder (unit id unknown
  // yet) — photos still land under the property, so a cancelled create
  // leaves only an upload that was never registered as a document row.
  const [uploadFolder] = useState(() => {
    if (isEdit && unitId) return `properties/${propertyId}/units/${unitId}`
    const uuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    return `properties/${propertyId}/units/pending/${uuid}`
  })
  const uploadHandler = useMemo(() => cloudinaryUploadHandler(uploadFolder), [uploadFolder])
  const buildingOptions: SelectOption[] = [
    { value: '', label: 'No building' },
    ...buildings.map((b) => ({ value: b.id, label: [b.code, b.name].filter(Boolean).join(' — ') })),
  ]
  const kindOptions: SelectOption[] = UNIT_KINDS
  // Unit amenities = ONLY what this unit adds. Property-wide ones (parking,
  // security…) are filtered out of the options; a selected-but-filtered value
  // stays visible so the form never silently drops an existing row (the server
  // strips property-level entries again on save).
  const propertyAmenitySet = useMemo(
    () => new Set(propertyAmenities.map((a) => a.trim().toLowerCase())),
    [propertyAmenities],
  )
  const amenityOptions: SelectOption[] = useMemo(() => {
    const pool = AMENITY_OPTIONS.filter((a) => !propertyAmenitySet.has(a.toLowerCase()))
    const selected = Array.isArray(values.amenities) ? (values.amenities as string[]) : []
    const keptSelected = selected.filter((a) => !pool.includes(a))
    return [...pool, ...keptSelected].map((a) => ({ value: a, label: a }))
  }, [propertyAmenitySet, values.amenities])

  const handleChange = (name: string, value: unknown) => {
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setSummary(null)
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (v: UnitFormValues) => {
    const errs = validateUnit(v)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(`Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`)
      return
    }
    setSummary(null)
    await onSubmit(v)
  }

  const sections: FormSection[] = [
    {
      id: 'identity',
      title: 'Unit',
      columns: 4,
      fields: [
        {
          name: 'unitRef',
          label: 'Unit reference',
          type: 'text',
          required: true,
          colSpan: 1,
          placeholder: 'A-101',
          helperText: 'Unique within the property',
        },
        { name: 'label', label: 'Display label', type: 'text', colSpan: 1, placeholder: 'Garden flat' },
        { name: 'unitType', label: 'Kind', type: 'select', required: true, colSpan: 1, options: kindOptions },
        { name: 'buildingId', label: 'Building', type: 'select', colSpan: 1, options: buildingOptions },
        { name: 'floor', label: 'Floor', type: 'number', colSpan: 1 },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          colSpan: 1,
          disabled: !isEdit,
          options: [
            { value: '', label: isEdit ? 'Automatic (follows leases)' : 'Set after creation' },
            ...UNIT_STATUSES.filter((s) => UNIT_MANUAL_STATUSES.includes(s.value)),
          ],
          helperText: isEdit
            ? 'Occupancy follows active leases — you can flag maintenance/blocked here'
            : 'Vacant on creation; occupancy follows leases',
        },
        {
          name: 'isActive',
          label: 'Listed as available',
          type: 'toggle',
          colSpan: 1,
          toggleLabel: 'Active',
        },
      ],
    },
    {
      id: 'space',
      title: 'Space',
      description: 'Physical measurements — all optional.',
      columns: 4,
      fields: [
        { name: 'bedrooms', label: 'Bedrooms', type: 'number', colSpan: 1 },
        { name: 'bathrooms', label: 'Bathrooms', type: 'number', colSpan: 1 },
        { name: 'parkingBays', label: 'Parking bays', type: 'number', colSpan: 1 },
        { name: 'areaValue', label: 'Floor area', type: 'number', colSpan: 1 },
        { name: 'areaUnit', label: 'Area unit', type: 'select', colSpan: 1, options: AREA_UNITS },
        {
          name: 'amenities',
          label: 'Unit amenities',
          type: 'checkbox-group',
          colSpan: 'full',
          options: amenityOptions,
          helperText:
            'Only this unit’s own extras — property-wide amenities (shared with every unit) live on the property.',
        },
      ],
    },
    {
      id: 'utilities',
      title: 'Utility accounts',
      description:
        'Individual service identifiers that belong to this unit — meter and account numbers travel with it (repairs, billing, handover).',
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
        {
          name: 'waterMeterNumber',
          label: 'Water meter no.',
          type: 'text',
          colSpan: 1,
          placeholder: 'WM-88231',
        },
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
      id: 'notes',
      title: 'Notes',
      columns: 4,
      fields: [{ name: 'notes', label: 'Notes', type: 'textarea', rows: 3, colSpan: 'full', placeholder: 'Condition quirks, access notes…' }],
    },
    {
      id: 'defaults',
      title: 'Rent & deposit',
      description:
        'Quick defaults used when a new lease starts on this unit — deposit is in months of rent (1 = one month). Changing these never edits a live lease or a posted charge.',
      columns: 4,
      fields: [
        {
          name: 'defaultRent',
          label: 'Default rent',
          type: 'number',
          colSpan: 1,
          placeholder: 'e.g. 15000',
          helperText: 'Per billing period, before charges',
        },
        {
          name: 'currency',
          label: 'Currency',
          type: 'text',
          colSpan: 1,
          placeholder: defaultCurrency || 'KES',
          helperText: defaultCurrency ? `Property default: ${defaultCurrency}` : undefined,
        },
        { name: 'billingFrequency', label: 'Billing frequency', type: 'select', colSpan: 1, options: RENT_FREQUENCIES },
        {
          name: 'depositDefault',
          label: 'Deposit (months of rent)',
          type: 'number',
          colSpan: 1,
          placeholder: 'e.g. 1',
          helperText: 'Collected up-front when a lease starts',
        },
      ],
    },
    {
      id: 'media',
      title: 'Photos',
      description:
        'New photos upload straight to the unit gallery — linked property photos are shared views of the same asset, so removing one here never deletes the property’s copy.',
      columns: 4,
      fields: [
        {
          name: 'media',
          label: 'Upload photos',
          type: 'file',
          accept: 'image/*',
          multiple: true,
          maxFiles: 20,
          maxSizeMB: 10,
          colSpan: 'full',
          onUpload: uploadHandler,
          ...(isEdit && existingMediaUrls && existingMediaUrls.length > 0
            ? { existingUrls: existingMediaUrls }
            : {}),
          helperText: 'The first photo becomes the cover. Manage captions/order later from the unit page.',
        },
        ...(propertyPhotos.length > 0
          ? [
              {
                name: 'assignPhotoIds',
                label: 'From the property gallery',
                type: 'custom',
                colSpan: 'full',
                helperText:
                  'Photos already uploaded to the property — select to also show on this unit.',
                render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => {
                  const selected = Array.isArray(value) ? (value as string[]) : []
                  return (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {propertyPhotos.map((p) => {
                        const on = selected.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={on}
                            aria-label={on ? `Remove ${p.fileName ?? 'photo'} from selection` : `Add ${p.fileName ?? 'photo'} to unit`}
                            onClick={() =>
                              onChange(on ? selected.filter((x) => x !== p.id) : [...selected, p.id])
                            }
                            className={cn(
                              'relative aspect-square overflow-hidden rounded-xl border-2 transition',
                              on
                                ? 'border-primary ring-2 ring-primary/30'
                                : 'border-border hover:border-muted-foreground/40',
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.storageKey}
                              alt={p.fileName ?? 'Property photo'}
                              loading="lazy"
                              className="size-full object-cover"
                            />
                            {on ? (
                              <span className="absolute right-1 top-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                                Added
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )
                },
              } satisfies FormSection['fields'][number],
            ]
          : []),
      ],
    },
  ]

  const fieldErrors: Record<string, string> = { ...errors, ...serverErrors }

  return (
    <div className="space-y-4">
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      <UniversalForm
        title={isEdit ? 'Edit unit' : 'Add unit'}
        description={
          isEdit
            ? 'Update the unit record — rental fields are templates for future leases.'
            : 'Identify the unit now; rent defaults can be refined later.'
        }
        mode={mode}
        variant="standard"
        sections={sections}
        values={values}
        errors={fieldErrors}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel={isEdit ? 'Save changes' : 'Create unit'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
