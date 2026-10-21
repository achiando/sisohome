'use client'

/** /maintenance/tickets/new — report an issue via shared form. */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { TicketFormValues } from '../../_components/ticket-form'
import { TicketFormPanel } from '../../_components/ticket-form-panel'

export default function NewTicketPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [saving, setSaving] = useState(false)

  if (!hasUiPermission('maintenance.create')) {
    return (
      <ScopeDenied
        title="Cannot report issues"
        message="You need the maintenance.create permission."
        backHref="/maintenance"
        backLabel="Back to maintenance"
      />
    )
  }

  const handleSubmit = async (values: TicketFormValues) => {
    setSaving(true)
    try {
      const res = await fetch('/api/maintenance/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create ticket')
        setSaving(false)
        return
      }
      toast.success('Ticket reported')
      router.push(`/maintenance/tickets/${data.ticket.id}`)
    } catch {
      toast.error('Network error — ticket not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/maintenance')}>
          ← Maintenance
        </Button>
      </div>
      <PageHeader title="Report an issue" description="Log a maintenance issue against a property or unit." />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <TicketFormPanel
          mode="create"
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/maintenance')}
        />
      </div>
    </div>
  )
}
