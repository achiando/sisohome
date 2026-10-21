/**
 * Documents & media — polymorphic rows reused by every later slice
 * (plan-slice-1 §3.4).
 *
 * Scoping (child rule):
 * - A document's `organizationId` = the owning container's org: the
 *   PROPERTY's `portfolioOrganizationId` for PROPERTY/UNIT/OWNERSHIP/
 *   AGREEMENT entities, the caller's own org for flat OWNER_PARTY rows.
 * - Every read/write resolves the entity back through the same choke
 *   point as the parent (`propertyScopeWhere` / either-side agreement /
 *   own-org party) so a cross-tenant ID 404s — never leaks existence.
 * - Unresolved rows (entity deleted, or an entity type this slice does
 *   not resolve yet) are visible only to the document's own org — that is
 *   also how the owning org cleans up orphans.
 * - Cover rule: a single `isCover` winner per (entity, kind=PHOTO),
 *   enforced in a transaction on create and on patch.
 */

import { Prisma } from '@workspace/database';
import type { DocumentEntityType, DocumentKind } from '@workspace/database';
import { destroyImage, publicIdFromUrl } from '@workspace/cloudinary';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';
import { tenantScopeWhere } from './tenant';
import { DOCUMENT_ENTITY_TYPES, DOCUMENT_KIND_VALUES } from './document-constants';

type Raw = Record<string, unknown>;

interface ResolvedEntity {
  organizationId: string;
  propertyId: string | null;
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function intOrNull(v: unknown, field: string): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new RouteError(400, `${field} must be an integer`);
  return n;
}

function boolOrNull(v: unknown, field: string): boolean | null {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  throw new RouteError(400, `${field} must be a boolean`);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002';
}

const DOCUMENT_INCLUDE = {
  versions: { orderBy: { version: 'desc' as const } },
} satisfies Prisma.PropertyDocumentInclude;

// ── entity resolution ─────────────────────────────────────────────────────────

