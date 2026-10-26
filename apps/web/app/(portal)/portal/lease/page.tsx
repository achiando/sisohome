'use client'

/**
 * Lease page (plan-slice-7 §3): active + historical leases — dates, units,
 * rent, terms, co-parties and the managing org. Read-only.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'

import { formatDate, formatMoney } from '@/app/(dashboard)/_components/domain/format'
import { LeaseStatusBadge } from '@/app/(dashboard)/leasing/_components/lease-status'

import { usePortalApi, type PortalLease } from '../../_components/portal-data'

interface LeaseRes {
  success: boolean
  leases: PortalLease[]
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export default function PortalLeasePage() {
  const { data, error, loading } = usePortalApi<LeaseRes>('/api/portal/lease')

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PageLoader title="Loading your lease..." />
      </div>
    )
  }
  if (error) {
    return <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
  }

  const leases = data?.leases ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Your lease</h1>
        <p className="text-sm text-muted-foreground">
          Everything on file between you and your property team.
        </p>
      </div>

      {leases.length === 0 ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>No lease on file yet</CardTitle>
            <CardDescription>
              Once your property team issues a lease and links you as a tenant, it will appear
              here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        leases.map((lease) => {
          const relationship =
            lease.myRelationship === 'PRIMARY'
              ? 'Primary tenant'
              : lease.myRelationship.replace(/_/g, ' ').toLowerCase()
          return (
            <Card key={lease.id} variant="outlined">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {lease.property.name}
                    {lease.property.locality ? (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        · {lease.property.locality}
                      </span>
                    ) : null}
                  </CardTitle>
                  <CardDescription>
                    {lease.leaseRef} · {relationship} · managed by {lease.manager.name}
                  </CardDescription>
                </div>
                <LeaseStatusBadge status={lease.status} />
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Meta label="Started" value={formatDate(lease.startsAt)} />
                  <Meta label="Ends" value={formatDate(lease.endsAt)} />
                  <Meta label="Signed" value={lease.signedAt ? formatDate(lease.signedAt) : 'Not signed'} />
                  <Meta label="Billing" value={lease.billingFrequency.toLowerCase()} />
                  <Meta label="Payment due day" value={lease.paymentDueDay ? `Day ${lease.paymentDueDay}` : '—'} />
                  <Meta
                    label="Deposit"
                    value={
                      lease.depositMonths
                        ? `${Number(lease.depositMonths)} month${Number(lease.depositMonths) === 1 ? '' : 's'}`
                        : '—'
                    }
                  />
                  <Meta label="Notice period" value={lease.noticeDays ? `${lease.noticeDays} days` : '—'} />
                  <Meta label="Auto-renew" value={lease.autoRenew ? 'Yes' : 'No'} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Unit{lease.units.length > 1 ? 's' : ''}
                  </p>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {lease.units.map((u) => (
                      <li key={u.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                        <span className="font-medium text-foreground">
                          {u.label}
                          {u.unitRef ? (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{u.unitRef}</span>
                          ) : null}
                        </span>
                        <span className="tabular-nums text-foreground">
                          {formatMoney(u.monthlyRent, u.currency)}/mo
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Occupants
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {lease.parties.map((p) => (
                      <li
                        key={p.tenantId}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          p.isSelf
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-border bg-muted text-foreground'
                        }`}
                      >
                        {p.displayName}
                        <span className="ml-1.5 text-muted-foreground">
                          · {p.relationship.replace(/_/g, ' ').toLowerCase()}
                          {p.isSelf ? ' · you' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
