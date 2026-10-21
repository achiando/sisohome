'use client'

/**
 * AgreementStatusBadge — shared status chip for agreement rows
 * (draft = proposal inbox awaiting portfolio approval).
 */

import { Badge } from '@workspace/ui/components/badge'
import type { AgreementStatus } from '@workspace/database'

const STYLES: Record<AgreementStatus, { label: string; variant: 'neutral' | 'primary' | 'warning' | 'success' | 'error' }> = {
  DRAFT: { label: 'Draft — awaiting approval', variant: 'warning' },
  ACTIVE: { label: 'Active', variant: 'success' },
  SUSPENDED: { label: 'Suspended', variant: 'neutral' },
  ENDED: { label: 'Ended', variant: 'neutral' },
  TERMINATED: { label: 'Terminated', variant: 'error' },
}

export function AgreementStatusBadge({ status, size = 'md' }: { status: AgreementStatus; size?: 'sm' | 'md' }) {
  const s = STYLES[status] ?? { label: status, variant: 'neutral' as const }
  return (
    <Badge variant={s.variant} size={size}>
      {s.label}
    </Badge>
  )
}
