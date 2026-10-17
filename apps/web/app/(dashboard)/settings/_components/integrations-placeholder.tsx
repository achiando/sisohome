'use client'

/**
 * Settings → Integrations — placeholder until Phase 2 connection surfaces
 * (accounting, messaging, payment providers) land.
 */

import { Plug } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

export function IntegrationsPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          Connect SisoHome to the tools your workspace already uses.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <Plug className="size-10 text-muted-foreground/60" />
        <h3 className="mt-4 text-base font-semibold text-foreground">
          Coming soon
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Accounting, messaging, and payment integrations arrive in a later
          phase. Your roles and permissions are already in place for them.
        </p>
      </CardContent>
    </Card>
  )
}
