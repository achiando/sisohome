/**
 * Client-safe charge constants (options + label helpers).
 * Type-only imports — safe in browser bundles (see unit-constants.ts).
 */

import type { BillingFrequency, ChargeType } from '@workspace/database';
import type { Option } from './property-constants';

/** Full ChargeType enum → labels (includes RENT for display of lease-driven rows). */
export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  RENT: 'Rent',
  SERVICE_CHARGE: 'Service charge',
  WATER: 'Water',
  ELECTRICITY: 'Electricity',
  GARBAGE: 'Waste / garbage',
  INSURANCE: 'Insurance',
  LATE_FEE: 'Late fee',
  OTHER: 'Other',
};

/**
 * Options for the "add a non-rent bill" form — RENT is excluded on purpose:
 * rent belongs to the lease, not the unit template.
 */
export const NON_RENT_CHARGE_TYPES: Option<Exclude<ChargeType, 'RENT'>>[] = (
  Object.entries(CHARGE_TYPE_LABELS) as [ChargeType, string][]
)
  .filter(([v]) => v !== 'RENT')
  .map(([value, label]) => ({ value: value as Exclude<ChargeType, 'RENT'>, label }));

export const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUALLY: 'Yearly',
  CUSTOM: 'Custom',
};

export const BILLING_FREQUENCIES: Option<BillingFrequency>[] = (
  Object.entries(BILLING_FREQUENCY_LABELS) as [BillingFrequency, string][]
).map(([value, label]) => ({ value, label }));

export function chargeTypeLabel(value: string): string {
  return CHARGE_TYPE_LABELS[value as ChargeType] ?? value;
}

export function frequencyLabel(value: string): string {
  return BILLING_FREQUENCY_LABELS[value as BillingFrequency] ?? value;
}
