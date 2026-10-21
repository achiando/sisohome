'use client'

/**
 * /leasing/leases/new — capture a lease via the shared wizard. Supports
 * `?applicationId=` to prefill property, unit and the applicant tenant
 * (plan-slice-2 §3), and `?propertyId=&unitId=` to jump in from a vacant
 * unit row ("Add tenant" on the units registers).
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { LeaseFormValues, LeaseInitialValues } from '../../_components/lease-form'
import { LeaseFormPanel } from '../../_components/lease-form-panel'

type ApplicationSeed = {
  propertyId: string
  unitId: string | null
  applicantTenantId: string
}

export default function NewLeasePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasUiPermission } = useUiPermission()
  const applicationId = searchParams.get('applicationId') ?? ''
  const unitIdParam = searchParams.get('unitId') ?? ''
  const propertyIdParam = searchParams.get('propertyId') ?? ''

  const [saving, setSaving] = useState(false)
  const [appSeed, setAppSeed] = useState<ApplicationSeed | null>(null)
  const [unitSeed, setUnitSeed] = useState<{ propertyId: string; unitId: string } | null>(null)
  const [loadingSeed, setLoadingSeed] = useState(Boolean(applicationId || unitIdParam))

  useEffect(() => {
    if (applicationId) {
      let cancelled = false
      fetch(`/api/applications/${applicationId}`, { credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load application')
          const data = await res.json()
          return data.application as {
            property: { id: string }
            unit: { id: string } | null
            applicant: { id: string }
          }
        })
        .then((app) => {
          if (cancelled) return
          setAppSeed({
            propertyId: app.property.id,
            unitId: app.unit?.id ?? null,
            applicantTenantId: app.applicant.id,
          })
        })
        .catch((err: unknown) => {
          if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load application')
        })
        .finally(() => {
          if (!cancelled) setLoadingSeed(false)
        })
      return () => {
        cancelled = true
      }
    }

    if (!unitIdParam) return
    // Vacant-unit jump: propertyId may come from the URL; otherwise resolve
    // it from the unit record (unit.read via the same session).
    let cancelled = false
    if (propertyIdParam) {
      setUnitSeed({ propertyId: propertyIdParam, unitId: unitIdParam })
      setLoadingSeed(false)
      return
    }
    fetch(`/api/units/${unitIdParam}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load unit')
        const data = await res.json()
        return data.unit as { propertyId: string }
      })
      .then((unit) => {
        if (!cancelled) setUnitSeed({ propertyId: unit.propertyId, unitId: unitIdParam })
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load unit')
      })
      .finally(() => {
        if (!cancelled) setLoadingSeed(false)
      })
    return () => {
      cancelled = true
    }
  }, [applicationId, unitIdParam, propertyIdParam])

  if (!hasUiPermission('lease.create')) {
    return (
      <ScopeDenied
        title="Cannot create leases"
        message="You need the lease.create permission."
        backHref="/leasing/leases"
        backLabel="Back to leases"
      />
    )
  }

  const seedPropertyId = appSeed?.propertyId ?? unitSeed?.propertyId
  const initialValues: LeaseInitialValues | null = appSeed
    ? {
        propertyId: appSeed.propertyId,
        units: appSeed.unitId
          ? [{ unitId: appSeed.unitId, monthlyRent: '', depositAmount: null }]
          : undefined,
        parties: appSeed.applicantTenantId
          ? [{ tenantId: appSeed.applicantTenantId, relationship: 'PRIMARY', shareOfRent: null }]
          : undefined,
      }
    : unitSeed
      ? {
          propertyId: unitSeed.propertyId,
          units: [{ unitId: unitSeed.unitId, monthlyRent: '', depositAmount: null }],
        }
      : null

  const handleSubmit = async (values: LeaseFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/leases', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create lease')
        setSaving(false)
        return
      }
      toast.success('Lease created as draft')
      router.push(`/leasing/leases/${data.lease.id}`)
    } catch {
      toast.error('Network error — lease not saved')
      setSaving(false)
    }
  }

  if (loadingSeed) return <PageLoader title={applicationId ? 'Loading application…' : 'Loading unit…'} />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/leasing/leases')}>
          ← Leases
        </Button>
      </div>
      <PageHeader
        title={appSeed ? 'New lease from application' : unitSeed ? 'New lease from unit' : 'New lease'}
        description={
          appSeed
            ? 'Property, unit and applicant prefilled from the approved application — add rent and terms.'
            : unitSeed
              ? 'Property and unit prefilled — add tenants, rent and terms.'
              : 'Capture a tenancy agreement — units, tenants and billing terms.'
        }
      />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <LeaseFormPanel
          mode="create"
          initialPropertyId={seedPropertyId}
          initialValues={initialValues}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/leasing/leases')}
        />
      </div>
    </div>
  )
}
