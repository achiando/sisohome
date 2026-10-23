'use client'

/**
 * PropertyAccountsCard — the rent + utilities ledger-account pair for a
 * property (Slice 3, user decision 2026-10-23). Auto-created on first
 * finances read; shows name, type, currency, and display-only paybill
 * reference. Read-only here — renaming/reference editing lands with the
 * finances module (Slice 4).
 */

import { Landmark, Zap, Banknote } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'

export type LedgerAccountRow = {
  id: string
  accountType: string
  name: string
  reference: string | null
  currency: string
  isActive: boolean
  propertyId: string | null
  unitId: string | null
}

const TYPE_ICON: Record<string, typeof Banknote> = {
  RENT: Banknote,
  UTILITIES: Zap,
}

export function PropertyAccountsCard({ accounts }: { accounts: LedgerAccountRow[] }) {
  const pair = accounts.filter((a) => a.unitId == null)
  if (pair.length === 0) {
    return (
      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4" aria-hidden="true" />
            Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No ledger accounts yet. The rent and utilities accounts are created automatically on the
            first payment or charge read.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-4 w-4" aria-hidden="true" />
          Accounts
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {pair.map((a) => {
          const Icon = TYPE_ICON[a.accountType] ?? Banknote
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <Badge variant={a.accountType === 'UTILITIES' ? 'info' : 'default'} size="sm">
                    {a.accountType === 'UTILITIES' ? 'Utilities' : 'Rent'}
                  </Badge>
                  {!a.isActive ? <Badge variant="neutral" size="sm">Off</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.currency}
                  {a.reference ? ` · ${a.reference}` : ''}
                </p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
