'use client'

/**
 * Statement (plan-slice-7 §3): derived charges, payments and balance for
 * the tenant's leases — read-only, the org owns the money truth. Totals sit
 * on top; payment instructions live on `/portal/payment`.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Banknote, Receipt, Scale, Wallet } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'

import { formatDate, formatMoney } from '@/app/(dashboard)/_components/domain/format'

import { usePortalApi, type PortalStatement } from '../../_components/portal-data'

interface StatementRes extends PortalStatement {
  success: boolean
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: string
  tone?: 'due' | 'settled'
  icon: ReactNode
}) {
  return (
    <Card variant="outlined">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle
            className={`text-2xl tabular-nums ${
              tone === 'due'
                ? 'text-foreground'
                : tone === 'settled'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-foreground'
            }`}
          >
            {value}
          </CardTitle>
        </div>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
    </Card>
  )
}

export default function PortalStatementPage() {
  const { data, error, loading } = usePortalApi<StatementRes>('/api/portal/statement')

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PageLoader title="Loading your statement..." />
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

  const charges = data?.charges ?? []
  const payments = data?.payments ?? []
  const totals = data?.totals
  const currency = charges[0]?.currency ?? payments[0]?.currency ?? 'KES'
  const balance = totals ? Number(totals.balance) : 0
  const hasAnything = charges.length > 0 || payments.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Statement</h1>
          <p className="text-sm text-muted-foreground">
            Charges and payments across your leases — maintained by your property team.
          </p>
        </div>
        <Link
          href="/portal/payment"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          How to pay
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total charged"
          value={totals ? formatMoney(totals.charges, currency) : '—'}
          icon={<Receipt className="size-5" aria-hidden="true" />}
        />
        <StatCard
          label="Paid"
          value={totals ? formatMoney(totals.payments, currency) : '—'}
          icon={<Wallet className="size-5" aria-hidden="true" />}
        />
        <StatCard
          label="Adjustments"
          value={totals ? formatMoney(totals.adjusted, currency) : '—'}
          icon={<Scale className="size-5" aria-hidden="true" />}
        />
        <StatCard
          label={balance > 0.004 ? 'Balance due' : 'Balance'}
          value={totals ? formatMoney(totals.balance, currency) : '—'}
          tone={balance > 0.004 ? 'due' : 'settled'}
          icon={<Banknote className="size-5" aria-hidden="true" />}
        />
      </div>

      {!hasAnything ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>No activity yet</CardTitle>
            <CardDescription>
              Charges appear here as soon as your property team posts them to your leases.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {charges.length > 0 ? (
            <Card variant="outlined">
              <CardHeader>
                <CardTitle className="text-base">Charges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Due</th>
                        <th className="py-2 pr-3 font-medium">Description</th>
                        <th className="py-2 pr-3 text-right font-medium">Amount</th>
                        <th className="py-2 pr-3 text-right font-medium">Paid</th>
                        <th className="py-2 pr-3 text-right font-medium">Adjusted</th>
                        <th className="py-2 text-right font-medium">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map((c) => (
                        <tr key={c.id} className="border-b border-border/60 last:border-0">
                          <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">
                            {formatDate(c.dueDate)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="font-medium text-foreground">{c.title}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {c.unitLabel ? `${c.unitLabel} · ` : ''}
                              {c.chargeType.toLowerCase()}
                            </span>
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-foreground">
                            {formatMoney(c.amount, c.currency)}
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                            {formatMoney(c.paid, c.currency)}
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                            {Number(c.adjusted) > 0.004 ? formatMoney(c.adjusted, c.currency) : '—'}
                          </td>
                          <td
                            className={`whitespace-nowrap py-2.5 text-right tabular-nums ${
                              Number(c.outstanding) > 0.004
                                ? 'font-medium text-foreground'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {formatMoney(c.outstanding, c.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {payments.length > 0 ? (
            <Card variant="outlined">
              <CardHeader>
                <CardTitle className="text-base">Payments received</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Received</th>
                        <th className="py-2 pr-3 font-medium">Method</th>
                        <th className="py-2 pr-3 font-medium">Reference</th>
                        <th className="py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-b border-border/60 last:border-0">
                          <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">
                            {formatDate(p.receivedAt)}
                          </td>
                          <td className="py-2.5 pr-3 text-foreground">{p.method}</td>
                          <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                            {p.reference ?? '—'}
                          </td>
                          <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-foreground">
                            {formatMoney(p.amount, p.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
