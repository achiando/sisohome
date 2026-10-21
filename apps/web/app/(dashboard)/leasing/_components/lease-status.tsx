'use client'

/** Status badges for the lease register + detail. */

import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'
import { LEASE_STATUS_VALUES, type LeaseStatusValue } from '@/lib/domain/lease-constants'

const STATUS_TONE: Record<LeaseStatusValue, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING_APPROVAL: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  SCHEDULED: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  ACTIVE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  ENDING: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  TERMINATED: 'bg-red-500/15 text-red-700 dark:text-red-300',
  CLOSED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<LeaseStatusValue, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  SCHEDULED: 'Scheduled',
  ACTIVE: 'Active',
  ENDING: 'Ending',
  TERMINATED: 'Terminated',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

export function LeaseStatusBadge({ status }: { status: string }) {
  const key = (LEASE_STATUS_VALUES as readonly string[]).includes(status)
    ? (status as LeaseStatusValue)
    : 'DRAFT'
  return (
    <Badge variant="neutral" size="sm" className={cn('font-medium', STATUS_TONE[key])}>
      {STATUS_LABEL[key]}
    </Badge>
  )
}
