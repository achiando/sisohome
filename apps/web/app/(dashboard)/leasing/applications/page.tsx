'use client'

/**
 * /leasing/applications — screening queue grouped by status
 * (plan-slice-2 §3). UX gate: application.list.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'

import {
  ResponsiveDataListing,
  type CardMapper,
  type ColumnDef,
} from '@workspace/ui/components/shared'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { APPLICATION_STATUSES } from '@/lib/domain/application-constants'

type ApplicationRow = {
  id: string
  status: string
  incomeVerified: boolean
  submittedAt: string
  decidedAt: string | null
  property: { id: string; name: string }
  unit: { id: string; unitRef: string; label: string | null } | null
  applicant: { id: string; displayName: string; email: string | null; phone: string | null }
}

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  SCREENING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  APPROVED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  CONDITIONAL: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  DENIED: 'bg-red-500/15 text-red-700 dark:text-red-300',
  WITHDRAWN: 'bg-muted text-muted-foreground',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="neutral" size="sm" className={STATUS_TONE[status]}>
      {status.replace(/_/g, ' ').toLowerCase()}
    </Badge>
  )
}

export default function ApplicationsPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/applications', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load applications')
        const data = await res.json()
        return (data.applications ?? []) as ApplicationRow[]
      })
      .then((list) => {
        if (!cancelled) setApplications(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load applications')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    let list = applications
    if (statusFilter) list = list.filter((a) => a.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) =>
          a.property.name.toLowerCase().includes(q) ||
          a.applicant.displayName.toLowerCase().includes(q) ||
          (a.unit?.label ?? a.unit?.unitRef ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [applications, search, statusFilter])

  if (!hasUiPermission('application.list')) {
    return (
      <ScopeDenied message="You need the application.list permission to view the screening queue." />
    )
  }

  const columns: ColumnDef<ApplicationRow>[] = [
    {
      header: 'Applicant',
      cell: (a) => (
        <div className="min-w-0">
          <p className="font-medium">{a.applicant.displayName}</p>
          <p className="text-xs text-muted-foreground">{a.applicant.email ?? a.applicant.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      header: 'Property / unit',
      cell: (a) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{a.property.name}</p>
          <p className="text-xs text-muted-foreground">{a.unit?.label ?? a.unit?.unitRef ?? 'Whole property'}</p>
        </div>
      ),
    },
    { header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
    {
      header: 'Screening',
      cell: (a) => (
        <span className="text-xs text-muted-foreground">
          {a.incomeVerified ? 'Income verified' : 'Income unverified'}
        </span>
      ),
    },
    { header: 'Submitted', cell: (a) => <span className="text-sm text-muted-foreground">{formatDate(a.submittedAt)}</span> },
    {
      header: '',
      className: 'w-24',
      cell: (a) => (
        <Button variant="outline" size="sm" onClick={() => router.push(`/leasing/applications/${a.id}`)} aria-label="Open application">
          Review
        </Button>
      ),
    },
  ]

  const cardMapper: CardMapper<ApplicationRow> = {
    id: (a) => a.id,
    title: (a) => a.applicant.displayName,
    subtitle: (a) => a.property.name,
    statusBadge: (a) => <StatusBadge status={a.status} />,
    detailFields: (a) => [
      { label: 'Unit', value: a.unit?.label ?? a.unit?.unitRef ?? 'Whole property' },
      { label: 'Submitted', value: formatDate(a.submittedAt) },
    ],
    actions: (a) => [
      { label: 'Review', variant: 'outline', onClick: () => router.push(`/leasing/applications/${a.id}`) },
    ],
  }

  const openCount = applications.filter((a) => a.status === 'SUBMITTED' || a.status === 'SCREENING').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description={
          applications.length > 0
            ? `${openCount} open · ${applications.length} total`
            : 'Rental applications and screening.'
        }
        actions={
          <>
            {hasUiPermission('tenant.create') ? (
              <Button variant="outline" onClick={() => router.push('/leasing/tenants/new')}>
                Add tenant
              </Button>
            ) : null}
            {hasUiPermission('application.create') ? (
              <Button variant="primary" onClick={() => router.push('/leasing/applications/new')}>
                Capture application
              </Button>
            ) : undefined}
          </>
        }
      />

      <ResponsiveDataListing<ApplicationRow>
        title="Queue"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={5}
        count={applications.length}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search applicant or property"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'All statuses' }, ...APPLICATION_STATUSES],
          },
        ]}
        filterChips
        rowKey={(a) => a.id}
        emptyState={{
          icon: ClipboardList,
          title: 'No applications yet',
          description:
            applications.length > 0
              ? 'No applications match these filters.'
              : 'Capture an application to start screening.',
        }}
        primaryAction={
          hasUiPermission('application.create')
            ? { label: 'Capture application', onClick: () => router.push('/leasing/applications/new') }
            : undefined
        }
      />
    </div>
  )
}
