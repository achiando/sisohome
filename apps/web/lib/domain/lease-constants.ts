/** Lease domain constants (plan-slice-2 §2.3). */

import type { SelectOption } from '@workspace/ui/types/components'

export const LEASE_STATUSES: SelectOption[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ENDING', label: 'Ending' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const LEASE_STATUS_VALUES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'SCHEDULED',
  'ACTIVE',
  'ENDING',
  'TERMINATED',
  'CLOSED',
  'CANCELLED',
] as const

export type LeaseStatusValue = (typeof LEASE_STATUS_VALUES)[number]

/** Allowed transitions — illegal moves 409 (plan §2.3). */
export const LEASE_TRANSITIONS: Record<LeaseStatusValue, LeaseStatusValue[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['SCHEDULED', 'ACTIVE', 'DRAFT', 'CANCELLED'],
  SCHEDULED: ['ACTIVE', 'ENDING', 'TERMINATED', 'CLOSED'],
  ACTIVE: ['ENDING', 'TERMINATED', 'CLOSED'],
  ENDING: ['TERMINATED', 'CLOSED'],
  TERMINATED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
}

export const LEASE_PARTY_RELATIONSHIPS: SelectOption[] = [
  { value: 'PRIMARY', label: 'Primary' },
  { value: 'JOINT', label: 'Joint tenant' },
  { value: 'GUARANTOR', label: 'Guarantor' },
  { value: 'OCCUPANT', label: 'Occupant' },
]

export const LEASE_PARTY_RELATIONSHIP_VALUES = ['PRIMARY', 'JOINT', 'GUARANTOR', 'OCCUPANT'] as const

export const LEASE_TENURES: SelectOption[] = [
  { value: 'LEASE', label: 'Lease' },
  { value: 'LICENSE', label: 'Licence' },
]

export const LEASE_TENURE_VALUES = ['LEASE', 'LICENSE'] as const

export const BILLING_FREQUENCIES: SelectOption[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUALLY', label: 'Annually' },
]

export const BILLING_FREQUENCY_VALUES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'CUSTOM'] as const

/** Statuses whose LeaseUnits occupy a unit (overlap + occupancy cache). */
export const OCCUPYING_STATUSES: LeaseStatusValue[] = ['ACTIVE', 'SCHEDULED', 'ENDING']

export function leaseStatusLabel(value: string): string {
  return LEASE_STATUSES.find((s) => s.value === value)?.label ?? value
}
