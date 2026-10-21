/**
 * Management agreements + staff assignments (plan-slice-1 §2.2–2.3, §3.3).
 *
 * Agreements — the dual-entry rule:
 * - The row ALWAYS lives in the portfolio org (`organizationId` = property's
 *   portfolio org) — child-row rule.
 * - Create from either side: owner-side picks any manager; a non-portfolio
 *   actor may only propose where `managementOrganizationId` is THEMSELVES
 *   (the DRAFT lands in the portfolio org's inbox to approve or ignore).
 * - Reads match either side: `{ OR: [{ organizationId }, { managementOrganizationId }] }`.
 * - Approve = portfolio org only (`agreement.approve` is owner-held anyway;
 *   service enforces the org half too). Approval + `startsAt ≤ now ≤ endsAt`
 *   opens scope arm 2 immediately.
 * - End is symmetric (owner OR manager may end); only the owner approves.
 *
 * Staff — row-scope for people (scope arm 3): create/list ride the property
 * scope; revoke flips `isActive=false` (never a hard delete — history stays).
 * Keys: list = `property.read`, create/revoke = `property.update` (the
 * `relationship.*` family is not held by any role template — §2.3's key
 * ride would leave nobody able to assign staff; §3.3's `property.update`
 * decision is what the matrix actually grants).
 */

import { Prisma } from '@workspace/database';
import type { AgreementStatus } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';

type Raw = Record<string, unknown>;

