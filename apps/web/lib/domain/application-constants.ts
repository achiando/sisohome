/** Application domain constants (plan-slice-2 §2.2). */

import type { SelectOption } from '@workspace/ui/types/components'

export const APPLICATION_STATUSES: SelectOption[] = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CONDITIONAL', label: 'Conditionally approved' },
  { value: 'DENIED', label: 'Denied' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
]

export const APPLICATION_STATUS_VALUES = [
  'SUBMITTED',
  'SCREENING',
  'APPROVED',
  'CONDITIONAL',
  'DENIED',
  'WITHDRAWN',
] as const

/** Statuses an application can still be edited/moved into before a decision. */
export const APPLICATION_PRE_DECISION_STATUSES = ['SUBMITTED', 'SCREENING'] as const

export const DECISIONS = [
  { value: 'APPROVED', label: 'Approve' },
  { value: 'REJECTED', label: 'Reject' },
] as const

export function applicationStatusLabel(value: string): string {
  return APPLICATION_STATUSES.find((s) => s.value === value)?.label ?? value
}
