'use client'

/**
 * /leasing/tenants/[tenantId] — tenant profile (plan-slice-2 §3).
 * Tabs: Overview (contact + portal + invite), Leases, Applications,
 * Documents, Notes. PII lives behind tenant.read on the API; the UI gate
 * mirrors it with useUiPermission (UX only).
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Mail, Phone, User } from 'lucide-react'
import type { Tenant } from '@workspace/database'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { DetailTabs, type DetailTab } from '@/app/(dashboard)/_components/domain/detail-tabs'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PortalInviteDialog } from '../../_components/portal-invite-dialog'
import { TenantDocumentsTab } from '../../_components/tenant-documents-tab'
import { TenantPortalBadge, TenantStatusBadge } from '../../_components/tenant-status'

type LeasePartyRow = {
  id: string
  relationship: string
  lease: {
    id: string
    status: string
    startsAt: string
    endsAt: string | null
    property: { id: string; name: string }
    units: { unit: { id: string; unitRef: string; label: string | null } }[]
  }
}

type ApplicationRow = {
  id: string
  status: string
  submittedAt: string
  decidedAt: string | null
  incomeVerified: boolean
  property: { id: string; name: string }
  unit: { id: string; unitRef: string; label: string | null } | null
}

type TenantDetail = Tenant & {
  leases: LeasePartyRow[]
  rentalApplications: ApplicationRow[]
  portalInvites: { id: string; email: string; expiresAt: string; createdAt: string }[]
}

const APPLICATION_TONE: Record<string, string> = {
  SUBMITTED: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  SCREENING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  APPROVED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  CONDITIONAL: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  DENIED: 'bg-red-500/15 text-red-700 dark:text-red-300',
  WITHDRAWN: 'bg-muted text-muted-foreground',
}

export default function TenantProfilePage() {
  const router = useRouter()
  const params = useParams<{ tenantId: string }>()
  const tenantId = params.tenantId
  const { hasUiPermission } = useUiPermission()

  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/tenants/${tenantId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Tenant not found')
        return data.tenant as TenantDetail
      })
      .then((t) => {
        if (!cancelled) setTenant(t)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Tenant not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('tenant.read')) {
    return (
      <ScopeDenied message="You need the tenant.read permission to view tenant profiles. Ask an owner or admin of your organization." />
    )
  }

  if (loading) return <PageLoader title="Loading tenant…" />
  if (!tenant) {
    return (
      <ScopeDenied
        message="This tenant doesn't exist for your organization."
        backHref="/leasing/tenants"
        backLabel="Back to tenants"
      />
    )
  }

  const infoRow = (icon: ReactNode, label: string, value: string | null | undefined) =>
    value ? (
      <div className="flex items-center gap-3 text-sm">
        <span className="flex size-9 items-center justify-center rounded-xl bg-muted">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate font-medium">{value}</p>
        </div>
      </div>
    ) : null

  const overview: DetailTab = {
    id: 'overview',
    label: 'Overview',
    content: (
      <div className="space-y-6 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <TenantStatusBadge status={tenant.status} />
          <TenantPortalBadge status={tenant.portalStatus} />
          {tenant.tenantRef ? <Badge variant="neutral" size="sm">{tenant.tenantRef}</Badge> : null}
          {tenant.incomeVerified ? (
            <Badge variant="neutral" size="sm" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              Income verified
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {infoRow(<User className="size-4" aria-hidden />, 'Name', tenant.displayName)}
          {infoRow(<Phone className="size-4" aria-hidden />, 'Phone', tenant.phone)}
          {infoRow(<Mail className="size-4" aria-hidden />, 'Email', tenant.email)}
          {infoRow(<User className="size-4" aria-hidden />, 'Employer', [tenant.employer, tenant.jobTitle].filter(Boolean).join(' · '))}
          {infoRow(<User className="size-4" aria-hidden />, 'Guarantor', tenant.guarantorName)}
          {infoRow(<User className="size-4" aria-hidden />, 'ID', [tenant.idType?.replace(/_/g, ' ').toLowerCase(), tenant.idNumber].filter(Boolean).join(' · '))}
        </div>
        {tenant.portalInvites[0] ? (
          <p className="text-xs text-muted-foreground">
            Outstanding invite to {tenant.portalInvites[0].email} · expires {formatDate(tenant.portalInvites[0].expiresAt)}
          </p>
        ) : null}
      </div>
    ),
  }

  const leases: DetailTab = {
    id: 'leases',
    label: 'Leases',
    count: tenant.leases.length,
    content:
      tenant.leases.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-xs">
          No leases linked to this tenant yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-xs">
          {tenant.leases.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.lease.property.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.lease.units.map((u) => u.unit.label ?? u.unit.unitRef).join(', ') || '—'} ·{' '}
                  {formatDate(row.lease.startsAt)} → {row.lease.endsAt ? formatDate(row.lease.endsAt) : 'open'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="neutral" size="sm">{row.relationship}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/leasing/leases/${row.lease.id}`)}
                  aria-label="Open lease"
                >
                  Open
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ),
  }

  const applications: DetailTab = {
    id: 'applications',
    label: 'Applications',
    count: tenant.rentalApplications.length,
    content:
      tenant.rentalApplications.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-xs">
          No applications from this tenant.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-xs">
          {tenant.rentalApplications.map((app) => (
            <li key={app.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {app.property.name}
                  {app.unit ? ` · ${app.unit.label ?? app.unit.unitRef}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">Submitted {formatDate(app.submittedAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="neutral" size="sm" className={APPLICATION_TONE[app.status]}>
                  {app.status.replace(/_/g, ' ').toLowerCase()}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/leasing/applications/${app.id}`)}
                  aria-label="Open application"
                >
                  Open
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ),
  }

  const documents: DetailTab = {
    id: 'documents',
    label: 'Documents',
    content: <TenantDocumentsTab tenantId={tenant.id} />,
  }

  const notes: DetailTab = {
    id: 'notes',
    label: 'Notes',
    content: (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Internal — never shown in the portal</p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{tenant.notes?.trim() || 'No notes yet.'}</p>
      </div>
    ),
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tenant.displayName}
        description={[tenant.tenantRef, tenant.email ?? tenant.phone].filter(Boolean).join(' · ')}
        actions={
          <>
            {hasUiPermission('tenant.manage') && tenant.portalStatus !== 'ACTIVE' ? (
              <Button variant="outline" onClick={() => setInviteOpen(true)}>
                Invite to portal
              </Button>
            ) : null}
            {hasUiPermission('tenant.update') ? (
              <Button variant="primary" onClick={() => router.push(`/leasing/tenants/${tenant.id}/edit`)}>
                Edit
              </Button>
            ) : undefined}
          </>
        }
      />

      <DetailTabs tabs={[overview, leases, applications, documents, notes]} defaultTab="overview" />

      <PortalInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        tenantId={tenant.id}
        tenantName={tenant.displayName}
        defaultEmail={tenant.email}
        onInvited={load}
      />
    </div>
  )
}
