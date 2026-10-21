'use client'

/**
 * /portfolio/owners/agreements/new — propose a management agreement
 * (plan-slice-1 §2.2). Supports `?propertyId=` preset. Pickers:
 * properties = what GET /api/properties returned (403 → empty + manual ID);
 * managers = GET /api/organizations (managing kinds, minus own);
 * parties = GET /api/owner-parties?propertyId= (portfolio org's directory
 * once a property is chosen — cross-org read gated by property scope).
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SelectOption } from '@workspace/ui/types/components'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { AgreementForm, toAgreementPayload, type AgreementFormValues } from '../../../_components/agreement-form'

type PropertyOption = { id: string; name: string; code?: string | null }
type OrgOption = { id: string; name: string }
type PartyOption = { id: string; name: string }

export default function NewAgreementPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasUiPermission } = useUiPermission()

  const presetPropertyId = searchParams.get('propertyId') ?? ''
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [managers, setManagers] = useState<OrgOption[]>([])
  const [selectedProperty, setSelectedProperty] = useState(presetPropertyId)
  const [parties, setParties] = useState<PartyOption[]>([])
  const seed: AgreementFormValues | null = presetPropertyId ? { propertyId: presetPropertyId } : null
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/properties', { credentials: 'include' }).then((r) => r.json().catch(() => ({}))),
      fetch('/api/organizations', { credentials: 'include' }).then((r) => r.json().catch(() => ({}))),
    ])
      .then(([pRes, oRes]) => {
        if (cancelled) return
        setProperties(((pRes.properties ?? []) as PropertyOption[]) ?? [])
        setManagers((oRes.organizations ?? []) as OrgOption[])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load form data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Party picker follows the selected property (portfolio org's directory).
  useEffect(() => {
    let cancelled = false
    const url = selectedProperty
      ? `/api/owner-parties?propertyId=${encodeURIComponent(selectedProperty)}`
      : '/api/owner-parties'
    fetch(url, { credentials: 'include' })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (!cancelled) setParties((data.parties ?? []) as PartyOption[])
      })
      .catch(() => {
        if (!cancelled) setParties([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedProperty])

  const propertyOptions: SelectOption[] = properties.map((p) => ({
    value: p.id,
    label: [p.name, p.code].filter(Boolean).join(' — '),
  }))
  const managerOptions: SelectOption[] = managers.map((o) => ({ value: o.id, label: o.name }))
  const partyOptions: SelectOption[] = parties.map((p) => ({ value: p.id, label: p.name }))

  if (!hasUiPermission('agreement.create')) {
    return (
      <ScopeDenied
        title="Cannot propose agreements"
        message="You need the agreement.create permission. Ask an owner or admin of your organization."
        backHref="/portfolio/owners/agreements"
        backLabel="Back to agreements"
      />
    )
  }

  const handleSubmit = async (values: AgreementFormValues) => {
    setSaving(true)
    try {
      const payload = toAgreementPayload(values, false)
      const res = await fetch('/api/agreements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create agreement')
        setSaving(false)
        return
      }
      toast.success('Agreement proposed — awaiting owner approval')
      router.push('/portfolio/owners/agreements')
    } catch {
      toast.error('Network error — agreement not created')
      setSaving(false)
    }
  }

  if (loading) return <PageLoader title="Loading…" />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/portfolio/owners/agreements')}>
          ← Agreements
        </Button>
      </div>
      <PageHeader
        title="New management agreement"
        description="Draft a contract between the property's owner and a managing organization."
      />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <AgreementForm
          mode="create"
          propertyOptions={propertyOptions}
          managerOptions={managerOptions}
          partyOptions={partyOptions}
          initialValues={seed}
          saving={saving}
          onPropertyChange={(id) => setSelectedProperty(id)}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/portfolio/owners/agreements')}
        />
      </div>
      {properties.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          No properties listed for your organization — paste the property ID in the form to propose
          cross-org management.
        </p>
      ) : null}
    </div>
  )
}
