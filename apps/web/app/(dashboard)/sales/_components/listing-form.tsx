'use client'

/**
 * ListingForm — shared create/edit listing form (plan-slice-5 §3).
 * The `shared` flag (marketing side) disables the portfolio-only fields;
 * the server enforces the same allowlist — this is UX only.
 */

import { useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'
import { usePropertyOptions } from '@/app/(dashboard)/finances/_components/doc-dialogs'
import {
  LISTING_FREQUENCIES,
  LISTING_PURPOSES,
  LISTING_SOURCE_CHANNELS,
} from '@/lib/domain/sales-constants'

export type ListingFormValues = Record<string, unknown>

export interface ListingFormProps {
  mode: 'create' | 'edit'
  shared?: boolean
  initialValues?: Record<string, unknown> | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: ListingFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

export function seedListingValues(
  init?: Record<string, unknown> | null,
  shared = false,
): ListingFormValues {
  return {
    propertyId: str(init?.propertyId),
    purpose: str(init?.purpose) || 'SALE',
    title: str(init?.title),
    description: str(init?.description),
    highlights: Array.isArray(init?.highlights) ? (init!.highlights as string[]).join(', ') : '',
    askingPrice: str(init?.askingPrice),
    currency: str(init?.currency) || 'KES',
    priceFrequency: str(init?.priceFrequency) || 'TOTAL',
    priceOnRequest: init?.priceOnRequest === true,
    commissionRate: str(init?.commissionRate),
    commissionBasis: str(init?.commissionBasis) || 'PERCENT',
    sourceChannel: str(init?.sourceChannel) || (shared ? 'MARKETING_AGENT' : 'DIRECT'),
    contactPhone: str(init?.contactPhone),
    contactEmail: str(init?.contactEmail),
    expiresAt: init?.expiresAt ? str(init.expiresAt).slice(0, 10) : '',
  }
}

export function validateListing(v: ListingFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.propertyId).trim()) errs.propertyId = 'Property is required'
  if (!str(v.title).trim()) errs.title = 'Title is required'
  if (!str(v.askingPrice).trim() && v.priceOnRequest !== true) {
    errs.askingPrice = 'Set an asking price or tick price-on-request'
  }
  if (str(v.askingPrice).trim() && !(Number(str(v.askingPrice)) >= 0)) {
    errs.askingPrice = 'Price must be a positive number'
  }
  if (str(v.commissionRate).trim()) {
    const rate = Number(str(v.commissionRate))
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      errs.commissionRate = 'Rate must be between 0 and 100'
    }
  }
  return errs
}

/** Values → API payload (empty strings become null, highlights split). */
export function listingPayload(v: ListingFormValues): Record<string, unknown> {
  const highlights = str(v.highlights)
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  return {
    propertyId: str(v.propertyId) || null,
    purpose: str(v.purpose),
    title: str(v.title),
    description: str(v.description) || null,
    highlights,
    askingPrice: str(v.askingPrice).trim() ? Number(str(v.askingPrice)) : null,
    currency: str(v.currency) || 'KES',
    priceFrequency: str(v.priceFrequency),
    priceOnRequest: v.priceOnRequest === true,
    commissionRate: str(v.commissionRate).trim() ? Number(str(v.commissionRate)) : null,
    commissionBasis: str(v.commissionBasis),
    sourceChannel: str(v.sourceChannel),
    contactPhone: str(v.contactPhone) || null,
    contactEmail: str(v.contactEmail) || null,
    expiresAt: str(v.expiresAt) ? str(v.expiresAt) : null,
  }
}

export function ListingForm({
  mode,
  shared = false,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: ListingFormProps) {
  const properties = usePropertyOptions()
  const [values, setValues] = useState<ListingFormValues>(() =>
    seedListingValues(initialValues, shared),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)

  const isEdit = mode === 'edit'
  const contentOnly = shared

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

  const handleSubmit = async (v: ListingFormValues) => {
    const errs = validateListing(v)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(`Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`)
      return
    }
    setSummary(null)
    await onSubmit(listingPayload(v))
  }

  const sections: FormSection[] = [
    {
      id: 'listing',
      title: 'Listing',
      columns: 4,
      fields: [
        {
          name: 'propertyId',
          label: 'Property',
          type: 'select',
          required: true,
          colSpan: 2,
          disabled: isEdit,
          options: [
            { value: '', label: 'Select a property…' },
            ...properties,
          ],
        },
        {
          name: 'purpose',
          label: 'Purpose',
          type: 'select',
          colSpan: 1,
          disabled: isEdit,
          options: LISTING_PURPOSES,
        },
        {
          name: 'sourceChannel',
          label: 'Source',
          type: 'select',
          colSpan: 1,
          disabled: contentOnly,
          options: LISTING_SOURCE_CHANNELS,
        },
        {
          name: 'title',
          label: 'Title',
          type: 'text',
          required: true,
          colSpan: 'full',
          placeholder: 'e.g. 3-bed Kilimani apartment, ready to move in',
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 4,
          colSpan: 'full',
          placeholder: 'What makes this home stand out…',
        },
        {
          name: 'highlights',
          label: 'Highlights',
          type: 'textarea',
          rows: 2,
          colSpan: 'full',
          placeholder: 'Comma-separated: parking, borehole, SQ, garden…',
          helperText: contentOnly ? undefined : 'Shown as bullet chips on the listing',
        },
      ],
    },
    {
      id: 'price',
      title: contentOnly ? 'Price (portfolio side only)' : 'Price & terms',
      columns: 4,
      fields: [
        {
          name: 'askingPrice',
          label: 'Asking price',
          type: 'number',
          colSpan: 2,
          disabled: contentOnly,
          placeholder: 'e.g. 8500000',
        },
        {
          name: 'currency',
          label: 'Currency',
          type: 'text',
          colSpan: 1,
          disabled: contentOnly,
        },
        {
          name: 'priceFrequency',
          label: 'Basis',
          type: 'select',
          colSpan: 1,
          disabled: contentOnly,
          options: LISTING_FREQUENCIES,
        },
        {
          name: 'priceOnRequest',
          label: 'Price on request',
          type: 'checkbox',
          colSpan: 1,
          disabled: contentOnly,
          checkboxLabel: 'Hide the price',
        },
        {
          name: 'commissionRate',
          label: 'Commission %',
          type: 'number',
          colSpan: 1,
          disabled: contentOnly,
        },
        {
          name: 'contactPhone',
          label: 'Contact phone',
          type: 'phone',
          colSpan: 1,
        },
        {
          name: 'contactEmail',
          label: 'Contact email',
          type: 'email',
          colSpan: 1,
        },
        {
          name: 'expiresAt',
          label: 'Expires on',
          type: 'date',
          colSpan: 1,
          disabled: contentOnly,
        },
      ],
    },
  ]

  return (
    <div className="space-y-4">
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      {contentOnly ? (
        <Alert>
          <AlertDescription>
            You are editing a shared listing — only the content and contact fields can change here.
            Price, terms and closing stay with the portfolio organization.
          </AlertDescription>
        </Alert>
      ) : null}
      <UniversalForm
        title={isEdit ? 'Edit listing' : 'New listing'}
        description={
          contentOnly
            ? 'Marketing content for a listing shared with your organization.'
            : 'Draft a for-sale or for-rent listing. Publish once the pin and price are set.'
        }
        mode={mode}
        variant="standard"
        sections={sections}
        values={values}
        errors={{ ...errors, ...serverErrors }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel={isEdit ? 'Save changes' : 'Create listing'}
        formClassName="w-full"
        bare
      />
    </div>
  )
}
