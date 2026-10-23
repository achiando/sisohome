'use client'

/**
 * /leasing — leasing dashboard (plan-slice-2 §3.5): lease register +
 * application queue summary with quick actions. UX gate: lease.list.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, FileSignature, UserPlus } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { APPLICATION_STATUSES } from '@/lib/domain/application-constants'
import { LeaseStatusBadge } from './_components/lease-status'

type LeaseRow = {
  id: string
  leaseRef: string | null
  status: string
  startsAt: string
  endsAt: string | null
  property: { id: string; name: string }
  units: { unit: { unitRef: string; label: string | null } }[]
  parties: { relationship: string; tenant: { displayName: string } }[]
}

type ApplicationRow = {
  id: string
  status: string
  submittedAt: string
  property: { id: string; name: string }
  applicant: { displayName: string }
  unit: { unitRef: string; label: string | null } | null
}

function StatTile({
  label,
  value,
  hint,
  onClick,
}: {
  label: string
  value: number
  hint?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border bg-card p-4 text-left shadow-xs transition-shadow hover:shadow-sm disabled:cursor-default"
      disabled={!onClick}
    >
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </button>
  )
}

export default function LeasingDashboardPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [leases, setLeases] = useState<LeaseRow[]>([])
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  // Fixed once per mount so the 60-day window doesn't shift on re-render.
  const [inSixtyDays] = useState(() => Date.now() + 60 * 86_400_000)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/leases', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => (d.leases ?? []) as LeaseRow[]),
      fetch('/api/applications', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => (d.applications ?? []) as ApplicationRow[]),
    ])
      .then(([ls, apps]) => {
        if (cancelled) return
        setLeases(ls)
        setApplications(apps)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load leasing summary')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const derived = useMemo(() => {
    const live = leases.filter((l) => l.status === 'ACTIVE' || l.status === 'SCHEDULED')
    const pendingApprovals = leases.filter((l) => l.status === 'PENDING_APPROVAL')
    const openApps = applications.filter(
      (a) => a.status === 'SUBMITTED' || a.status === 'SCREENING',
    )
    const expiring = live.filter((l) => l.endsAt && new Date(l.endsAt).getTime() <= inSixtyDays)
    const activeTenantNames = new Set<string>()
    for (const l of live) {
      for (const p of l.parties) {
        if (p.relationship === 'PRIMARY' || p.relationship === 'JOINT') {
          activeTenantNames.add(p.tenant.displayName)
        }
      }
    }
    return { live, pendingApprovals, openApps, expiring, tenantCount: activeTenantNames.size }
  }, [leases, applications, inSixtyDays])

  if (!hasUiPermission('lease.list')) {
    return <ScopeDenied message="You need the lease.list permission to view leasing. Ask an owner or admin of your organization." />
  }

  if (loading) return <PageLoader title="Loading leasing…" />

  const primaryTenant = (l: LeaseRow) =>
    (l.parties.find((p) => p.relationship === 'PRIMARY') ?? l.parties[0])?.tenant.displayName ?? '—'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leasing"
        description="Lease register and application queue at a glance."
        actions={
          <>
            {hasUiPermission('application.create') ? (
              <Button variant="outline" onClick={() => router.push('/leasing/applications/new')}>
                Capture application
              </Button>
            ) : null}
            {hasUiPermission('lease.create') ? (
              <Button variant="primary" onClick={() => router.push('/leasing/leases/new')}>
                New lease
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Live leases"
          value={derived.live.length}
          hint="Active or scheduled"
          onClick={() => router.push('/leasing/leases')}
        />
        <StatTile
          label="Pending approvals"
          value={derived.pendingApprovals.length}
          hint="Awaiting sign-off"
          onClick={derived.pendingApprovals.length > 0 ? () => router.push('/leasing/leases') : undefined}
        />
        <StatTile
          label="Open applications"
          value={derived.openApps.length}
          hint="Submitted or screening"
          onClick={() => router.push('/leasing/applications')}
        />
        <StatTile
          label="Tenants on lease"
          value={derived.tenantCount}
          hint="Primary + joint parties"
          onClick={() => router.push('/people/tenants')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pending approvals</h2>
            <Button variant="text" size="sm" onClick={() => router.push('/leasing/leases')}>
              All leases
            </Button>
          </div>
          {derived.pendingApprovals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting for approval.</p>
          ) : (
            <ul className="space-y-3">
              {derived.pendingApprovals.slice(0, 6).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3">
                  <button
                    className="min-w-0 text-left"
                    onClick={() => router.push(`/leasing/leases/${l.id}`)}
                  >
                    <p className="truncate text-sm font-medium">
                      {l.leaseRef ?? `Lease ${l.id.slice(0, 8)}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.property.name} · {primaryTenant(l)}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <LeaseStatusBadge status={l.status} />
                    <Button variant="outline" size="sm" onClick={() => router.push(`/leasing/leases/${l.id}`)}>
                      Review
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Expiring within 60 days</h2>
            <Badge variant="neutral" size="sm">{derived.expiring.length}</Badge>
          </div>
          {derived.expiring.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live leases end in the next 60 days.</p>
          ) : (
            <ul className="space-y-3">
              {derived.expiring.slice(0, 6).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3">
                  <button
                    className="min-w-0 text-left"
                    onClick={() => router.push(`/leasing/leases/${l.id}`)}
                  >
                    <p className="truncate text-sm font-medium">
                      {l.leaseRef ?? `Lease ${l.id.slice(0, 8)}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.property.name} · ends {l.endsAt ? formatDate(l.endsAt) : '—'}
                    </p>
                  </button>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/leasing/leases/${l.id}`)}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Open application queue</h2>
            <Button variant="text" size="sm" onClick={() => router.push('/leasing/applications')}>
              All applications
            </Button>
          </div>
          {derived.openApps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open applications.{' '}
              {hasUiPermission('application.create') ? (
                <button
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => router.push('/leasing/applications/new')}
                >
                  Capture one
                </button>
              ) : null}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {derived.openApps.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <button
                    className="min-w-0 text-left"
                    onClick={() => router.push(`/leasing/applications/${a.id}`)}
                  >
                    <p className="truncate text-sm font-medium">{a.applicant.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.property.name}
                      {a.unit ? ` · ${a.unit.label ?? a.unit.unitRef}` : ''} · {formatDate(a.submittedAt)}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="neutral" size="sm" className="bg-blue-500/15 text-blue-700 dark:text-blue-300">
                      {APPLICATION_STATUSES.find((s) => s.value === a.status)?.label ?? a.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/leasing/applications/${a.id}`)}
                    >
                      Review
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        {hasUiPermission('lease.create') ? (
          <Button variant="outline" onClick={() => router.push('/leasing/leases/new')}>
            <FileSignature size={16} aria-hidden /> New lease
          </Button>
        ) : null}
        {hasUiPermission('application.create') ? (
          <Button variant="outline" onClick={() => router.push('/leasing/applications/new')}>
            <ClipboardList size={16} aria-hidden /> Capture application
          </Button>
        ) : null}
        {hasUiPermission('tenant.create') ? (
          <Button variant="outline" onClick={() => router.push('/people/tenants/new')}>
            <UserPlus size={16} aria-hidden /> Add tenant
          </Button>
        ) : null}
      </div>
    </div>
  )
}
