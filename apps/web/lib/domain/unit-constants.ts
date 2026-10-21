/**
 * Client-safe unit-domain constants (options + validation helpers).
 * Type-only imports — safe in browser bundles (see property-constants.ts).
 */

import type { BillingFrequency, UnitKind, UnitStatus } from '@workspace/database';
import { RENT_FREQUENCIES, type Option } from './property-constants';

export const UNIT_KINDS: Option<UnitKind>[] = [
  { value: 'STUDIO', label: 'Studio' },
  { value: 'BEDSITTER', label: 'Bedsitter' },
  { value: 'BED_1', label: '1 bedroom' },
  { value: 'BED_2', label: '2 bedroom' },
  { value: 'BED_3', label: '3 bedroom' },
  { value: 'BED_4_PLUS', label: '4+ bedroom' },
  { value: 'MAISONETTE', label: 'Maisonette' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'KIOSK', label: 'Kiosk' },
  { value: 'SHOWROOM', label: 'Showroom' },
  { value: 'PARKING', label: 'Parking bay' },
  { value: 'PLOT', label: 'Plot' },
  { value: 'FLOOR', label: 'Floor' },
  { value: 'MEZZANINE', label: 'Mezzanine' },
];

export const UNIT_STATUSES: Option<UnitStatus>[] = [
  { value: 'VACANT', label: 'Vacant' },
  { value: 'OCCUPIED', label: 'Occupied' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'BLOCKED', label: 'Blocked' },
];

export const UNIT_STATUS_VALUES: UnitStatus[] = ['VACANT', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'BLOCKED'];

/**
 * Statuses a person may set manually via PATCH. OCCUPIED/RESERVED are
 * lease/application-derived caches (recomputed on lease transitions) —
 * never hand-settable. VACANT is allowed so staff can clear a unit after
 * maintenance before the lease engine takes over in slice 2.
 */
export const UNIT_MANUAL_STATUSES: UnitStatus[] = ['VACANT', 'MAINTENANCE', 'BLOCKED'];

/** Bulk generator bounds — sanity limits, not a product rule. */
export const BULK_MIN_RANGE = 1;
export const BULK_MAX_RANGE = 500;
/** Max rows accepted by POST /api/properties/[id]/units/import (client + server). */
export const IMPORT_MAX_ROWS = 500;

export function formatUnitKind(kind: string): string {
  return UNIT_KINDS.find((k) => k.value === kind)?.label ?? kind.replace(/_/g, ' ').toLowerCase();
}

export function formatUnitStatus(status: string): string {
  return UNIT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function unitKindOptions(): Option<UnitKind>[] {
  return UNIT_KINDS;
}

export function billingFrequencyOptions(): Option<BillingFrequency>[] {
  // Same enum as property-level rent frequency (BillingFrequency).
  return RENT_FREQUENCIES;
}
