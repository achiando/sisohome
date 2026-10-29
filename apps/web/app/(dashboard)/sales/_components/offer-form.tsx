'use client'

/**
 * OfferForm — create form for an offer on a live listing (plan-slice-5 §3).
 * Only PUBLISHED/UNDER_OFFER listings in scope are offered (server-checked).
 */

import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'
import type { LeadRow, ListingRow } from './sales-types'

export type OfferFormValues = Record<string, unknown>

export interface OfferFormProps {
  mode: 'create'
  initialValues?: Record<string, unknown> | null
  saving?: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: OfferFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function seedOfferValues(init?: Record<string, unknown> | null): OfferFormValues {
  return {
    listingId: str(init?.listingId),
    amount: str(init?.amount),
    offerDate: str(init?.offerDate) || today(),
    expiresAt: str(init?.expiresAt),
    leadId: str(init?.leadId),
    termsNote: str(init?.termsNote),
  }
}

export function validateOffer(v: OfferFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.listingId).trim()) errs.listingId = 'Listing is required'
  const amount = Number(str(v.amount))
  if (!str(v.amount).trim() || !Number.isFinite(amount) || amount <= 0) {
    errs.amount = 'A positive amount is required'
  }
  if (!str(v.offerDate).trim()) errs.offerDate = 'Offer date is required'
  return errs
}

export function offerPayload(v: OfferFormValues): Record<string, unknown> {
  const note = str(v.termsNote).trim()
  return {
    listingId: str(v.listingId) || null,
    amount: Number(str(v.amount)),
    offerDate: str(v.offerDate),
    expiresAt: str(v.expiresAt) ? str(v.expiresAt) : null,
    leadId: str(v.leadId) || null,
    terms: note ? { note } : undefined,
  }
}

export function OfferForm({
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: OfferFormProps) {
  const [listings, setListings] = useState<ListingRow[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [values, setValues] = useState<OfferFormValues>(() => seedOfferValues(initialValues))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/listings', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { listings: [] })),
      fetch('/api/leads', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { leads: [] })),
    ])
      .then(([l, d]: [{ listings?: ListingRow[] }, { leads?: LeadRow[] }]) => {
        if (cancelled) return
        setListings(
          (l.listings ?? []).filter(
            (row) =>
              (row.status === 'PUBLISHED' || row.status === 'UNDER_OFFER') && row.access === 'owner',
          ),
        )
        setLeads(d.leads ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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

  const handleSubmit = async (v: OfferFormValues) => {
    const errs = validateOffer(v)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(`Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`)
      return
    }
    setSummary(null)
    await onSubmit(offerPayload(v))
  }

  const sections: FormSection[] = [
    {
      id: 'offer',
      title: 'Offer',
      columns: 4,
      fields: [
        {
          name: 'listingId',
          label: 'Listing',
          type: 'select',
          required: true,
          colSpan: 2,
          options: [
            { value: '', label: 'Select a live listing…' },
            ...listings.map((l) => ({
              value: l.id,
              label: `${l.title} · ${l.property.name}${l.askingPrice ? ` · asking ${l.currency} ${l.askingPrice}` : ''}`,
            })),
          ],
        },
        {
          name: 'leadId',
          label: 'Buyer lead',
          type: 'select',
          colSpan: 2,
          options: [
            { value: '', label: 'No linked lead' },
            ...leads.map((l) => ({ value: l.id, label: l.displayName })),
          ],
        },
        {
          name: 'amount',
          label: 'Amount',
          type: 'number',
          required: true,
          colSpan: 2,
          placeholder: 'e.g. 8200000',
        },
        {
          name: 'offerDate',
          label: 'Offer date',
          type: 'date',
          required: true,
          colSpan: 1,
        },
        {
          name: 'expiresAt',
          label: 'Expires on',
          type: 'date',
          colSpan: 1,
        },
        {
          name: 'termsNote',
          label: 'Terms',
          type: 'textarea',
          rows: 3,
          colSpan: 'full',
          placeholder: 'Payment plan, contingencies, deposit %…',
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
      <UniversalForm
        title="New offer"
        description="Submit an offer on a published or under-offer listing."
        mode="create"
        variant="standard"
        sections={sections}
        values={values}
        errors={{ ...errors, ...serverErrors }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel="Submit offer"
        formClassName="w-full"
        bare
      />
    </div>
  )
}
