/** Maintenance domain constants — statuses, transitions, labels (plan-slice-3 §2). */

import type { SelectOption } from '@workspace/ui/types/components'

// ── tickets ──────────────────────────────────────────────────────────────────

export const MAINTENANCE_STATUSES: SelectOption[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const MAINTENANCE_STATUS_VALUES = [
  'OPEN',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
] as const

export type MaintenanceStatusValue = (typeof MAINTENANCE_STATUS_VALUES)[number]

/** OPEN → IN_PROGRESS → RESOLVED → CLOSED; ON_HOLD/CANCELLED anywhere. */
export const TICKET_TRANSITIONS: Record<MaintenanceStatusValue, MaintenanceStatusValue[]> = {
  OPEN: ['IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['RESOLVED', 'ON_HOLD', 'CANCELLED'],
  ON_HOLD: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
}

export const TICKET_CATEGORIES: SelectOption[] = [
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'JOINERY', label: 'Joinery' },
  { value: 'PAINTING', label: 'Painting' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'LANDSCAPING', label: 'Landscaping' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'PEST_CONTROL', label: 'Pest control' },
  { value: 'GENERAL', label: 'General' },
]

export const TICKET_PRIORITIES: SelectOption[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

// ── work orders ──────────────────────────────────────────────────────────────

export const WORK_ORDER_STATUSES: SelectOption[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'AUTHORIZED', label: 'Authorized' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const WORK_ORDER_STATUS_VALUES = [
  'PENDING',
  'AUTHORIZED',
  'SCHEDULED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const

export type WorkOrderStatusValue = (typeof WORK_ORDER_STATUS_VALUES)[number]

/**
 * PENDING → AUTHORIZED (via the authorize transition) → SCHEDULED →
 * IN_PROGRESS → COMPLETED; ON_HOLD/CANCELLED reachable as shown.
 * COMPLETED/CANCELLED are terminal.
 */
export const WORK_ORDER_TRANSITIONS: Record<WorkOrderStatusValue, WorkOrderStatusValue[]> = {
  PENDING: ['AUTHORIZED', 'ON_HOLD', 'CANCELLED'],
  AUTHORIZED: ['SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD'],
  ON_HOLD: ['AUTHORIZED', 'SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export const ASSIGNMENT_STATUSES: SelectOption[] = [
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'COMPLETED', label: 'Completed' },
]

export const ASSIGNMENT_STATUS_VALUES = ['ASSIGNED', 'DECLINED', 'COMPLETED'] as const

export type AssignmentStatusValue = (typeof ASSIGNMENT_STATUS_VALUES)[number]

export const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatusValue, AssignmentStatusValue[]> = {
  ASSIGNED: ['DECLINED', 'COMPLETED'],
  DECLINED: [],
  COMPLETED: [],
}

// ── inspections ──────────────────────────────────────────────────────────────

export const INSPECTION_STATUSES: SelectOption[] = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const INSPECTION_STATUS_VALUES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'PASSED',
  'FAILED',
  'CANCELLED',
] as const

export type InspectionStatusValue = (typeof INSPECTION_STATUS_VALUES)[number]

export const INSPECTION_TRANSITIONS: Record<InspectionStatusValue, InspectionStatusValue[]> = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PASSED', 'FAILED', 'CANCELLED'],
  PASSED: [],
  FAILED: [],
  CANCELLED: [],
}

export const INSPECTION_KINDS: SelectOption[] = [
  { value: 'MOVE_IN', label: 'Move-in' },
  { value: 'MOVE_OUT', label: 'Move-out' },
  { value: 'ROUTINE', label: 'Routine' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'OTHER', label: 'Other' },
]

// ── recurring schedules ──────────────────────────────────────────────────────

export const SCHEDULE_KINDS: SelectOption[] = [
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'VISIT', label: 'Visit' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OTHER', label: 'Other' },
]

export const SCHEDULE_FREQUENCIES: SelectOption[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
]

export const SCHEDULE_FREQUENCY_VALUES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'] as const

export type ScheduleFrequencyValue = (typeof SCHEDULE_FREQUENCY_VALUES)[number]

/** Next due = start + one period (used on create and on frequency/start edits). */
export function computeNextDue(startDate: Date, frequency: ScheduleFrequencyValue): Date {
  const next = new Date(startDate)
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1)
      break
    case 'WEEKLY':
      next.setDate(next.getDate() + 7)
      break
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1)
      break
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3)
      break
  }
  return next
}

// ── label helpers ────────────────────────────────────────────────────────────

export function ticketStatusLabel(value: string): string {
  return MAINTENANCE_STATUSES.find((s) => s.value === value)?.label ?? value
}

export function workOrderStatusLabel(value: string): string {
  return WORK_ORDER_STATUSES.find((s) => s.value === value)?.label ?? value
}

export function inspectionStatusLabel(value: string): string {
  return INSPECTION_STATUSES.find((s) => s.value === value)?.label ?? value
}

export function priorityLabel(value: string): string {
  return TICKET_PRIORITIES.find((s) => s.value === value)?.label ?? value
}
