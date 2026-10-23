'use client'

/** /people/landlords/new — create owner party via shared OwnerPartyForm. */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { OwnerPartyForm, type OwnerPartyFormValues } from '@/app/(dashboard)/portfolio/_components/owner-party-form'

export default function NewOwnerPartyPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  if (!hasUiPermission('ownership.create')) {
    return (
      <ScopeDenied
        title="Cannot add owner parties"
        message="You need the ownership.create permission. Ask an owner or admin of your organization."
        backHref="/people/landlords"
        backLabel="Back to owners"
      />
    )
  }

  const handleSubmit = async (values: OwnerPartyFormValues) => {
    setSaving(true)
    setServerErrors({})
    try {
      const res = await fetch('/api/owner-parties', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create owner party')
        setSaving(false)
        return
      }
      toast.success('Owner party created')
      router.push('/people/landlords')
    } catch {
      toast.error('Network error — owner party not created')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/people/landlords')}>
          ← Owners
        </Button>
      </div>
      <PageHeader
        title="Add owner party"
        description="A person, company or association your organization records ownership for."
      />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <OwnerPartyForm
          mode="create"
          saving={saving}
          serverErrors={serverErrors}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/people/landlords')}
        />
      </div>
    </div>
  )
}
