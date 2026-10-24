import { XCircle } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

/**
 * Friendly dead-link card for `/i/<token>`: invalid (404), expired or
 * issuer-scope revoked (410). Pages can't send 410, so the browser gets a
 * 200 with clear copy — the JSON API behind the form returns the real
 * statuses. Shared by the server page (initial resolve) and the client
 * form (link died between load and submit).
 */
export function IntakeErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <Card variant="outlined" className="mx-auto w-full max-w-xl">
      <CardHeader className="items-center text-center">
        <XCircle className="size-9 text-muted-foreground" aria-hidden="true" />
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        Ask the property team to send you a fresh link.
      </CardContent>
    </Card>
  )
}
