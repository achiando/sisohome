'use client'

/** /sales/viewings/new — book an appointment (plan-slice-5 §3). */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { ViewingForm, type ViewingFormValues } from '../../_components/viewing-form'

export default function NewViewingPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (values: ViewingFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/viewings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to book the viewing')
        setSaving(false)
        return
      }
      toast.success('Viewing booked')
      router.push('/sales/viewings')
    } catch {
      toast.error('Network error — viewing not booked')
      setSaving(false)
    }
  }

  if (!hasUiPermission('viewing.create')) {
    return (
      <ScopeDenied
        message="You need the viewing.create permission to book viewings. Ask an owner or admin of your organization."
        backHref="/sales/viewings"
        backLabel="Back to viewings"
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/sales/viewings')}>
          ← Viewings
        </Button>
      </div>
      <PageHeader title="Book viewing" description="Schedule an appointment against a property and hunter." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <ViewingForm mode="create" saving={saving} onSubmit={handleSubmit} onCancel={() => router.push('/sales/viewings')} />
      </div>
    </div>
  )
}
