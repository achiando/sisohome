'use client'

/**
 * Status/priority chips shared by the maintenance pages (ticket + work
 * order + inspection statuses). Tones follow the leasing conventions.
 */

import { Badge } from '@workspace/ui/components/badge'

const STATUS_TONE: Record<string, string> = {
  // Tickets
  OPEN: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  IN_PROGRESS: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ON_HOLD: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  RESOLVED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  CLOSED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-muted text-muted-foreground line-through',
  // Work orders / shared
  PENDING: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  AUTHORIZED: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  SCHEDULED: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  COMPLETED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  // Assignments
  ASSIGNED: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  DECLINED: 'bg-red-500/15 text-red-700 dark:text-red-300',
  // Inspections
  PASSED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  FAILED: 'bg-red-500/15 text-red-700 dark:text-red-300',
  SCHEDULED_INSP: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
}

const PRIORITY_TONE: Record<string, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  HIGH: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  URGENT: 'bg-red-500/15 text-red-700 dark:text-red-300',
}

export function StatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="neutral" size="sm" className={className ?? STATUS_TONE[status]}>
      {status.replace(/_/g, ' ').toLowerCase()}
    </Badge>
  )
}

export function PriorityChip({ priority }: { priority: string }) {
  return (
    <Badge variant="neutral" size="sm" className={PRIORITY_TONE[priority]}>
      {priority.toLowerCase()}
    </Badge>
  )
}