async function resolveDocumentEntity(
  actor: ScopeActor,
  entityType: DocumentEntityType,
  entityId: string,
): Promise<ResolvedEntity> {
  switch (entityType) {
    case 'PROPERTY': {
      const property = await requirePropertyInScope(actor, entityId);
      return { organizationId: property.portfolioOrganizationId, propertyId: property.id };
    }
    case 'UNIT': {
      const unit = await db.unit.findFirst({
        where: { id: entityId, property: propertyScopeWhere(actor) },
        select: { propertyId: true },
      });
      if (!unit) throw new RouteError(404, 'Unit not found');
      const property = await db.property.findUnique({
        where: { id: unit.propertyId },
        select: { portfolioOrganizationId: true },
      });
      if (!property) throw new RouteError(404, 'Unit not found');
      return { organizationId: property.portfolioOrganizationId, propertyId: unit.propertyId };
    }
    case 'OWNERSHIP': {
      const row = await db.propertyOwnership.findFirst({
        where: {
          id: entityId,
          OR: [
            { property: propertyScopeWhere(actor) },
            { unit: { property: propertyScopeWhere(actor) } },
          ],
        },
        select: { organizationId: true, propertyId: true, unit: { select: { propertyId: true } } },
      });
      if (!row) throw new RouteError(404, 'Ownership not found');
      return { organizationId: row.organizationId, propertyId: row.propertyId ?? row.unit?.propertyId ?? null };
    }
    case 'AGREEMENT': {
      const row = await db.propertyManagementAgreement.findFirst({
        where: {
          id: entityId,
          OR: [{ organizationId: actor.organizationId }, { managementOrganizationId: actor.organizationId }],
        },
        select: { organizationId: true, propertyId: true },
      });
      if (!row) throw new RouteError(404, 'Agreement not found');
      return { organizationId: row.organizationId, propertyId: row.propertyId };
    }
    case 'OWNER_PARTY': {
      // Flat per-org directory — own-org only (no property scope involved).
      const row = await db.propertyOwnerParty.findFirst({
        where: { id: entityId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!row) throw new RouteError(404, 'Owner party not found');
      return { organizationId: actor.organizationId, propertyId: null };
    }
    case 'TENANT': {
      // Party record — flat own-org OR lease-linked reachability (PII stays
      // with the capturing org; managers reach it once a lease exists).
      const row = await db.tenant.findFirst({
        where: { id: entityId, ...tenantScopeWhere(actor) },
        select: { organizationId: true },
      });
      if (!row) throw new RouteError(404, 'Tenant not found');
      return { organizationId: row.organizationId, propertyId: null };
    }
    case 'LEASE': {
      const row = await db.lease.findFirst({
        where: { id: entityId, property: propertyScopeWhere(actor) },
        select: { organizationId: true, propertyId: true },
      });
      if (!row) throw new RouteError(404, 'Lease not found');
      return { organizationId: row.organizationId, propertyId: row.propertyId };
    }
    case 'APPLICATION': {
      const row = await db.rentalApplication.findFirst({
        where: { id: entityId, property: propertyScopeWhere(actor) },
        select: { organizationId: true, propertyId: true },
      });
      if (!row) throw new RouteError(404, 'Application not found');
      return { organizationId: row.organizationId, propertyId: row.propertyId };
    }
    case 'WORK_ORDER': {
      // Quotes / completion proof — property child (plan-slice-3 §3).
      const row = await db.workOrder.findFirst({
        where: { id: entityId, property: propertyScopeWhere(actor) },
        select: { organizationId: true, propertyId: true },
      });
      if (!row) throw new RouteError(404, 'Work order not found');
      return { organizationId: row.organizationId, propertyId: row.propertyId };
    }
    case 'INSPECTION': {
      // Evidence photos / reports — property child (plan-slice-3 §3).
      const row = await db.inspection.findFirst({
        where: { id: entityId, property: propertyScopeWhere(actor) },
        select: { organizationId: true, propertyId: true },
      });
      if (!row) throw new RouteError(404, 'Inspection not found');
      return { organizationId: row.organizationId, propertyId: row.propertyId };
    }
    default:
      throw new RouteError(400, `Unsupported entity type: ${entityType}`);
  }
}

/**
 * Fetch a document by id and re-resolve its entity for THIS actor.
 * Out-of-scope / unknown-entity rows fall back to own-org visibility.
 */
/**
 * Media lifecycle — when the LAST row referencing a Cloudinary asset goes
 * away, remove the cloud file too (best-effort; shared storageKeys — e.g. a
 * unit photo assigned from the property gallery — are only destroyed once
 * no document AND no version row still points at them). Object-storage /
 * legacy keys are left alone.
 */
export async function destroyIfOrphaned(storageKey: string): Promise<void> {
  if (!/^https?:\/\//.test(storageKey)) return;
  const publicId = publicIdFromUrl(storageKey);
  if (!publicId) return;
  try {
    const remainingDocs = await db.propertyDocument.count({ where: { storageKey } });
    if (remainingDocs > 0) return;
    const remainingVersions = await db.documentVersion.count({ where: { storageKey } });
    if (remainingVersions > 0) return;
    await destroyImage(publicId);
  } catch {
    /* best-effort — an orphaned asset never fails the caller's delete */
  }
}

async function requireScopedDocument(actor: ScopeActor, id: string) {
  const doc = await db.propertyDocument.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      entityType: true,
      entityId: true,
      propertyId: true,
      kind: true,
      isCover: true,
      version: true,
      storageKey: true,
    },
  });
  if (!doc) throw new RouteError(404, 'Document not found');

  let resolved: ResolvedEntity | null = null;
  try {
    resolved = await resolveDocumentEntity(actor, doc.entityType, doc.entityId);
  } catch (err) {
    // 404 → entity out of scope or gone; other statuses (400 unsupported)
    // also land in the own-org fallback below.
    if (!(err instanceof RouteError)) throw err;
  }

  if (resolved) {
    if (resolved.organizationId !== doc.organizationId) throw new RouteError(404, 'Document not found');
    return doc;
  }
  if (doc.organizationId === actor.organizationId) return doc;
  throw new RouteError(404, 'Document not found');
}

