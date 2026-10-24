'use client'

/**
 * /portfolio/owners/agreements — agreement list + proposal inbox
 * (plan-slice-1 §2.2, §4.2). Rows come either-side (portfolio OR manager
 * org) with an `actorIsPortfolioSide` flag; Approve shows only for drafts
 * the caller's org owns (portfolio half) — the server enforces too.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Handshake, Plus, CheckCircle2, StopCircle, Pencil } from 'lucide-react'
import type { AgreementStatus } from '@workspace/database'

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
import { AgreementStatusBadge } from '../../_components/agreement-status'
import { ApproveAgreementDialog } from '../../_components/approve-agreement-dialog'

type AgreementRow = {
  id: string
  status: AgreementStatus
  startsAt: string
  endsAt: string | null
  actorIsPortfolioSide: boolean
  property: { id: string; name: string; code?: string | null } | null
  managementOrganization: { id: string; name: string; kind?: string | null } | null
  ownerParty: { id: string; name: string } | null
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Drafts (awaiting approval)' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'ENDED', label: 'Ended' },
  { value: 'TERMINATED', label: 'Terminated' },
]

export default function AgreementsPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [agreements, setAgreements] = useState<AgreementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sideFilter, setSideFilter] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [approving, setApproving] = useState<AgreementRow | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    fetch('/api/agreements', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load agreements')
        const data = await res.json()
        return (data.agreements ?? []) as AgreementRow[]
      })
      .then((list) => {
        if (!cancelled) setAgreements(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load agreements')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load])

  const filtered = useMemo(() => {
    let list = agreements
    if (statusFilter) list = list.filter((a) => a.status === statusFilter)
    if (sideFilter === 'owner') list = list.filter((a) => a.actorIsPortfolioSide)
    if (sideFilter === 'manager') list = list.filter((a) => !a.actorIsPortfolioSide)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) =>
          (a.property?.name ?? '').toLowerCase().includes(q) ||
          (a.managementOrganization?.name ?? '').toLowerCase().includes(q) ||
          (a.ownerParty?.name ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [agreements, search, statusFilter, sideFilter])

  const runAction = async (id: string, action: 'end') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/agreements/${id}/${action}`, { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? `Failed to ${action} agreement`)
        return
      }
      toast.success('Agreement ended')
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setBusyId(null)
    }
  }

  if (!hasUiPermission('agreement.list')) {
    return (
      <ScopeDenied
        message="You need the agreement.list permission to view agreements. Ask an owner or admin of your organization."
        backHref="/portfolio"
        backLabel="Back to Portfolio"
      />
    )
  }

  const columns: ColumnDef<AgreementRow>[] = [
    {
      header: 'Property',
      cell: (a) => (
        <div className="min-w-0">
          <p className="font-medium">{a.property?.name ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{a.property?.code ?? ''}</p>
        </div>
      ),
    },
    {
      header: 'Manager',
      cell: (a) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{a.managementOrganization?.name ?? '—'}</p>
          <p className="text-xs text-muted-foreground">Owner: {a.ownerParty?.name ?? '—'}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (a) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <AgreementStatusBadge status={a.status} size="sm" />
          <Badge variant={a.actorIsPortfolioSide ? 'outline' : 'neutral'} size="sm">
            {a.actorIsPortfolioSide ? 'owner side' : 'manager side'}
          </Badge>
        </div>
      ),
    },
    {
      header: 'Term',
      cell: (a) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(a.startsAt)} → {a.endsAt ? formatDate(a.endsAt) : 'open'}
        </span>
      ),
    },
    {
      header: '',
      className: 'w-44',
      cell: (a) => (
        <div className="flex justify-end gap-2">
          {a.status === 'DRAFT' && a.actorIsPortfolioSide && hasUiPermission('agreement.approve') ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={CheckCircle2}
              disabled={busyId === a.id}
              onClick={() => setApproving(a)}
            >
              Approve
            </Button>
          ) : null}
          {(a.status === 'ACTIVE' || a.status === 'SUSPENDED') && hasUiPermission('agreement.update') ? (
            <Button
              variant="outline"
              size="sm"
              leftIcon={StopCircle}
              disabled={busyId === a.id}
              onClick={() => runAction(a.id, 'end')}
            >
              End
            </Button>
          ) : null}
          <Button variant="outline" size="sm" leftIcon={Pencil} onClick={() => router.push(`/portfolio/owners/agreements/${a.id}/edit`)}>
            Open
          </Button>
        </div>
      ),
    },
  ]

  const cardMapper: CardMapper<AgreementRow> = {
    id: (a) => a.id,
    title: (a) => a.property?.name ?? 'Agreement',
    subtitle: (a) => a.managementOrganization?.name,
    statusBadge: (a) => <AgreementStatusBadge status={a.status} size="sm" />,
    detailFields: (a) => [
      { label: 'Owner party', value: a.ownerParty?.name ?? '—' },
      { label: 'Term', value: `${formatDate(a.startsAt)} → ${a.endsAt ? formatDate(a.endsAt) : 'open'}` },
    ],
    actions: (a) => {
      const acts: { label: string; variant?: 'outline' | 'destructive'; onClick: () => void }[] = []
      if (a.status === 'DRAFT' && a.actorIsPortfolioSide && hasUiPermission('agreement.approve')) {
        acts.push({ label: 'Approve', variant: 'outline', onClick: () => setApproving(a) })
      }
      acts.push({
        label: 'Open',
        variant: 'outline',
        onClick: () => router.push(`/portfolio/owners/agreements/${a.id}/edit`),
      })
      return acts
    },
  }

  const drafts = agreements.filter((a) => a.status === 'DRAFT' && a.actorIsPortfolioSide).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/portfolio')}>
          ← Portfolio
        </Button>
      </div>

      <PageHeader
        title="Agreements"
        description={
          drafts > 0
            ? `${drafts} proposal${drafts === 1 ? '' : 's'} awaiting approval from your organization.`
            : 'Management contracts your organization owns or manages under.'
        }
        actions={
          <>
            {hasUiPermission('ownership.list') && (
              <Button variant="outline" onClick={() => router.push('/people/landlords')}>
                Owners
              </Button>
            )}
            {hasUiPermission('agreement.create') && (
              <Button variant="primary" leftIcon={Plus} onClick={() => router.push('/portfolio/owners/agreements/new')}>
                New agreement
              </Button>
            )}
          </>
        }
      />

      <ResponsiveDataListing<AgreementRow>
        title="Management agreements"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={5}
        count={agreements.length}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search property, manager or owner"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: STATUS_OPTIONS,
          },
          {
            key: 'side',
            label: 'Side',
            value: sideFilter,
            onChange: setSideFilter,
            options: [
              { value: '', label: 'Both sides' },
              { value: 'owner', label: 'Owner side (yours)' },
              { value: 'manager', label: 'Manager side (yours)' },
            ],
          },
        ]}
        filterChips
        rowKey={(a) => a.id}
        emptyState={{
          icon: Handshake,
          title: agreements.length > 0 ? 'No agreements match' : 'No agreements yet',
          description:
            agreements.length > 0
              ? 'Try different filters or search terms.'
              : 'Propose an agreement to appoint a managing organization — owners approve it before it activates.',
        }}
        primaryAction={
          hasUiPermission('agreement.create')
            ? { label: 'New agreement', onClick: () => router.push('/portfolio/owners/agreements/new') }
            : undefined
        }
      />

      {approving ? (
        <ApproveAgreementDialog
          key={approving.id}
          agreementId={approving.id}
          managementOrgKind={approving.managementOrganization?.kind ?? null}
          open
          onOpenChange={(o) => !o && setApproving(null)}
          onApproved={() => {
            setApproving(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}
