'use client'

/**
 * /leasing/applications/[applicationId] — review screen (plan-slice-2 §3):
 * applicant + screening + notes + documents; Approve/Reject actions.
 * Applicant PII depends on the caller also holding tenant.read (server
 * upgrades the payload; here we just render what we get).
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Mail, Phone, User } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { DetailTabs, type DetailTab } from '@/app/(dashboard)/_components/domain/detail-tabs'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { ApplicationDecisionDialog } from '../../_components/application-decision-dialog'
import { EntityDocumentsTab } from '../../_components/entity-documents-tab'

type ApplicationDetail = {
  id: string
  status: string
  incomeVerified: boolean
  internalNotes: string | null
  submittedAt: string
  decidedAt: string | null
  decidedByUserId: string | null
  leaseId: string | null
  property: { id: string; name: string }
  unit: { id: string; unitRef: string; label: string | null } | null
  applicant: {
    id: string
    displayName: string
    email?: string | null
    phone?: string | null
    status?: string
    kraPin?: string | null
    employer?: string | null
    jobTitle?: string | null
  }
}

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  SCREENING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  APPROVED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  CONDITIONAL: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  DENIED: 'bg-red-500/15 text-red-700 dark:text-red-300',
  WITHDRAWN: 'bg-muted text-muted-foreground',
}

export default function ApplicationReviewPage() {
  const router = useRouter()
  const params = useParams<{ applicationId: string }>()
  const applicationId = params.applicationId
  const { hasUiPermission } = useUiPermission()

  const [app, setApp] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [toggling, setToggling] = useState(false)

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
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Application not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applicationId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('application.read')) {
    return <ScopeDenied message="You need the application.read permission to review applications." />
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

  const preDecision = !app.decidedAt
  const canDecide = hasUiPermission('application.approve') && preDecision

  const toggleIncome = async () => {
    setToggling(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incomeVerified: !app.incomeVerified }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Update failed')
      setApp((prev) => (prev ? { ...prev, incomeVerified: !prev.incomeVerified } : prev))
      toast.success('Screening updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setToggling(false)
    }
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
    label: 'Review',
    content: (
      <div className="space-y-6 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral" size="sm" className={STATUS_TONE[app.status]}>
            {app.status.replace(/_/g, ' ').toLowerCase()}
          </Badge>
          <Badge variant="neutral" size="sm">
            {app.incomeVerified ? 'Income verified' : 'Income unverified'}
          </Badge>
          <Badge variant="neutral" size="sm">{app.property.name}</Badge>
          {app.unit ? (
            <Badge variant="neutral" size="sm">{app.unit.label ?? app.unit.unitRef}</Badge>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {infoRow(<User className="size-4" aria-hidden />, 'Applicant', app.applicant.displayName)}
          {infoRow(<Mail className="size-4" aria-hidden />, 'Email', app.applicant.email)}
          {infoRow(<Phone className="size-4" aria-hidden />, 'Phone', app.applicant.phone)}
          {infoRow(
            <User className="size-4" aria-hidden />,
            'Employment',
            [app.applicant.employer, app.applicant.jobTitle].filter(Boolean).join(' · '),
          )}
        </div>

        {app.applicant.email || app.applicant.phone ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/leasing/tenants/${app.applicant.id}`)}
          >
            Open tenant profile
          </Button>
        ) : null}

        {hasUiPermission('application.update') && preDecision ? (
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={toggleIncome} loading={toggling} disabled={toggling}>
              {app.incomeVerified ? 'Mark income unverified' : 'Mark income verified'}
            </Button>
          </div>
        ) : null}

        <div className="border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Internal screening notes — never shown to the applicant
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{app.internalNotes?.trim() || 'No notes yet.'}</p>
        </div>

        <div className="border-t border-border pt-4 text-xs text-muted-foreground">
          Submitted {formatDate(app.submittedAt)}
          {app.decidedAt ? ` · decided ${formatDate(app.decidedAt)}` : ''}
        </div>
      </div>
    ),
  }

  const documents: DetailTab = {
    id: 'documents',
    label: 'Documents',
    content: (
      <EntityDocumentsTab
        entityType="APPLICATION"
        entityId={app.id}
        storageHint="Screening files (ID, pay slips, bank statements)"
      />
    ),
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={app.applicant.displayName}
        description={[app.property.name, app.unit?.label ?? app.unit?.unitRef].filter(Boolean).join(' · ')}
        actions={
          <>
            {app.leaseId ? (
              <Button variant="outline" onClick={() => router.push(`/leasing/leases/${app.leaseId}`)}>
                Open lease
              </Button>
            ) : null}
            {app.status === 'APPROVED' && !app.leaseId && hasUiPermission('lease.create') ? (
              <Button
                variant="primary"
                onClick={() => router.push(`/leasing/leases/new?applicationId=${applicationId}`)}
              >
                Start lease
              </Button>
            ) : null}
            {hasUiPermission('application.update') && preDecision ? (
              <Button
                variant="outline"
                onClick={() => router.push(`/leasing/applications/${applicationId}/edit`)}
              >
                Edit
              </Button>
            ) : null}
            {canDecide ? (
              <>
                <Button variant="outline" onClick={() => setDecision('REJECTED')}>
                  Reject
                </Button>
                <Button variant="primary" onClick={() => setDecision('APPROVED')}>
                  Approve
                </Button>
              </>
            ) : undefined}
          </>
        }
      />

      <DetailTabs tabs={[overview, documents]} defaultTab="overview" />

      {decision ? (
        <ApplicationDecisionDialog
          open
          onOpenChange={(o) => !o && setDecision(null)}
          applicationId={applicationId}
          applicantName={app.applicant.displayName}
          decision={decision}
          onDecided={load}
        />
      ) : null}
    </div>
  )
}