/** Org kinds that may act as the managing side of an agreement. */
export const MANAGER_KINDS = ['PROPERTY_MANAGEMENT', 'MAINTENANCE_COMPANY'] as const;

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function dateOrNull(v: unknown, field: string): Date | null {
  if (v === '' || v === null || v === undefined) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} is not a valid date`);
  return d;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002';
}

const AGREEMENT_INCLUDE = {
  property: { select: { id: true, name: true, code: true, locality: true, portfolioOrganizationId: true } },
  managementOrganization: { select: { id: true, name: true, kind: true } },
  ownerParty: { select: { id: true, name: true, partyType: true } },
} satisfies Prisma.PropertyManagementAgreementInclude;

const eitherSide = (actor: ScopeActor): Prisma.PropertyManagementAgreementWhereInput => ({
  OR: [{ organizationId: actor.organizationId }, { managementOrganizationId: actor.organizationId }],
});

// ── agreements ───────────────────────────────────────────────────────────────

export async function listAgreements(
  actor: ScopeActor,
  opts: { propertyId?: string; status?: string } = {},
) {
  const and: Prisma.PropertyManagementAgreementWhereInput[] = [eitherSide(actor)];
  if (opts.propertyId) and.push({ propertyId: opts.propertyId });
  if (opts.status) and.push({ status: opts.status as AgreementStatus });
  const rows = await db.propertyManagementAgreement.findMany({
    where: { AND: and },
    include: AGREEMENT_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  });
  // Side flag per row: clients gate Approve on portfolio side without
  // needing their own org id.
  return rows.map((r) => ({ ...r, actorIsPortfolioSide: r.organizationId === actor.organizationId }));
}

export async function getAgreement(actor: ScopeActor, id: string) {
  const row = await db.propertyManagementAgreement.findFirst({
    where: { id, ...eitherSide(actor) },
    include: AGREEMENT_INCLUDE,
  });
  if (!row) throw new RouteError(404, 'Agreement not found');
  return { ...row, actorIsPortfolioSide: row.organizationId === actor.organizationId };
}

export interface CreateAgreementOptions {
  /** Set for the nested route: actor must already reach this property. */
  requirePropertyScope?: boolean;
}

export async function createAgreement(actor: ScopeActor, input: Raw, opts: CreateAgreementOptions = {}) {
  const propertyId = str(input.propertyId);
  if (!propertyId) throw new RouteError(400, 'Property is required');

  if (opts.requirePropertyScope) {
    await requirePropertyInScope(actor, propertyId);
  }

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, portfolioOrganizationId: true },
  });
  if (!property) throw new RouteError(404, 'Property not found');

  const ownerSide = property.portfolioOrganizationId === actor.organizationId;

  const managementOrganizationId = str(input.managementOrganizationId);
  if (!managementOrganizationId) throw new RouteError(400, 'Management organization is required');
  if (!ownerSide && managementOrganizationId !== actor.organizationId) {
    throw new RouteError(400, 'You may only propose agreements where your organization is the manager');
  }

  const manager = await db.organization.findUnique({
    where: { id: managementOrganizationId },
    select: { id: true, kind: true, status: true },
  });
  if (!manager || manager.status !== 'ACTIVE') throw new RouteError(400, 'Management organization not found or inactive');
  if (!manager.kind || !MANAGER_KINDS.includes(manager.kind as (typeof MANAGER_KINDS)[number])) {
    throw new RouteError(400, 'That organization kind cannot manage properties');
  }

  // ownerPartyId is required by the schema and must sit in the PROPERTY's
  // portfolio-org directory (child rule — the owner's own party records).
  const ownerPartyId = str(input.ownerPartyId);
  if (!ownerPartyId) throw new RouteError(400, 'Owner party is required');
  const party = await db.propertyOwnerParty.findFirst({
    where: { id: ownerPartyId },
    select: { id: true, organizationId: true },
  });
  if (!party || party.organizationId !== property.portfolioOrganizationId) {
    throw new RouteError(400, "Owner party not found in this property's organization");
  }

  const startsAt = dateOrNull(input.startsAt, 'startsAt') ?? new Date();
  const endsAt = dateOrNull(input.endsAt, 'endsAt');
  if (endsAt && endsAt <= startsAt) throw new RouteError(400, 'endsAt must be after startsAt');

  const scope =
    input.scope && typeof input.scope === 'object' && !Array.isArray(input.scope)
      ? (input.scope as Prisma.InputJsonValue)
      : undefined;

  try {
    const agreement = await db.propertyManagementAgreement.create({
      data: {
        organizationId: property.portfolioOrganizationId,
        propertyId: property.id,
        managementOrganizationId,
        ownerPartyId,
        status: 'DRAFT',
        startsAt,
        endsAt,
        scope,
      },
      include: AGREEMENT_INCLUDE,
    });
    await auditLog(
      actor,
      'AGREEMENT',
      'agreement.create',
      agreement.id,
      { propertyId: property.id, managementOrganizationId, proposedBy: actor.organizationId },
      property.portfolioOrganizationId,
    );
    return { ...agreement, actorIsPortfolioSide: ownerSide };
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, 'Agreement already exists');
    throw err;
  }
}

async function requireScopedAgreement(actor: ScopeActor, id: string) {
  const row = await db.propertyManagementAgreement.findFirst({
    where: { id, ...eitherSide(actor) },
    select: { id: true, organizationId: true, managementOrganizationId: true, status: true, startsAt: true, endsAt: true },
  });
  if (!row) throw new RouteError(404, 'Agreement not found');
  return row;
}

export async function updateAgreement(actor: ScopeActor, id: string, input: Raw) {
  const row = await requireScopedAgreement(actor, id);
  if (row.status === 'ENDED' || row.status === 'TERMINATED') {
    throw new RouteError(409, 'Closed agreements cannot be edited');
  }
  const isPortfolio = row.organizationId === actor.organizationId;
  if (row.status !== 'DRAFT' && !isPortfolio) {
    throw new RouteError(403, "Only the property's organization can edit an approved agreement");
  }

  const data: Record<string, unknown> = {};
  const startsAt = 'startsAt' in input ? dateOrNull(input.startsAt, 'startsAt') : undefined;
  if (startsAt !== undefined) {
    if (startsAt === null) throw new RouteError(400, 'startsAt is required');
    data.startsAt = startsAt;
  }
  const endsAt = 'endsAt' in input ? dateOrNull(input.endsAt, 'endsAt') : undefined;
  if (endsAt !== undefined) data.endsAt = endsAt;
  if ('scope' in input) {
    data.scope =
      input.scope && typeof input.scope === 'object' && !Array.isArray(input.scope)
        ? (input.scope as Prisma.InputJsonValue)
        : Prisma.JsonNull;
  }

  const effStart = (data.startsAt as Date | undefined) ?? row.startsAt;
  const effEnd = 'endsAt' in data ? (data.endsAt as Date | null) : row.endsAt;
  if (effEnd && effEnd <= effStart) throw new RouteError(400, 'endsAt must be after startsAt');

  if (Object.keys(data).length === 0) return getAgreement(actor, id);

  const result = await db.propertyManagementAgreement.updateMany({
    where: { id: row.id, organizationId: row.organizationId },
    data: data as Prisma.PropertyManagementAgreementUpdateManyMutationInput,
  });
  if (result.count === 0) throw new RouteError(404, 'Agreement not found');
  await auditLog(actor, 'AGREEMENT', 'agreement.update', row.id, { fields: Object.keys(data) }, row.organizationId);
  return getAgreement(actor, id);
}

export async function approveAgreement(actor: ScopeActor, id: string) {
  // Either-side fetch first so outsiders get 404 (no existence leak), then
  // the portfolio-only half → 403 (row already visible to this actor).
  const row = await requireScopedAgreement(actor, id);
  if (row.organizationId !== actor.organizationId) {
    throw new RouteError(403, "Only the property's organization can approve an agreement");
  }
  if (row.status !== 'DRAFT') throw new RouteError(409, `Only draft agreements can be approved (status: ${row.status})`);
  if (row.endsAt && row.endsAt <= row.startsAt) throw new RouteError(400, 'endsAt must be after startsAt');

  const result = await db.propertyManagementAgreement.updateMany({
    where: { id: row.id, organizationId: row.organizationId, status: 'DRAFT' },
    data: { status: 'ACTIVE' },
  });
  if (result.count === 0) throw new RouteError(409, 'Agreement changed status — reload and retry');
  await auditLog(actor, 'AGREEMENT', 'agreement.approve', row.id, {}, row.organizationId);
  return getAgreement(actor, id);
}

export async function endAgreement(actor: ScopeActor, id: string) {
  const row = await requireScopedAgreement(actor, id);
  if (row.status !== 'ACTIVE' && row.status !== 'SUSPENDED') {
    throw new RouteError(409, `Only active or suspended agreements can be ended (status: ${row.status})`);
  }
  // Symmetric end: either side may end. Scope arm 2 keys off status=ACTIVE,
  // so the flip alone closes access; endsAt records the actual end moment.
  const result = await db.propertyManagementAgreement.updateMany({
    where: { id: row.id, organizationId: row.organizationId, status: row.status },
    data: { status: 'ENDED', endsAt: new Date() },
  });
  if (result.count === 0) throw new RouteError(409, 'Agreement changed status — reload and retry');
  await auditLog(actor, 'AGREEMENT', 'agreement.end', row.id, { endedBy: actor.organizationId }, row.organizationId);
  return getAgreement(actor, id);
}

/** Org directory for the manager picker — only kinds that can manage. */
export async function listManagementOrgCandidates(actor: ScopeActor) {
  return db.organization.findMany({
    where: {
      id: { not: actor.organizationId },
      status: 'ACTIVE',
      kind: { in: [...MANAGER_KINDS] },
    },
    select: { id: true, name: true, kind: true },
    orderBy: { name: 'asc' },
  });
}

// ── staff assignments (scope arm 3) ──────────────────────────────────────────

const STAFF_INCLUDE = {
  user: { select: { id: true, displayName: true, email: true } },
} satisfies Prisma.PropertyStaffAssignmentInclude;

export async function listStaff(actor: ScopeActor, propertyId: string) {
  await requirePropertyInScope(actor, propertyId);
  return db.propertyStaffAssignment.findMany({
    where: { propertyId, property: propertyScopeWhere(actor) },
    include: STAFF_INCLUDE,
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createStaff(actor: ScopeActor, propertyId: string, input: Raw) {
  const property = await requirePropertyInScope(actor, propertyId);

  const userId = str(input.userId);
  if (!userId) throw new RouteError(400, 'User is required');
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new RouteError(400, 'User not found');

  const duplicate = await db.propertyStaffAssignment.findFirst({
    where: { propertyId, userId, isActive: true },
    select: { id: true },
  });
  if (duplicate) throw new RouteError(409, 'This user already has an active assignment on the property');

  const startsAt = dateOrNull(input.startsAt, 'startsAt') ?? new Date();
  const endsAt = dateOrNull(input.endsAt, 'endsAt');
  if (endsAt && endsAt <= startsAt) throw new RouteError(400, 'endsAt must be after startsAt');

  try {
    const assignment = await db.propertyStaffAssignment.create({
      data: {
        organizationId: property.portfolioOrganizationId,
        propertyId,
        userId,
        title: str(input.title) ?? null,
        startsAt,
        endsAt,
        assignedBy: actor.userId,
      },
      include: STAFF_INCLUDE,
    });
    await auditLog(
      actor,
      'STAFF_ASSIGNMENT',
      'staff.assign',
      assignment.id,
      { userId, title: assignment.title },
      property.portfolioOrganizationId,
    );
    return assignment;
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, 'Assignment already exists');
    throw err;
  }
}

export async function revokeStaff(actor: ScopeActor, assignmentId: string) {
  const row = await db.propertyStaffAssignment.findFirst({
    where: { id: assignmentId, property: propertyScopeWhere(actor) },
    select: { id: true, organizationId: true, isActive: true },
  });
  if (!row) throw new RouteError(404, 'Assignment not found');
  if (row.isActive) {
    const result = await db.propertyStaffAssignment.updateMany({
      where: { id: row.id, organizationId: row.organizationId, isActive: true },
      data: { isActive: false },
    });
    if (result.count === 0) throw new RouteError(404, 'Assignment not found');
    await auditLog(actor, 'STAFF_ASSIGNMENT', 'staff.revoke', row.id, {}, row.organizationId);
  }
  return db.propertyStaffAssignment.findUnique({ where: { id: row.id }, include: STAFF_INCLUDE });
}
