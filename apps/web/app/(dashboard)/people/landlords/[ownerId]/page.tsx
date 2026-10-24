'use client'

/**
 * /people/landlords/[ownerId] — owner party detail: contact block, its
 * ownership rows (property/unit + share + window), agreements count.
 * Statement download lands in slice 2 with billing (placeholder button).
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Pencil, FileText, Plus } from 'lucide-react'
import type { PropertyOwnerParty, PropertyOwnership } from '@workspace/database'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'

type PartyDetail = PropertyOwnerParty & {
  ownerships: (PropertyOwnership & {
    property: { id: string; name: string; code?: string | null } | null
    unit: { id: string; unitRef: string; propertyId: string } | null
  })[]
  _count: { managedAgreements: number }
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || '—'}</span>
    </div>
  )
}

export default function OwnerPartyDetailPage() {
  const router = useRouter()
  const params = useParams<{ ownerId: string }>()
  const ownerId = params.ownerId
  const { hasUiPermission } = useUiPermission()

  const [party, setParty] = useState<PartyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/owner-parties/${ownerId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Owner party not found')
        return data.party as PartyDetail
      })
      .then((p) => {
        if (!cancelled) setParty(p)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ownerId])

  useEffect(() => load(), [load])

  if (!hasUiPermission('ownership.list')) {
    return (
      <ScopeDenied
        message="You need the ownership.list permission to view owner parties."
        backHref="/people/landlords"
        backLabel="Back to owners"
      />
    )
  }

  if (loading) return <PageLoader title="Loading owner…" />
  if (notFound || !party) {
    return (
      <ScopeDenied
        message="This owner party doesn't exist for your organization."
        backHref="/people/landlords"
        backLabel="Back to owners"
      />
    )
  }

  const activeRows = party.ownerships.filter((o) => !o.endsAt || new Date(o.endsAt) > new Date())

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/people/landlords')}>
          ← Owners
        </Button>
      </div>

      <PageHeader
        title={party.name}
        description={[
          party.partyType.toLowerCase(),
          party.kraPin ? `KRA ${party.kraPin}` : null,
          party.country,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Button variant="outline" disabled title="Statements arrive with billing in a later slice">
              <FileText className="size-4" /> Statements
            </Button>
            {hasUiPermission('ownership.update') && (
              <Button variant="primary" leftIcon={Pencil} onClick={() => router.push(`/people/landlords/${party.id}/edit`)}>
                Edit
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card variant="outlined" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ownership rows</CardTitle>
          </CardHeader>
          <CardContent>
            {party.ownerships.length === 0 ? (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  No shares recorded yet — add this party to a property or unit from the property&apos;s
                  Ownership tab.
                </p>
                {hasUiPermission('ownership.create') ? (
                  <Button variant="outline" size="sm" leftIcon={Plus} onClick={() => router.push('/portfolio')}>
                    Go to portfolio
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {party.ownerships.map((o) => {
                  const container = o.property
                    ? o.property.name
                    : o.unit
                      ? `Unit ${o.unit.unitRef}`
                      : '—'
                  return (
                    <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{container}</p>
                          <Badge variant={o.endsAt && new Date(o.endsAt) <= new Date() ? 'neutral' : 'success'} size="sm">
                            {o.endsAt && new Date(o.endsAt) <= new Date() ? 'Ended' : 'Active'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[
                            o.titleNumber ? `Title ${o.titleNumber}` : null,
                            `${formatDate(o.startsAt)} → ${o.endsAt ? formatDate(o.endsAt) : 'current'}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <span className="tabular-nums text-sm font-medium">{Number(o.sharePercent)}%</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card variant="outlined">
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Email" value={party.email} />
              <InfoRow label="Phone" value={party.phone} />
              <InfoRow
                label="ID"
                value={[party.idType?.replace(/_/g, ' ').toLowerCase(), party.idNumber].filter(Boolean).join(' · ')}
              />
              <InfoRow label="Home address" value={party.homeAddress} />
              <InfoRow label="Address" value={[party.addressLine1, party.city, party.region].filter(Boolean).join(', ')} />
              <InfoRow label="Country" value={party.country} />
              {party.notes ? <p className="pt-2 text-sm text-muted-foreground">{party.notes}</p> : null}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Active shares" value={String(activeRows.length)} />
              <InfoRow label="Total active share" value={`${activeRows.reduce((s, o) => s + Number(o.sharePercent), 0)}%`} />
              <InfoRow label="Managed agreements" value={String(party._count.managedAgreements)} />
              <InfoRow label="Updated" value={formatDate(party.updatedAt)} />
            </CardContent>
          </Card>

          {hasUiPermission('agreement.list') ? (
            <Button variant="outline" className="w-full" onClick={() => router.push('/portfolio/owners/agreements')}>
              View agreements
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
