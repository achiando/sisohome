'use client'

/**
 * Portal home (plan-slice-7 §3): greeting, active lease snapshot, balance
 * due, quick actions and the latest document. Client fetch via the shared
 * hook — the API re-authorizes per request, so this is UX only.
 */

import Link from 'next/link'
import { ArrowUpRight, FilePlus2, FileText, Receipt, Wrench } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'

import { formatDate, formatMoney } from '@/app/(dashboard)/_components/domain/format'
import { LeaseStatusBadge } from '@/app/(dashboard)/leasing/_components/lease-status'

import {
  usePortalApi,
  usePortalSession,
  type PortalDocument,
  type PortalLease,
  type PortalStatement,
} from '../_components/portal-data'

interface LeaseRes {
  success: boolean
  leases: PortalLease[]
}
interface StatementRes extends PortalStatement {
  success: boolean
}
interface DocsRes {
  success: boolean
  documents: PortalDocument[]
}

export default function PortalHomePage() {
  const session = usePortalSession()
  const leases = usePortalApi<LeaseRes>('/api/portal/lease')
  const statement = usePortalApi<StatementRes>('/api/portal/statement')
  const documents = usePortalApi<DocsRes>('/api/portal/documents')

  if (leases.loading || statement.loading || documents.loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PageLoader title="Loading your home..." />
      </div>
    )
  }

  const allLeases = leases.data?.leases ?? []
  const active =
    allLeases.find((l) => l.status === 'ACTIVE') ?? (allLeases[0] && allLeases[0].status !== 'ENDED' ? allLeases[0] : null)
  const currency = active?.currency ?? 'KES'
  const totals = statement.data?.totals
  const balance = totals ? Number(totals.balance) : 0
  const outstandingCharges = (statement.data?.charges ?? []).filter(
    (c) => Number(c.outstanding) > 0.004,
  )
  const earliestDue = outstandingCharges
    .map((c) => c.dueDate)
    .sort()[0]
  const latestDoc = documents.data?.documents?.[0] ?? null

  const firstName = session?.profile.name?.split(' ')[0] || session?.profile.email || 'there'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Hi, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          Your tenancy at a glance — lease, balance, documents and requests.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="outlined" className="md:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Active lease</CardDescription>
              <CardTitle className="text-base">
                {active ? active.property.name : 'No lease yet'}
              </CardTitle>
            </div>
            {active ? <LeaseStatusBadge status={active.status} /> : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {!active ? (
              <p className="text-sm text-muted-foreground">
                No lease is linked to your account yet. Once your property team activates your
                tenancy, it will show up here.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Unit{active.units.length > 1 ? 's' : ''}</p>
                    <p className="font-medium text-foreground">
                      {active.units.map((u) => u.label).join(', ') || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Period</p>
                    <p className="font-medium text-foreground">
                      {formatDate(active.startsAt)} → {formatDate(active.endsAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rent</p>
                    <p className="font-medium text-foreground">
                      {active.units[0]
                        ? `${formatMoney(active.units[0].monthlyRent, active.units[0].currency)}/mo`
                        : '—'}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/portal/lease">
                    View lease <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader>
            <CardDescription>Balance due</CardDescription>
            <CardTitle
              className={`text-2xl tabular-nums ${balance > 0.004 ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400'}`}
            >
              {totals ? formatMoney(totals.balance, currency) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {balance > 0.004
                ? outstandingCharges.length === 1
                  ? `1 outstanding charge${earliestDue ? ` · due ${formatDate(earliestDue)}` : ''}`
                  : `${outstandingCharges.length} outstanding charges${earliestDue ? ` · earliest due ${formatDate(earliestDue)}` : ''}`
                : 'Nothing outstanding — you are all settled.'}
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/portal/statement">
                View statement <Receipt className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="outlined">
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>The things tenants do most.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="primary" size="sm" asChild>
              <Link href="/portal/tickets/new">
                <Wrench className="size-4" aria-hidden="true" /> Report an issue
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/portal/documents">
                <FileText className="size-4" aria-hidden="true" /> Documents
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/portal/payment">How to pay</Link>
            </Button>
          </CardContent>
        </Card>

        <Card variant="outlined" className="md:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Latest document</CardTitle>
              <CardDescription>Recent paperwork bound to you or your leases.</CardDescription>
            </div>
            <FilePlus2 className="size-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {!latestDoc ? (
              <p className="text-sm text-muted-foreground">
                Nothing here yet — documents uploaded for you will appear in this space.
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {latestDoc.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestDoc.kind.replace(/_/g, ' ').toLowerCase()} ·{' '}
                    {formatDate(latestDoc.createdAt)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/portal/documents" aria-label="Open documents">
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
