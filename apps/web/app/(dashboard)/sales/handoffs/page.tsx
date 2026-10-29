'use client'

/**
 * /sales/handoffs — cross-org lead handoffs (plan-slice-5 §3): send an
 * offered handoff to another org, accept/decline received ones.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { labelize } from '../_components/status-badge'

interface HandoffRow {
  id: string
  status: string
  message: string | null
  createdAt: string
  fromOrganization: { id: string; name: string } | null
  toOrganization: { id: string; name: string } | null
  lead: { id: string; displayName: string }
  listing: { id: string; title: string } | null
}

function statusVariant(status: string): 'success' | 'neutral' | 'info' | 'error' {
  if (status === 'ACCEPTED') return 'success'
  if (status === 'DECLINED') return 'neutral'
  if (status === 'REVOKED') return 'error'
  return 'info'
}

export default function HandoffsPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [handoffs, setHandoffs] = useState<HandoffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    fetch('/api/handoffs', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load handoffs')
        const data = await res.json()
        return (data.handoffs ?? []) as HandoffRow[]
      })
      .then((list) => {
        if (!cancelled) setHandoffs(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load handoffs')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load])

  const respond = async (id: string, to: 'ACCEPTED' | 'DECLINED') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/handoffs/${id}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Response failed')
      toast.success(to === 'ACCEPTED' ? 'Handoff accepted — the lead is now readable' : 'Handoff declined')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Response failed')
    } finally {
      setBusyId(null)
    }
  }

  if (!hasUiPermission('lead.list')) {
    return (
      <ScopeDenied message="You need the lead.list permission to view handoffs. Ask an owner or admin of your organization." />
    )
  }
  if (loading) return <PageLoader title="Loading handoffs…" />

  const receivedOffered = handoffs.filter((h) => h.status === 'OFFERED')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Handoffs"
        description="Lead referrals between organizations. Accepting one grants your org read access to the lead."
        actions={
          <Button variant="text" size="sm" onClick={() => router.push('/sales/leads')}>
            ← Leads
          </Button>
        }
      />

      {receivedOffered.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {receivedOffered.length} handoff{receivedOffered.length === 1 ? '' : 's'} waiting on you
          </p>
        </div>
      ) : null}

      {handoffs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-xs">
          <ArrowLeftRight className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No handoffs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hand off a lead from its detail page to refer a hunter to a partner agency.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {handoffs.map((h) => (
            <div
              key={h.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {h.fromOrganization?.name ?? '—'} → {h.toOrganization?.name ?? '—'}
                </p>
                <button
                  type="button"
                  onClick={() => router.push(`/sales/leads/${h.lead.id}`)}
                  className="truncate text-sm text-primary hover:underline"
                >
                  {h.lead.displayName}
                  {h.listing ? ` · ${h.listing.title}` : ''}
                </button>
                {h.message ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{h.message}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(h.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={statusVariant(h.status)} size="sm">
                  {labelize(h.status)}
                </Badge>
                {h.status === 'OFFERED' ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === h.id}
                      onClick={() => respond(h.id, 'DECLINED')}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busyId === h.id}
                      loading={busyId === h.id}
                      onClick={() => respond(h.id, 'ACCEPTED')}
                    >
                      Accept
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
