/**
 * Documents library (roadmap Phase 4) — client-safe helpers for the
 * org-wide /documents page: the JSON row contract, entity-type labels,
 * per-type entity hrefs, size formatting and the pure filter the page
 * uses (also asserted by `smoke-documents-library`). Type-only imports —
 * safe in browser bundles (see document-constants.ts).
 */

import type { DocumentEntityType } from '@workspace/database';
import { DOCUMENT_ENTITY_TYPES, formatDocumentKind } from './document-constants';

/** One row of `GET /api/documents` in library mode (entityId absent). */
export type LibraryDocRow = {
  id: string;
  entityType: string;
  entityId: string;
  kind: string;
  fileName: string;
  caption: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  version: number;
  /** Date on the server, ISO string after JSON. */
  createdAt: string | Date;
  property: { id: string; name: string } | null;
};

/** Human labels for the 12 resolvable entity types (DOCUMENT_ENTITY_TYPES). */
export const DOCUMENT_ENTITY_TYPE_LABELS: Record<string, string> = {
  PROPERTY: 'Property',
  UNIT: 'Unit',
  OWNERSHIP: 'Ownership',
  AGREEMENT: 'Agreement',
  OWNER_PARTY: 'Owner party',
  TENANT: 'Tenant',
  LEASE: 'Lease',
  APPLICATION: 'Application',
  WORK_ORDER: 'Work order',
  INSPECTION: 'Inspection',
  LISTING: 'Listing',
  DEAL: 'Deal',
};

export function formatDocumentEntityType(entityType: string): string {
  return DOCUMENT_ENTITY_TYPE_LABELS[entityType] ?? entityType.replace(/_/g, ' ').toLowerCase();
}

/** Filter options for the library's entity-type dropdown (DOCUMENT_ENTITY_TYPES order). */
export const DOCUMENT_ENTITY_TYPE_OPTIONS: { value: DocumentEntityType; label: string }[] =
  DOCUMENT_ENTITY_TYPES.map((value) => ({ value, label: DOCUMENT_ENTITY_TYPE_LABELS[value] ?? value }));

/**
 * Where a document's owning entity lives in the dashboard. Only routes that
 * exist are produced (per-type detail pages; types without a read page link
 * to their edit page — document-gated views stay behind `document.read`).
 */
export function documentEntityHref(row: Pick<LibraryDocRow, 'entityType' | 'entityId' | 'property'>): string {
  switch (row.entityType) {
    case 'PROPERTY':
      return `/portfolio/${row.entityId}`;
    case 'UNIT':
      return row.property ? `/portfolio/${row.property.id}/units/${row.entityId}` : '/portfolio';
    case 'OWNERSHIP':
      return row.property ? `/portfolio/${row.property.id}` : '/portfolio';
    case 'AGREEMENT':
      return `/portfolio/owners/agreements/${row.entityId}/edit`;
    case 'OWNER_PARTY':
      return `/people/landlords/${row.entityId}`;
    case 'TENANT':
      return `/people/tenants/${row.entityId}`;
    case 'LEASE':
      return `/leasing/leases/${row.entityId}`;
    case 'APPLICATION':
      return `/leasing/applications/${row.entityId}`;
    case 'WORK_ORDER':
      return `/maintenance/work-orders/${row.entityId}`;
    case 'INSPECTION':
      return `/maintenance/inspections/${row.entityId}/edit`;
    case 'LISTING':
      return `/sales/listings/${row.entityId}`;
    case 'DEAL':
      return `/sales/deals/${row.entityId}`;
    default:
      return '/documents';
  }
}

/** "12 KB" style size — `—` when unknown. */
export function formatSizeBytes(sizeBytes: number | null): string {
  if (sizeBytes === null || sizeBytes === undefined) return '—';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Pure client-side filter for the library list: entity-type + kind exact
 * matches, case-insensitive substring over file name, caption, property
 * name and the human type/kind labels.
 */
export function filterLibraryDocuments(
  rows: LibraryDocRow[],
  filters: { entityType?: string; kind?: string; q?: string },
): LibraryDocRow[] {
  let list = rows;
  if (filters.entityType) list = list.filter((r) => r.entityType === filters.entityType);
  if (filters.kind) list = list.filter((r) => r.kind === filters.kind);
  const q = (filters.q ?? '').trim().toLowerCase();
  if (q) {
    list = list.filter(
      (r) =>
        r.fileName.toLowerCase().includes(q) ||
        (r.caption ?? '').toLowerCase().includes(q) ||
        (r.property?.name ?? '').toLowerCase().includes(q) ||
        formatDocumentEntityType(r.entityType).toLowerCase().includes(q) ||
        formatDocumentKind(r.kind).toLowerCase().includes(q),
    );
  }
  return list;
}
