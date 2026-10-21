'use client'

/**
 * Access-denied fallback Card (pattern: settings/roles page). Used when a
 * detail page's scoped fetch 404s (out of scope for this actor) or a UI
 * gate fails — UX only; the server already answered with 401/403/404.
 */

import { ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Text } from '@workspace/ui/components/text'

export interface ScopeDeniedProps {
  title?: string
  message?: string
  backHref?: string
  backLabel?: string
}

export function ScopeDenied({
  title = 'Access denied',
  message = "This record doesn't exist for your organization, or you don't have permission to view it.",
  backHref = '/',
  backLabel = 'Back to Overview',
}: ScopeDeniedProps) {
  const router = useRouter()
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card variant="outlined" size="lg" className="max-w-md items-center text-center">
        <ShieldAlert className="size-8 text-muted-foreground" aria-hidden />
        <Text variant="headline" as="h1">
          {title}
        </Text>
        <Text variant="bodyMuted">{message}</Text>
        <Button variant="outline" className="mt-2" onClick={() => router.push(backHref)}>
          {backLabel}
        </Button>
      </Card>
    </div>
  )
}
