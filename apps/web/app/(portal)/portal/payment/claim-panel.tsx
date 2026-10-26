'use client'

/**
 * Portal payment messages (payment claims) — the tenant posts "I paid"
 * (unit, amount, method, reference, date, note); the landlord/PM confirms
 * it on the org side and the real payment lands against their oldest open
 * charges. Display-only here: nothing on this page moves money, and
 * confirmed rows link back with the outcome + PM note.
 */

import { useCallback, useEffect, useState } from 'react'

import { Send } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { UniversalForm } from '@workspace/ui/components/form'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import type { FormSection } from '@workspace/ui/types/components'

import { usePortalApi, type PortalLease } from '../../_components/portal-data'

interface LeaseRes {
  success: boolean
  leases: PortalLease[]
}

interface ClaimRow {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  amount: string
  currency: string
  method: string
  accountType: string
  reference: string | null
  paidAt: string
  message: string | null
  createdAt: string
  decisionNote: string | null
  unit: { unitRef: string; label: string | null }
  property: { name: string }
}

interface ClaimsRes {
  success: boolean
  rows: ClaimRow[]
}

const METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' },
]

const ACCOUNT_TYPES = [
  { value: 'RENT', label: 'Rent' },
  { value: 'UTILITIES', label: 'Utilities' },
]

const STATUS_BADGE: Record<ClaimRow['status'], { variant: 'warning' | 'success' | 'error'; label: string }> = {
  PENDING: { variant: 'warning', label: 'Awaiting confirmation' },
  CONFIRMED: { variant: 'success', label: 'Recorded' },
  REJECTED: { variant: 'error', label: 'Rejected' },
}

const FIELD_NAMES = ['unitId', 'amount', 'paidAt', 'method', 'accountType'] as const

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function dateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function PaymentClaimPanel() {
  const leaseApi = usePortalApi<LeaseRes>('/api/portal/lease')
  const [rows, setRows] = useState<ClaimRow[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({
    unitId: '',
    amount: '',
    method: '',
    accountType: 'RENT',
    paidAt: '',
    reference: '',
    message: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    fetch('/api/portal/payment-claims', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<ClaimsRes>) : null))
      .then((d) => {
        if (d) {
          setRows(d.rows ?? [])
          setListError(null)
        } else {
          setListError('Could not load your payment messages.')
        }
      })
      .catch(() => setListError('Could not load your payment messages.'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const units =
    leaseApi.data?.leases.flatMap((lease) =>
      lease.units.map((u) => ({
        id: u.id,
        label: `${u.label} — ${lease.property.name}`,
      })),
    ) ?? []

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

  const handleSubmit = async (v: Record<string, unknown>) => {
    const next: Record<string, string> = {}
    const unitId = str(v.unitId)
    const amount = Number(str(v.amount).replace(/,/g, ''))
    const method = str(v.method)
    const accountType = str(v.accountType) || 'RENT'
    const paidAt = str(v.paidAt)
    if (!unitId) next.unitId = 'Choose which unit you paid for'
    if (!Number.isFinite(amount) || amount <= 0) next.amount = 'Enter the amount you paid'
    if (!method) next.method = 'Choose how you paid'
    if (!paidAt) next.paidAt = 'When did you make the payment?'
    setErrors(next)
    if (Object.keys(next).length > 0) {
      const labels = Object.values(next)
      setSummary(
        `Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before submitting: ${labels.join(' · ')}`,
      )
      return
    }

    setSummary(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal/payment-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          unitId,
          amount,
          method,
          accountType,
          paidAt,
          ...(str(v.reference) ? { reference: str(v.reference) } : {}),
          ...(str(v.message) ? { message: str(v.message) } : {}),
        }),
      })
      const data: { success?: boolean; error?: string } = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success('Payment message sent — your property team will confirm it')
        setValues((prev) => ({ ...prev, amount: '', reference: '', message: '', paidAt: '' }))
        load()
        return
      }
      const message = data.error ?? 'Something went wrong sending your payment message.'
      const field = FIELD_NAMES.find((f) => message.startsWith(f))
      if (field) setErrors({ [field]: message })
      else setSummary(message)
    } catch {
      setSummary('We could not reach the server. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const section: FormSection = {
    id: 'claim',
    title: 'Tell your landlord you paid',
    description:
      'Send the details of your payment — the property team confirms it, then it shows on your statement.',
    columns: 2,
    fields: [
      {
        name: 'unitId',
        label: 'Which unit?',
        type: 'select',
        required: true,
        colSpan: 2,
        options: units.map((u) => ({ value: u.id, label: u.label })),
        placeholder: 'Choose a unit',
      },
      {
        name: 'amount',
        label: 'Amount paid',
        type: 'number',
        required: true,
        colSpan: 1,
        placeholder: 'e.g. 25000',
      },
      {
        name: 'paidAt',
        label: 'Date paid',
        type: 'date',
        required: true,
        colSpan: 1,
      },
      {
        name: 'accountType',
        label: 'For',
        type: 'select',
        colSpan: 1,
        options: ACCOUNT_TYPES,
      },
      {
        name: 'method',
        label: 'How did you pay?',
        type: 'select',
        required: true,
        colSpan: 1,
        options: METHODS,
        placeholder: 'Choose a method',
      },
      {
        name: 'reference',
        label: 'Reference (optional)',
        type: 'text',
        colSpan: 1,
        placeholder: 'e.g. M-Pesa code',
      },
      {
        name: 'message',
        label: 'Note for your property team (optional)',
        type: 'textarea',
        colSpan: 1,
        placeholder: 'Anything they should know about this payment…',
      },
    ],
  }

  return (
    <div className="space-y-6">
      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="size-4 text-muted-foreground" aria-hidden="true" /> Report a payment
          </CardTitle>
          <CardDescription>
            Paid already? Send the details here — nothing lands on your statement until your
            property team confirms it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {units.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No units on your lease yet — contact your property team to sort out your tenancy
              details first.
            </p>
          ) : (
            <>
              {summary ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {summary}
                </p>
              ) : null}
              <UniversalForm
                title="Report a payment"
                mode="create"
                variant="standard"
                sections={[section]}
                values={values}
                errors={errors}
                onChange={handleChange}
                onSubmit={handleSubmit}
                isLoading={submitting}
                primaryLabel="Send payment message"
                formClassName="w-full"
                bare
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="text-base">Your payment messages</CardTitle>
          <CardDescription>
            What you have sent and how the property team handled it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {listError}
            </p>
          ) : rows === null ? (
            <div className="flex justify-center py-6">
              <PageLoader title="Loading your messages..." />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have not reported any payments yet.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {rows.map((c) => {
                const badge = STATUS_BADGE[c.status]
                return (
                  <li key={c.id} className="px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {c.currency} {Number(c.amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {c.accountType.toLowerCase()} · {c.unit.label ?? c.unit.unitRef}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Paid {dateLabel(c.paidAt)} · {c.method.toLowerCase().replace(/_/g, ' ')}
                          {c.reference ? ` · ${c.reference}` : ''} · sent {dateLabel(c.createdAt)}
                        </p>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    {c.message ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">“{c.message}”</p>
                    ) : null}
                    {c.status !== 'PENDING' && c.decisionNote ? (
                      <p className="mt-1.5 text-xs text-foreground">
                        Reply from your property team: {c.decisionNote}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
