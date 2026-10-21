'use client'

/**
 * Unit status visuals — `status` here is the LEASE-DERIVED effective
 * occupancy from the API (`occupancy`), never the stale cache. Stored
 * OCCUPIED with no active lease renders as Vacant (service collapses it).
 */

import { Badge } from '@workspace/ui/components/badge'
import type { BadgeVariant } from '@workspace/ui/types/components'
import type { UnitStatus } from '@workspace/database'

const STATUS_META: Record<UnitStatus, { label: string; variant: BadgeVariant }> = {
  VACANT: { label: 'Vacant', variant: 'neutral' },
  OCCUPIED: { label: 'Occupied', variant: 'success' },
  RESERVED: { label: 'Reserved', variant: 'info' },
  MAINTENANCE: { label: 'Maintenance', variant: 'warning' },
  BLOCKED: { label: 'Blocked', variant: 'error' },
}

export function UnitStatusBadge({
  status,
  size = 'sm',
}: {
  status: UnitStatus
  size?: 'sm' | 'md'
}) {
  const meta = STATUS_META[status] ?? { label: status, variant: 'neutral' as BadgeVariant }
  return (
    <Badge variant={meta.variant} size={size} dot>
      {meta.label}
    </Badge>
  )
}

export function unitStatusLabel(status: UnitStatus): string {
  return STATUS_META[status]?.label ?? status
}
