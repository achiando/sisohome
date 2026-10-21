'use client'

/**
 * /leasing/leases/[leaseId]/edit — amend a lease via the shared wizard
 * (plan-slice-2 §3). Units and parties are replaced wholesale by the API.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { LeaseFormValues, LeaseInitialValues } from '../../../_components/lease-form'
import { LeaseFormPanel } from '../../../_components/lease-form-panel'

type LeaseForEdit = {
  id: string
  status: string
  propertyId: string
  leaseRef: string | null
  tenureType: string
  currency: string
  billingFrequency: string
  paymentDueDay: number | null
  depositMonths: string | null
  noticeDays: number | null
  autoRenew: boolean
  terms: string | null
  startsAt: string
  endsAt: string | null
  noticeDate: string | null
  units: { unitId: string; monthlyRent: string; depositAmount: string | null }[]
  parties: { tenantId: string; relationship: string; shareOfRent: string | null }[]
}

function toInitialValues(l: LeaseForEdit): LeaseInitialValues {
  return {
    propertyId: l.propertyId,
    leaseRef: l.leaseRef,
    tenureType: l.tenureType,
    currency: l.currency,
    billingFrequency: l.billingFrequency,
    paymentDueDay: l.paymentDueDay,
    depositMonths: l.depositMonths != null ? String(l.depositMonths) : null,
    noticeDays: l.noticeDays,
    autoRenew: l.autoRenew,
    terms: l.terms,
    startsAt: l.startsAt,
    endsAt: l.endsAt,
    noticeDate: l.noticeDate,
    units: l.units.map((u) => ({
      unitId: u.unitId,
      monthlyRent: String(u.monthlyRent),
      depositAmount: u.depositAmount != null ? String(u.depositAmount) : null,
    })),
    parties: l.parties.map((p) => ({
      tenantId: p.tenantId,
      relationship: p.relationship,
      shareOfRent: p.shareOfRent != null ? String(p.shareOfRent) : null,
    })),
  }
}

export default function EditLeasePage() {
  const router = useRouter()
  const params = useParams<{ leaseId: string }>()
  const leaseId = params.leaseId
  const { hasUiPermission } = useUiPermission()

  const [lease, setLease] = useState<LeaseForEdit | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/leases/${leaseId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Lease not found')
        const l = data.lease as {
          units: { unit: { id: string }; monthlyRent: string; depositAmount: string | null }[]
          parties: { tenant: { id: string }; relationship: string; shareOfRent: string | null }[]
        } & Omit<LeaseForEdit, 'units' | 'parties'>
        return {
          ...l,
          units: l.units.map((u) => ({ unitId: u.unit.id, monthlyRent: u.monthlyRent, depositAmount: u.depositAmount })),
          parties: l.parties.map((p) => ({ tenantId: p.tenant.id, relationship: p.relationship, shareOfRent: p.shareOfRent })),
        } as LeaseForEdit
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

  if (!hasUiPermission('lease.update')) {
    return (
      <ScopeDenied
        title="Cannot edit leases"
        message="You need the lease.update permission."
        backHref="/leasing/leases"
        backLabel="Back to leases"
      />
    )
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

  if (['CLOSED', 'CANCELLED', 'TERMINATED'].includes(lease.status)) {
    return (
      <ScopeDenied
        title={`A ${lease.status.toLowerCase()} lease cannot be amended`}
        message="Closed, cancelled or terminated leases are read-only."
        backHref={`/leasing/leases/${lease.id}`}
        backLabel="Back to lease"
      />
    )
  }

  const handleSubmit = async (values: LeaseFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/leases/${lease.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save lease')
        setSaving(false)
        return
      }
      toast.success('Lease updated')
      router.push(`/leasing/leases/${lease.id}`)
    } catch {
      toast.error('Network error — lease not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/leasing/leases/${lease.id}`)}>
          ← Lease
        </Button>
      </div>
      <PageHeader title="Edit lease" description="Amend term, units, parties or billing." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <LeaseFormPanel
          mode="edit"
          initialPropertyId={lease.propertyId}
          initialValues={toInitialValues(lease)}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/leasing/leases/${lease.id}`)}
        />
      </div>
    </div>
  )
}
