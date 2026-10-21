'use client'

/** /maintenance/tickets/[ticketId]/edit — edit a live ticket. */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import type { TicketFormValues } from '../../../_components/ticket-form'
import { TicketFormPanel } from '../../../_components/ticket-form-panel'

type TicketDetail = {
  id: string
  status: string
  propertyId: string
  unitId: string | null
  title: string
  description: string | null
  category: string
  priority: string
}

export default function EditTicketPage() {
  const router = useRouter()
  const params = useParams<{ ticketId: string }>()
  const ticketId = params.ticketId
  const { hasUiPermission } = useUiPermission()

  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/maintenance/tickets/${ticketId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Ticket not found')
        return data.ticket as TicketDetail
      })
      .then((t) => {
        if (!cancelled) setTicket(t)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Ticket not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ticketId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('maintenance.update')) {
    return (
      <ScopeDenied
        title="Cannot edit tickets"
        message="You need the maintenance.update permission."
        backHref="/maintenance"
        backLabel="Back to maintenance"
      />
    )
  }

  if (loading) return <PageLoader title="Loading ticket…" />
  if (!ticket) {
    return (
      <ScopeDenied
        message="This ticket doesn't exist for your organization."
        backHref="/maintenance"
        backLabel="Back to maintenance"
      />
    )
  }

  const handleSubmit = async (values: TicketFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save ticket')
        setSaving(false)
        return
      }
      toast.success('Ticket updated')
      router.push(`/maintenance/tickets/${ticketId}`)
    } catch {
      toast.error('Network error — changes not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push(`/maintenance/tickets/${ticketId}`)}>
          ← Ticket
        </Button>
      </div>
      <PageHeader title="Edit ticket" description={ticket.title} />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <TicketFormPanel
          mode="edit"
          initialValues={ticket}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/maintenance/tickets/${ticketId}`)}
        />
      </div>
    </div>
  )
}
