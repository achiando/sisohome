'use client'

/**
 * How to pay (plan-slice-7 §3/§1.4): static pay-instructions only — the
 * display-only reference on the property's ledger accounts plus a generic
 * fallback note. Real M-Pesa initiation is out of wave for v1; nothing here
 * moves money.
 */

import { Info, Landmark } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'

import { usePortalApi, type PortalPaymentInstructions } from '../../_components/portal-data'

interface PaymentMethodsRes extends PortalPaymentInstructions {
  success: boolean
}

export default function PortalPaymentPage() {
  const { data, error, loading } = usePortalApi<PaymentMethodsRes>('/api/portal/payment-methods')

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PageLoader title="Loading payment details..." />
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

  const accounts = data?.accounts ?? []
  const properties = data?.properties ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">How to pay</h1>
        <p className="text-sm text-muted-foreground">
          Where to send your rent — always use your lease reference as the payment description.
        </p>
      </div>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="size-4 text-muted-foreground" aria-hidden="true" /> Pay-in accounts
          </CardTitle>
          <CardDescription>
            For {properties.map((p) => (p.locality ? `${p.name}, ${p.locality}` : p.name)).join(' · ') || 'your building'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your property team has not published a pay-in account yet — contact them for the
              M-Pesa till number for your building.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {accounts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.accountType.replace(/_/g, ' ').toLowerCase()} · {a.currency}
                    </p>
                  </div>
                  <div className="text-right">
                    {a.reference ? (
                      <>
                        <p className="text-xs text-muted-foreground">Reference</p>
                        <p className="font-mono text-sm font-medium text-foreground">{a.reference}</p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No reference published</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {data?.note}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
