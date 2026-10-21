'use client'

/**
 * /portfolio/owners — owner-party directory (plan-slice-1 §4.1).
 *
 * Flat per-organization directory: parties this org records ownership for.
 * Open → detail (ownerships + agreements), Edit → form. Agreements link in
 * the header for the contract inbox.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Handshake } from 'lucide-react'

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

type PartyRow = {
  id: string
  name: string
  partyType: string
  email?: string | null
  phone?: string | null
  kraPin?: string | null
  country?: string | null
  updatedAt: string
  _count: { ownerships: number; managedAgreements: number }
}

export default function OwnersPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [parties, setParties] = useState<PartyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const load = useCallback(() => {
    let cancelled = false
    fetch('/api/owner-parties', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load owners')
        const data = await res.json()
        return (data.parties ?? []) as PartyRow[]
      })
      .then((list) => {
        if (!cancelled) setParties(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load owners')
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
    let list = parties
    if (typeFilter) list = list.filter((p) => p.partyType === typeFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q) ||
          (p.phone ?? '').toLowerCase().includes(q) ||
          (p.kraPin ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [parties, search, typeFilter])

  if (!hasUiPermission('ownership.list')) {
    return (
      <ScopeDenied
        message="You need the ownership.list permission to view owners. Ask an owner or admin of your organization."
        backHref="/portfolio"
        backLabel="Back to Portfolio"
      />
    )
  }

  const columns: ColumnDef<PartyRow>[] = [
    {
      header: 'Owner',
      cell: (p) => (
        <div className="min-w-0">
          <p className="font-medium">{p.name}</p>
          <p className="text-xs text-muted-foreground">
            {[p.kraPin ? `KRA ${p.kraPin}` : null, p.country].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      ),
    },
    {
      header: 'Type',
      cell: (p) => <Badge variant="neutral" size="sm">{p.partyType.toLowerCase()}</Badge>,
    },
    {
      header: 'Contact',
      cell: (p) => (
        <div className="min-w-0 text-sm">
          <p className="truncate">{p.email ?? '—'}</p>
          <p className="truncate text-xs text-muted-foreground">{p.phone ?? ''}</p>
        </div>
      ),
    },
    {
      header: 'Ownerships',
      cell: (p) => (
        <span className="tabular-nums">
          {p._count.ownerships}
          {p._count.managedAgreements > 0 ? (
            <span className="text-muted-foreground"> · {p._count.managedAgreements} agmt</span>
          ) : null}
        </span>
      ),
    },
    {
      header: 'Updated',
      cell: (p) => <span className="text-sm text-muted-foreground">{formatDate(p.updatedAt)}</span>,
    },
    {
      header: '',
      className: 'w-24',
      cell: (p) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/portfolio/owners/${p.id}`)}
          aria-label={`Open ${p.name}`}
        >
          Open
        </Button>
      ),
    },
  ]

  const cardMapper: CardMapper<PartyRow> = {
    id: (p) => p.id,
    title: (p) => p.name,
    subtitle: (p) => p.partyType.toLowerCase(),
    detailFields: (p) => [
      { label: 'Ownerships', value: p._count.ownerships },
      { label: 'Updated', value: formatDate(p.updatedAt) },
    ],
    actions: (p) => [
      { label: 'Open', variant: 'outline', onClick: () => router.push(`/portfolio/owners/${p.id}`) },
    ],
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/portfolio')}>
          ← Portfolio
        </Button>
      </div>

      <PageHeader
        title="Owners"
        description="Owner parties your organization records ownership and agreements for."
        actions={
          <>
            {hasUiPermission('agreement.list') && (
              <Button variant="outline" leftIcon={Handshake} onClick={() => router.push('/portfolio/owners/agreements')}>
                Agreements
              </Button>
            )}
            {hasUiPermission('ownership.create') && (
              <Button variant="primary" leftIcon={Plus} onClick={() => router.push('/portfolio/owners/new')}>
                Add owner party
              </Button>
            )}
          </>
        }
      />

      <ResponsiveDataListing<PartyRow>
        title="Owner parties"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={5}
        count={parties.length}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, phone or KRA PIN"
        filters={[
          {
            key: 'type',
            label: 'Type',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: '', label: 'All types' },
              { value: 'PERSON', label: 'Person' },
              { value: 'COMPANY', label: 'Company' },
              { value: 'ASSOCIATION', label: 'Association' },
              { value: 'ORGANIZATION', label: 'Organization' },
            ],
          },
        ]}
        filterChips
        rowKey={(p) => p.id}
        emptyState={{
          icon: Users,
          title: parties.length > 0 ? 'No owners match' : 'No owner parties yet',
          description:
            parties.length > 0
              ? 'Try different filters or search terms.'
              : 'Add the owners first — ownership shares and agreements reference these records.',
        }}
        primaryAction={
          hasUiPermission('ownership.create')
            ? { label: 'Add owner party', onClick: () => router.push('/portfolio/owners/new') }
            : undefined
        }
      />
    </div>
  )
}
