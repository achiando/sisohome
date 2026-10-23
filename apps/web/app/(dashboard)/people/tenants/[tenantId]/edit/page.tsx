'use client'

/** /people/tenants/[tenantId]/edit — edit tenant via shared wizard. */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Tenant } from '@workspace/database'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { TenantForm, type TenantFormValues } from '@/app/(dashboard)/leasing/_components/tenant-form'

export default function EditTenantPage() {
  const router = useRouter()
  const params = useParams<{ tenantId: string }>()
  const tenantId = params.tenantId
  const { hasUiPermission } = useUiPermission()

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/tenants/${tenantId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Tenant not found')
        return data.tenant as Tenant
      })
      .then((t) => {
        if (!cancelled) setTenant(t)
      })
      .catch(() => {
        if (!cancelled) toast.error('Tenant not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('tenant.update')) {
    return (
      <ScopeDenied
        title="Cannot edit tenants"
        message="You need the tenant.update permission. Ask an owner or admin of your organization."
        backHref="/people/tenants"
        backLabel="Back to tenants"
      />
    )
  }

  if (loading) return <PageLoader title="Loading tenant…" />
  if (!tenant) {
    return (
      <ScopeDenied
        message="This tenant doesn't exist for your organization."
        backHref="/people/tenants"
        backLabel="Back to tenants"
      />
    )
  }

  const handleSubmit = async (values: TenantFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save tenant')
        setSaving(false)
        return
      }
      toast.success('Tenant updated')
      router.push(`/people/tenants/${tenantId}`)
    } catch {
      toast.error('Network error — tenant not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/people/tenants/${tenantId}`)}>
          ← {tenant.displayName}
        </Button>
      </div>
      <PageHeader title="Edit tenant" description={tenant.displayName} />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <TenantForm
          mode="edit"
          initialValues={tenant}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/people/tenants/${tenantId}`)}
        />
      </div>
    </div>
  )
}
