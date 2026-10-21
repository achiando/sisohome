/**
 * Client-safe document/media constants (plan-slice-1 §3.4).
 * Type-only imports — safe in browser bundles (see property-constants.ts).
 */

import type { DocumentEntityType, DocumentKind } from '@workspace/database';
import { type Option } from './property-constants';

export const DOCUMENT_KINDS: Option<DocumentKind>[] = [
  { value: 'PHOTO', label: 'Photo' },
  { value: 'TITLE_DEED', label: 'Title deed' },
  { value: 'OFFICIAL_SEARCH', label: 'Official search' },
  { value: 'RATES_CLEARANCE', label: 'Rates clearance' },
  { value: 'LAND_RENT_CLEARANCE', label: 'Land rent clearance' },
  { value: 'LCB_CONSENT', label: 'LCB consent' },
  { value: 'SURVEY_PLAN', label: 'Survey plan' },
  { value: 'PPA2', label: 'PPA2' },
  { value: 'LRA_FORM_33', label: 'LRA Form 33' },
  { value: 'STAMP_DUTY_RECEIPT', label: 'Stamp duty receipt' },
  { value: 'SITE_PLAN', label: 'Site plan' },
  { value: 'FLOOR_PLAN', label: 'Floor plan' },
  { value: 'PHOTO_ID', label: 'Photo ID' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'INSPECTION_REPORT', label: 'Inspection report' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'CORRESPONDENCE', label: 'Correspondence' },
  { value: 'TENANCY_AGREEMENT', label: 'Tenancy agreement' },
  { value: 'DEPOSIT_RECEIPT', label: 'Deposit receipt' },
  { value: 'NOTICE', label: 'Notice' },
  { value: 'INVENTORY_REPORT', label: 'Inventory report' },
  { value: 'PAYSLIP', label: 'Payslip' },
  { value: 'BANK_STATEMENT', label: 'Bank statement' },
  { value: 'VALUATION_REPORT', label: 'Valuation report' },
  { value: 'OTHER', label: 'Other' },
];

/** Entity types resolved so far (slice 5 adds LISTING/DEAL). */
export const DOCUMENT_ENTITY_TYPES: DocumentEntityType[] = [
  'PROPERTY',
  'UNIT',
  'OWNERSHIP',
  'AGREEMENT',
  'OWNER_PARTY',
  'TENANT',
  'LEASE',
  'APPLICATION',
  'WORK_ORDER',
  'INSPECTION',
];

export const DOCUMENT_KIND_VALUES: DocumentKind[] = DOCUMENT_KINDS.map((k) => k.value);

export function formatDocumentKind(kind: string): string {
  return DOCUMENT_KINDS.find((k) => k.value === kind)?.label ?? kind.replace(/_/g, ' ').toLowerCase();
}

/** Only PHOTO rows compete for the single cover slot per entity. */
export function isPhotoKind(kind: string): boolean {
  return kind === 'PHOTO';
}
