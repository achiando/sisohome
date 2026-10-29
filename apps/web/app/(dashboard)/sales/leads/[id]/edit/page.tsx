'use client'

/** /sales/leads/[id]/edit — edit a hunter record. */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { LeadForm, type LeadFormValues } from '../../../_components/lead-form'

export default function EditLeadPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { hasUiPermission } = useUiPermission()
  const [lead, setLead] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/leads/${id}`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? 'Lead not found')
        return body.lead as Record<string, unknown>
      })
      .then((l) => {
        if (!cancelled) setLead(l)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Lead not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => load(), [load])

  const handleSubmit = async (values: LeadFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? 'Failed to save the lead')
        setSaving(false)
        return
      }
      toast.success('Lead saved')
      router.push(`/sales/leads/${id}`)
    } catch {
      toast.error('Network error — lead not saved')
      setSaving(false)
    }
  }

  if (!hasUiPermission('lead.update')) {
    return (
      <ScopeDenied
        message="You need the lead.update permission to edit leads. Ask an owner or admin of your organization."
        backHref="/sales/leads"
        backLabel="Back to leads"
      />
    )
  }
  if (loading) return <PageLoader title="Loading lead…" />
  if (!lead) {
    return (
      <ScopeDenied
        message="This lead doesn't exist for your organization."
        backHref="/sales/leads"
        backLabel="Back to leads"
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/sales/leads/${id}`)}>
          ← Lead
        </Button>
      </div>
      <PageHeader title="Edit lead" description={String(lead.displayName ?? '')} />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <LeadForm
          mode="edit"
          initialValues={lead}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/sales/leads/${id}`)}
        />
      </div>
    </div>
  )
}
