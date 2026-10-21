'use client'

/** /leasing/applications/[applicationId]/edit — pre-decision edits only. */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { ApplicationFormValues } from '../../../_components/application-form'
import { ApplicationFormPanel } from '../../../_components/application-form-panel'

type ApplicationDetail = {
  id: string
  status: string
  decidedAt: string | null
  internalNotes: string | null
  property: { id: string; name: string }
  unit: { id: string; unitRef: string; label: string | null } | null
  applicant: { id: string; displayName: string }
}

export default function EditApplicationPage() {
  const router = useRouter()
  const params = useParams<{ applicationId: string }>()
  const applicationId = params.applicationId
  const { hasUiPermission } = useUiPermission()

  const [app, setApp] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/applications/${applicationId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Application not found')
        return data.application as ApplicationDetail
      })
      .then((a) => {
        if (!cancelled) setApp(a)
      })
      .catch(() => {
        if (!cancelled) toast.error('Application not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applicationId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('application.update')) {
    return (
      <ScopeDenied
        title="Cannot edit applications"
        message="You need the application.update permission."
        backHref="/leasing/applications"
        backLabel="Back to applications"
      />
    )
  }

  if (loading) return <PageLoader title="Loading application…" />
  if (!app) {
    return (
      <ScopeDenied
        message="This application doesn't exist for your organization."
        backHref="/leasing/applications"
        backLabel="Back to applications"
      />
    )
  }
  if (app.decidedAt) {
    return (
      <ScopeDenied
        title="Decision already recorded"
        message="Applications cannot be edited after a decision."
        backHref={`/leasing/applications/${applicationId}`}
        backLabel="Back to application"
      />
    )
  }

  const handleSubmit = async (values: ApplicationFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalNotes: values.internalNotes ?? '' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save application')
        setSaving(false)
        return
      }
      toast.success('Application updated')
      router.push(`/leasing/applications/${applicationId}`)
    } catch {
      toast.error('Network error — application not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/leasing/applications/${applicationId}`)}>
          ← {app.applicant.displayName}
        </Button>
      </div>
      <PageHeader title="Edit application" description={`${app.applicant.displayName} · ${app.property.name}`} />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <ApplicationFormPanel
          mode="edit"
          initialValues={{
            propertyId: app.property.id,
            unitId: app.unit?.id ?? '',
            applicantTenantId: app.applicant.id,
            internalNotes: app.internalNotes,
          }}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/leasing/applications/${applicationId}`)}
        />
      </div>
    </div>
  )
}
