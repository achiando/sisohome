'use client'

/** /people/tenants/new — capture a tenant via shared wizard. */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { TenantForm, type TenantFormValues } from '@/app/(dashboard)/leasing/_components/tenant-form'

export default function NewTenantPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)

  if (!hasUiPermission('tenant.create')) {
    return (
      <ScopeDenied
        title="Cannot create tenants"
        message="You need the tenant.create permission. Ask an owner or admin of your organization."
        backHref="/people/tenants"
        backLabel="Back to tenants"
      />
    )
  }

  const handleSubmit = async (values: TenantFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create tenant')
        setSaving(false)
        return
      }
      toast.success('Tenant created')
      router.push(`/people/tenants/${data.tenant.id}`)
    } catch {
      toast.error('Network error — tenant not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/people/tenants')}>
          ← Tenants
        </Button>
      </div>
      <PageHeader title="Add tenant" description="Capture a tenant party record." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <TenantForm mode="create" saving={saving} onSubmit={handleSubmit} onCancel={() => router.push('/people/tenants')} />
      </div>
    </div>
  )
}
