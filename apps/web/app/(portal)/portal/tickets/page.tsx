'use client'

/**
 * Maintenance tickets (plan-slice-7 §3): the tenant's own reported issues
 * (`reportedByTenantId` server-side) with the conversation thread behind
 * each card. Status is org-controlled — reports and notes only.
 */

import Link from 'next/link'
import { MessageSquare, Plus } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'

import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PriorityChip, StatusChip } from '@/app/(dashboard)/maintenance/_components/maintenance-status'

import { usePortalApi, type PortalTicket } from '../../_components/portal-data'

interface TicketsRes {
  success: boolean
  tickets: PortalTicket[]
}

export default function PortalTicketsPage() {
  const { data, error, loading } = usePortalApi<TicketsRes>('/api/portal/tickets')

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PageLoader title="Loading requests..." />
      </div>
    )
  }
  if (error) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    )
  }

  const tickets = data?.tickets ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Maintenance requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Report issues in your home and follow up with the property team.
          </p>
        </div>
        <Button variant="primary" size="sm" asChild>
          <Link href="/portal/tickets/new">
            <Plus className="size-4" aria-hidden="true" /> Report an issue
          </Link>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>No requests yet</CardTitle>
            <CardDescription>
              Something broken, leaking or flickering? Report it and track it here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="primary" asChild>
              <Link href="/portal/tickets/new">
                <Plus className="size-4" aria-hidden="true" /> Report an issue
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/portal/tickets/${ticket.id}`} className="block">
              <Card variant="outlined" className="transition-shadow hover:shadow-sm">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{ticket.title}</p>
                      <StatusChip status={ticket.status} />
                      <PriorityChip priority={ticket.priority} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ticket.property.name}
                      {ticket.unit ? ` · ${ticket.unit.label}` : ''} ·{' '}
                      {ticket.category.toLowerCase()} · reported {formatDate(ticket.reportedAt)}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="size-4" aria-hidden="true" />
                    {ticket.notes.length}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