/** Single cover winner per (entity, kind=PHOTO) — transactional. */
async function clearOtherCovers(
  tx: Prisma.TransactionClient,
  doc: { entityType: DocumentEntityType; entityId: string },
  keepId: string,
): Promise<void> {
  await tx.propertyDocument.updateMany({
    where: {
      entityType: doc.entityType,
      entityId: doc.entityId,
      kind: 'PHOTO',
      isCover: true,
      id: { not: keepId },
    },
    data: { isCover: false },
  });
}

// ── operations ────────────────────────────────────────────────────────────────

export async function listDocuments(actor: ScopeActor, opts: { entityType?: string; entityId?: string }) {
  const entityType = opts.entityType;
  const entityId = opts.entityId;
  if (!entityType || !entityId) throw new RouteError(400, 'entityType and entityId are required');
  if (!DOCUMENT_ENTITY_TYPES.includes(entityType as DocumentEntityType)) {
    throw new RouteError(400, 'Unsupported entity type');
  }
  const resolved = await resolveDocumentEntity(actor, entityType as DocumentEntityType, entityId);
  return db.propertyDocument.findMany({
    where: { entityType: entityType as DocumentEntityType, entityId, organizationId: resolved.organizationId },
    include: DOCUMENT_INCLUDE,
    orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function createDocument(actor: ScopeActor, input: Raw) {
  const entityType = str(input.entityType);
  if (!entityType || !DOCUMENT_ENTITY_TYPES.includes(entityType as DocumentEntityType)) {
    throw new RouteError(400, 'Unsupported entity type');
  }
  const entityId = str(input.entityId);
  if (!entityId) throw new RouteError(400, 'entityId is required');
  const kind = str(input.kind);
  if (!kind || !DOCUMENT_KIND_VALUES.includes(kind as DocumentKind)) throw new RouteError(400, 'Invalid document kind');
  const storageKey = str(input.storageKey);
  if (!storageKey) throw new RouteError(400, 'storageKey is required');
  const fileName = str(input.fileName) ?? storageKey.split('/').filter(Boolean).pop();
  if (!fileName) throw new RouteError(400, 'fileName is required');

  const resolved = await resolveDocumentEntity(actor, entityType as DocumentEntityType, entityId);
  const caption = str(input.caption) ?? null;
  const sortOrder = intOrNull(input.sortOrder, 'sortOrder');
  const isCover = boolOrNull(input.isCover, 'isCover') ?? false;
  const mimeType = str(input.mimeType) ?? null;
  const sizeBytes = intOrNull(input.sizeBytes, 'sizeBytes');

  try {
    const doc = await db.$transaction(async (tx) => {
      const created = await tx.propertyDocument.create({
        data: {
          organizationId: resolved.organizationId,
          propertyId: resolved.propertyId,
          entityType: entityType as DocumentEntityType,
          entityId,
          kind: kind as DocumentKind,
          storageKey,
          fileName,
          mimeType,
          sizeBytes,
          caption,
          ...(sortOrder === null ? {} : { sortOrder }),
          isCover,
        },
        include: DOCUMENT_INCLUDE,
      });
      // Baseline version row so the history chain starts at v1.
      await tx.documentVersion.create({
        data: {
          documentId: created.id,
          version: created.version,
          storageKey,
          fileName,
          mimeType,
          sizeBytes,
          uploadedBy: actor.userId,
        },
      });
      if (created.isCover && created.kind === 'PHOTO') await clearOtherCovers(tx, created, created.id);
      // Refetch so the included version history reflects the baseline row
      // created above (the create-result include ran before it).
      return tx.propertyDocument.findUniqueOrThrow({ where: { id: created.id }, include: DOCUMENT_INCLUDE });
    });
    await auditLog(
      actor,
      'DOCUMENT',
      'document.upload',
      doc.id,
      { entityType, entityId, kind, fileName },
      resolved.organizationId,
    );
    return doc;
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, 'Document already exists');
    throw err;
  }
}

export async function updateDocument(actor: ScopeActor, id: string, input: Raw) {
  const doc = await requireScopedDocument(actor, id);

  const data: Record<string, unknown> = {};
  if ('caption' in input) data.caption = str(input.caption) ?? null;
  if ('sortOrder' in input) {
    const sortOrder = intOrNull(input.sortOrder, 'sortOrder');
    if (sortOrder === null) throw new RouteError(400, 'sortOrder is required');
    data.sortOrder = sortOrder;
  }
  if ('isCover' in input) {
    const isCover = boolOrNull(input.isCover, 'isCover');
    if (isCover === null) throw new RouteError(400, 'isCover is required');
    if (isCover && doc.kind !== 'PHOTO') throw new RouteError(400, 'Only photos can be the cover');
    data.isCover = isCover;
  }
  if (Object.keys(data).length === 0) throw new RouteError(400, 'No updatable fields');

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.propertyDocument.updateMany({
      where: { id: doc.id, organizationId: doc.organizationId },
      data: data as Prisma.PropertyDocumentUpdateManyMutationInput,
    });
    if (result.count === 0) throw new RouteError(404, 'Document not found');
    if (data.isCover === true && doc.kind === 'PHOTO') {
      await clearOtherCovers(tx, { entityType: doc.entityType, entityId: doc.entityId }, doc.id);
    }
    return tx.propertyDocument.findUniqueOrThrow({ where: { id: doc.id }, include: DOCUMENT_INCLUDE });
  });
  await auditLog(actor, 'DOCUMENT', 'document.update', doc.id, { fields: Object.keys(data) }, doc.organizationId);
  return updated;
}

