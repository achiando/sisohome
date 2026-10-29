'use client'

/** /sales/leads/new — capture a hunter (plan-slice-5 §3). */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { LeadForm, type LeadFormValues } from '../../_components/lead-form'

export default function NewLeadPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (values: LeadFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to capture the lead')
        setSaving(false)
        return
      }
      toast.success('Lead captured')
      router.push(`/sales/leads/${data.lead.id}`)
    } catch {
      toast.error('Network error — lead not saved')
      setSaving(false)
    }
  }

  if (!hasUiPermission('lead.create')) {
    return (
      <ScopeDenied
        message="You need the lead.create permission to capture leads. Ask an owner or admin of your organization."
        backHref="/sales/leads"
        backLabel="Back to leads"
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/sales/leads')}>
          ← Leads
        </Button>
      </div>
      <PageHeader title="Capture lead" description="Log a hunter enquiry against a listing or property." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <LeadForm mode="create" saving={saving} onSubmit={handleSubmit} onCancel={() => router.push('/sales/leads')} />
      </div>
    </div>
  )
}
