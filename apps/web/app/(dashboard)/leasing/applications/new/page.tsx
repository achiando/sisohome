'use client'

/** /leasing/applications/new — capture an application via shared form. */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { ApplicationFormValues } from '../../_components/application-form'
import { ApplicationFormPanel } from '../../_components/application-form-panel'

export default function NewApplicationPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)

  if (!hasUiPermission('application.create')) {
    return (
      <ScopeDenied
        title="Cannot capture applications"
        message="You need the application.create permission."
        backHref="/leasing/applications"
        backLabel="Back to applications"
      />
    )
  }

  const handleSubmit = async (values: ApplicationFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create application')
        setSaving(false)
        return
      }
      toast.success('Application captured')
      router.push(`/leasing/applications/${data.application.id}`)
    } catch {
      toast.error('Network error — application not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/leasing/applications')}>
          ← Applications
        </Button>
      </div>
      <PageHeader title="Capture application" description="Record an applicant against a property." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <ApplicationFormPanel
          mode="create"
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/leasing/applications')}
        />
      </div>
    </div>
  )
}