export async function deleteDocument(actor: ScopeActor, id: string) {
  const doc = await requireScopedDocument(actor, id);
  const result = await db.propertyDocument.deleteMany({
    where: { id: doc.id, organizationId: doc.organizationId },
  });
  if (result.count === 0) throw new RouteError(404, 'Document not found');
  // Losing the cover: promote nothing — the gallery simply has no cover
  // until someone sets one.
  await auditLog(actor, 'DOCUMENT', 'document.delete', doc.id, { kind: doc.kind }, doc.organizationId);
  // Media lifecycle: destroy the cloud asset once nothing references it.
  await destroyIfOrphaned(doc.storageKey);
  return { deleted: true };
}

/** Append-only version chain: parent flips to the latest, history stays. */
export async function createDocumentVersion(actor: ScopeActor, id: string, input: Raw) {
  const doc = await requireScopedDocument(actor, id);
  const storageKey = str(input.storageKey);
  if (!storageKey) throw new RouteError(400, 'storageKey is required');
  const fileName = str(input.fileName) ?? storageKey.split('/').filter(Boolean).pop();
  if (!fileName) throw new RouteError(400, 'fileName is required');
  const mimeType = str(input.mimeType) ?? null;
  const sizeBytes = intOrNull(input.sizeBytes, 'sizeBytes');

  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.propertyDocument.findUniqueOrThrow({
        where: { id: doc.id },
        select: { version: true },
      });
      const nextVersion = current.version + 1;
      await tx.propertyDocument.updateMany({
        where: { id: doc.id, organizationId: doc.organizationId },
        data: { storageKey, fileName, mimeType, sizeBytes, version: nextVersion },
      });
      await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          version: nextVersion,
          storageKey,
          fileName,
          mimeType,
          sizeBytes,
          uploadedBy: actor.userId,
        },
      });
      return tx.propertyDocument.findUniqueOrThrow({ where: { id: doc.id }, include: DOCUMENT_INCLUDE });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, 'Version already exists — reload and retry');
    throw err;
  }
}
