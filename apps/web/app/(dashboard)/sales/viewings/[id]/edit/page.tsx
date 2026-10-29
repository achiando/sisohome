'use client'

/** /sales/viewings/[id]/edit — reschedule or record the outcome. */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { ViewingForm, type ViewingFormValues } from '../../../_components/viewing-form'

export default function EditViewingPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { hasUiPermission } = useUiPermission()
  const [viewing, setViewing] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/viewings/${id}`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? 'Viewing not found')
        return body.viewing as Record<string, unknown>
      })
      .then((v) => {
        if (!cancelled) setViewing(v)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Viewing not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => load(), [load])

  const handleSubmit = async (values: ViewingFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/viewings/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? 'Failed to save the viewing')
        setSaving(false)
        return
      }
      toast.success('Viewing saved')
      router.push('/sales/viewings')
    } catch {
      toast.error('Network error — viewing not saved')
      setSaving(false)
    }
  }

  if (!hasUiPermission('viewing.update')) {
    return (
      <ScopeDenied
        message="You need the viewing.update permission to edit viewings. Ask an owner or admin of your organization."
        backHref="/sales/viewings"
        backLabel="Back to viewings"
      />
    )
  }
  if (loading) return <PageLoader title="Loading viewing…" />
  if (!viewing) {
    return (
      <ScopeDenied
        message="This viewing doesn't exist for your organization."
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
      <PageHeader title="Edit viewing" description="Reschedule or record the outcome." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <ViewingForm
          mode="edit"
          initialValues={viewing}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/sales/viewings')}
        />
      </div>
    </div>
  )
}
