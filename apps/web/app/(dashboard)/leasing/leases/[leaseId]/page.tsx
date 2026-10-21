'use client'

/**
 * /leasing/leases/[leaseId] — lease detail (plan-slice-2 §3).
 * Tabs: Overview (term + billing + lifecycle), Units, Parties, Documents,
 * Terms. Lifecycle actions render from LEASE_TRANSITIONS; party PII rides
 * the tenant.read gate on the API.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, Home, User } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { DetailTabs, type DetailTab } from '@/app/(dashboard)/_components/domain/detail-tabs'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { EntityDocumentsTab } from '../../_components/entity-documents-tab'
import { LeaseLifecycleActions } from '../../_components/lease-lifecycle-actions'
import { LeaseStatusBadge } from '../../_components/lease-status'

type LeaseDetail = {
  id: string
  leaseRef: string | null
  status: string
  tenureType: string
  startsAt: string
  endsAt: string | null
  noticeDate: string | null
  signedAt: string | null
  currency: string
  billingFrequency: string
  paymentDueDay: number | null
  depositMonths: string | null
  noticeDays: number | null
  autoRenew: boolean
  terms: string | null
  property: { id: string; name: string; code?: string | null }
  units: {
    id: string
    monthlyRent: string
    currency: string | null
    billingFrequency: string | null
    depositAmount: string | null
    notes: string | null
    unit: { id: string; unitRef: string; label: string | null; status: string }
  }[]
  parties: {
    id: string
    relationship: string
    shareOfRent: string | null
    notes: string | null
    tenant: {
      id: string
      displayName: string
      email?: string | null
      phone?: string | null
      status: string
    }
  }[]
  renewals: { id: string; status: string; startsAt: string; endsAt: string | null }[]
  renewalOf: { id: string; status: string; startsAt: string; endsAt: string | null } | null
}

export default function LeaseDetailPage() {
  const router = useRouter()
  const params = useParams<{ leaseId: string }>()
  const leaseId = params.leaseId
  const { hasUiPermission } = useUiPermission()

  const [lease, setLease] = useState<LeaseDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/leases/${leaseId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Lease not found')
        return data.lease as LeaseDetail
      })
      .then((l) => {
        if (!cancelled) setLease(l)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Lease not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [leaseId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('lease.read')) {
    return <ScopeDenied message="You need the lease.read permission to view leases. Ask an owner or admin of your organization." />
  }

  if (loading) return <PageLoader title="Loading lease…" />
  if (!lease) {
    return (
      <ScopeDenied
        message="This lease doesn't exist for your organization."
        backHref="/leasing/leases"
        backLabel="Back to leases"
      />
    )
  }

  const infoRow = (icon: ReactNode, label: string, value: string | number | null | undefined) =>
    value !== null && value !== undefined && value !== '' ? (
      <div className="flex items-center gap-3 text-sm">
        <span className="flex size-9 items-center justify-center rounded-xl bg-muted">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate font-medium">{String(value)}</p>
        </div>
      </div>
    ) : null

  const overview: DetailTab = {
    id: 'overview',
    label: 'Overview',
    content: (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {infoRow(<Building2 size={18} />, 'Property', lease.property.name)}
          {infoRow(<Home size={18} />, 'Units', lease.units.map((u) => u.unit.label ?? u.unit.unitRef).join(', '))}
          {infoRow(<User size={18} />, 'Primary tenant', (lease.parties.find((p) => p.relationship === 'PRIMARY') ?? lease.parties[0])?.tenant.displayName)}
          {infoRow(<Home size={18} />, 'Tenure', lease.tenureType === 'LICENSE' ? 'Licence' : 'Lease')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {infoRow(<Home size={18} />, 'Start', formatDate(lease.startsAt))}
          {infoRow(<Home size={18} />, 'End', lease.endsAt ? formatDate(lease.endsAt) : 'Month-to-month')}
          {infoRow(<Home size={18} />, 'Billing', `${lease.billingFrequency.toLowerCase()} · ${lease.currency}`)}
          {infoRow(<Home size={18} />, 'Payment due day', lease.paymentDueDay)}
          {infoRow(<Home size={18} />, 'Deposit (months)', lease.depositMonths)}
          {infoRow(<Home size={18} />, 'Notice (days)', lease.noticeDays)}
          {infoRow(<Home size={18} />, 'Auto-renew', lease.autoRenew ? 'Yes' : 'No')}
          {infoRow(<Home size={18} />, 'Signed', lease.signedAt ? formatDate(lease.signedAt) : null)}
        </div>
        {lease.renewalOf || lease.renewals.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            {lease.renewalOf ? (
              <p>
                Renewal of{' '}
                <button
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => router.push(`/leasing/leases/${lease.renewalOf!.id}`)}
                >
                  {lease.renewalOf.id.slice(0, 8)}
                </button>{' '}
                ({formatDate(lease.renewalOf.startsAt)} → {lease.renewalOf.endsAt ? formatDate(lease.renewalOf.endsAt) : 'open'})
              </p>
            ) : null}
            {lease.renewals.length > 0 ? (
              <p className={lease.renewalOf ? 'mt-2' : ''}>
                Renewed by {lease.renewals.length} lease(s){' '}
                {lease.renewals.map((r) => (
                  <button
                    key={r.id}
                    className="ml-1 font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => router.push(`/leasing/leases/${r.id}`)}
                  >
                    {r.id.slice(0, 8)}
                  </button>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    ),
  }

  const unitsTab: DetailTab = {
    id: 'units',
    label: `Units (${lease.units.length})`,
    content: (
      <div className="space-y-3">
        {lease.units.length === 0 ? (
          <p className="text-sm text-muted-foreground">No units on this lease.</p>
        ) : (
          lease.units.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="font-medium">{u.unit.label ?? u.unit.unitRef}</p>
                <p className="text-xs text-muted-foreground">
                  {u.billingFrequency ? `${u.billingFrequency.toLowerCase()} override · ` : ''}
                  {u.currency ?? lease.currency}
                  {u.notes ? ` · ${u.notes}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{u.monthlyRent}</p>
                {u.depositAmount ? <p className="text-xs text-muted-foreground">deposit {u.depositAmount}</p> : null}
              </div>
            </div>
          ))
        )}
      </div>
    ),
  }

  const partiesTab: DetailTab = {
    id: 'parties',
    label: `Parties (${lease.parties.length})`,
    content: (
      <div className="space-y-3">
        {lease.parties.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{p.tenant.displayName}</p>
                <Badge variant="neutral" size="sm">{p.relationship}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.tenant.email ?? p.tenant.phone ?? 'Contact not available'}
                {p.notes ? ` · ${p.notes}` : ''}
              </p>
            </div>
            {p.shareOfRent ? <p className="text-sm font-medium">{p.shareOfRent}</p> : null}
          </div>
        ))}
      </div>
    ),
  }

  const documentsTab: DetailTab = {
    id: 'documents',
    label: 'Documents',
    content: (
      <EntityDocumentsTab
        entityType="LEASE"
        entityId={lease.id}
        kindOptions={[
          { value: 'TENANCY_AGREEMENT', label: 'Tenancy agreement' },
          { value: 'CONTRACT', label: 'Contract' },
          { value: 'DEPOSIT_RECEIPT', label: 'Deposit receipt' },
          { value: 'INSURANCE', label: 'Insurance' },
          { value: 'NOTICE', label: 'Notice' },
          { value: 'OTHER', label: 'Other' },
        ]}
        storageHint={`leases/${lease.id.slice(0, 8)}`}
      />
    ),
  }

  const termsTab: DetailTab = {
    id: 'terms',
    label: 'Terms',
    content: (
      <div className="rounded-xl border border-border bg-card p-4">
        {lease.terms ? (
          <p className="whitespace-pre-wrap text-sm">{lease.terms}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No general terms recorded.</p>
        )}
      </div>
    ),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/leasing/leases')}>
          ← Leases
        </Button>
      </div>
      <PageHeader
        title={lease.leaseRef ?? `Lease ${lease.id.slice(0, 8)}`}
        description={`${lease.property.name} · ${formatDate(lease.startsAt)} → ${lease.endsAt ? formatDate(lease.endsAt) : 'open'}`}
        actions={
          <>
            <LeaseStatusBadge status={lease.status} />
            {hasUiPermission('lease.update') ? (
              <Button variant="outline" onClick={() => router.push(`/leasing/leases/${lease.id}/edit`)}>
                Edit
              </Button>
            ) : null}
            {hasUiPermission('lease.approve') ? (
              <LeaseLifecycleActions
                lease={{ id: lease.id, status: lease.status, startsAt: lease.startsAt, endsAt: lease.endsAt }}
                onChanged={load}
              />
            ) : null}
          </>
        }
      />

      <DetailTabs tabs={[overview, unitsTab, partiesTab, documentsTab, termsTab]} />
    </div>
  )
}
