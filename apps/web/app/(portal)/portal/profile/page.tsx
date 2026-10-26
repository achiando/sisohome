'use client'

/**
 * Profile (plan-slice-7 §3): read-only in v1 — identity, which tenancies
 * this account holds, and the mandatory-password notice if applicable.
 */

import Link from 'next/link'
import { Building2, KeyRound, LogOut, User } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'

import { portalSignOut, usePortalSession } from '../../_components/portal-data'

export default function PortalProfilePage() {
  const session = usePortalSession()

  if (!session) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account details as held by SisoHome.
        </p>
      </div>

      <Card variant="outlined">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <span
            className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <User className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">{session.profile.name ?? 'Tenant'}</CardTitle>
            <CardDescription>{session.profile.email}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.profile.mustChangePassword ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200">
              <span>Set a permanent password to finish setting up your account.</span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/change-password">
                  <KeyRound className="size-4" aria-hidden="true" /> Change password
                </Link>
              </Button>
            </div>
          ) : null}
          <Button variant="outline" onClick={portalSignOut}>
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </Button>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-muted-foreground" aria-hidden="true" /> Your
            tenancies
          </CardTitle>
          <CardDescription>
            Each tenancy is a separate portal context — switch between them from the header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {session.tenants.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{t.displayName}</p>
                  <p className="text-xs text-muted-foreground">{t.orgName}</p>
                </div>
                {t.id === session.contextTenantId ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    Active
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
