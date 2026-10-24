/**
 * Ownership domain service — owner-party directory + ownership rows
 * (plan-slice-1 §3.3).
 *
 * Rules:
 * - Owner parties are a FLAT per-org directory (`organizationId = actor`).
 * - An ownership row's `organizationId` = the property's portfolio org
 *   (child rule). Attaching therefore requires the party to live in the
 *   property's portfolio-org directory → parties of other orgs are rejected.
 * - Writes are PORTFOLIO-SIDE ONLY (recording legal ownership is an owner
 *   act); reads flow through the property scope (managed orgs may view).
 * - XOR: exactly one of propertyId/unitId — property-level rows are created
 *   via the property route, unit-level via `POST /api/units/[id]/ownership`.
 * - `sharePercent` across ACTIVE rows in one container (property or unit)
 *   may never exceed 100 → 400.
 */

import type { OwnerPartyType, Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { decryptFieldOutput, encryptFieldInput } from '@/lib/crypto-field';
import { auditLog } from './audit';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';

type Raw = Record<string, unknown>;

const PARTY_TYPES: OwnerPartyType[] = ['PERSON', 'COMPANY', 'ASSOCIATION', 'ORGANIZATION'];
const OWNER_ID_TYPES = ['NATIONAL_ID', 'PASSPORT', 'ALIEN_ID', 'REG_NO'] as const;

// ── helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function numOrNull(v: unknown, field: string): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new RouteError(400, `${field} must be a number`);
  return n;
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

function isFkViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2003';
}

// ── owner parties (flat org directory) ──────────────────────────────────────

export async function listOwnerParties(actor: ScopeActor, opts: { q?: string; propertyId?: string } = {}) {
  // Cross-org read: when the caller can scope the property (arm 2/3),
  // they may read the PORTFOLIO org's party directory — needed to fill the
  // owner-party picker when a manager proposes an agreement. Own-org list
  // otherwise.
  let organizationId = actor.organizationId;
  if (opts.propertyId) {
    const property = await db.property.findFirst({
      where: { id: opts.propertyId, ...propertyScopeWhere(actor) },
      select: { portfolioOrganizationId: true },
    });
    if (!property) throw new RouteError(404, 'Property not found');
    organizationId = property.portfolioOrganizationId;
  }
  const and: Prisma.PropertyOwnerPartyWhereInput[] = [{ organizationId }];
  const q = opts.q?.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ],
    });
  }
  return db.propertyOwnerParty.findMany({
    where: { AND: and },
    include: { _count: { select: { ownerships: true, managedAgreements: true } } },
    orderBy: { name: 'asc' },
  }).then((rows) =>
    rows.map((p) => ({
      ...p,
      idNumber: decryptFieldOutput(p.idNumber),
      homeAddress: decryptFieldOutput(p.homeAddress),
    }))
  );
}

export async function getOwnerParty(actor: ScopeActor, id: string) {
  const party = await db.propertyOwnerParty.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: {
      ownerships: {
        orderBy: { startsAt: 'desc' },
        include: {
          property: { select: { id: true, name: true, code: true } },
          unit: { select: { id: true, unitRef: true, propertyId: true } },
        },
      },
      _count: { select: { managedAgreements: true } },
    },
  });
  if (!party) throw new RouteError(404, 'Owner party not found');
  return {
    ...party,
    idNumber: decryptFieldOutput(party.idNumber),
    homeAddress: decryptFieldOutput(party.homeAddress),
  };
}

/** Exported for the property-create tx (inline owner on non-landlord create). */
export async function parsePartyInput(raw: Raw, opts: { requireName: boolean }) {
  const data: Record<string, unknown> = {};

  if ('partyType' in raw || opts.requireName) {
    const partyType = str(raw.partyType);
    if (opts.requireName && !partyType) throw new RouteError(400, 'Party type is required');
    if (partyType !== undefined) {
      if (!PARTY_TYPES.includes(partyType as OwnerPartyType)) throw new RouteError(400, 'Invalid party type');
      data.partyType = partyType;
    }
  }

  const name = str(raw.name);
  if (opts.requireName && !name) throw new RouteError(400, 'Name is required');
  if (name !== undefined) {
    if (name.length > 200) throw new RouteError(400, 'Name must be 200 characters or fewer');
    data.name = name;
  }

  if ('email' in raw) {
    const email = str(raw.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RouteError(400, 'Invalid email');
    data.email = email ?? null;
  }
  if ('phone' in raw) data.phone = str(raw.phone) ?? null;
  if ('kraPin' in raw) data.kraPin = str(raw.kraPin) ?? null;
  if ('idType' in raw) {
    const idType = str(raw.idType);
    if (idType !== undefined) {
      if (!(OWNER_ID_TYPES as readonly string[]).includes(idType)) throw new RouteError(400, 'Invalid idType');
      data.idType = idType;
    } else {
      data.idType = null;
    }
  }
  if ('idNumber' in raw) data.idNumber = encryptFieldInput(str(raw.idNumber) ?? null);
  if ('homeAddress' in raw) data.homeAddress = encryptFieldInput(str(raw.homeAddress) ?? null);
  if ('addressLine1' in raw) data.addressLine1 = str(raw.addressLine1) ?? null;
  if ('city' in raw) data.city = str(raw.city) ?? null;
  if ('region' in raw) data.region = str(raw.region) ?? null;
  if ('country' in raw) data.country = str(raw.country) ?? null;
  if ('notes' in raw) data.notes = str(raw.notes) ?? null;

  // Linking a party to a platform org/user (owner portal later) — validate
  // the target exists so bad IDs fail fast with 400, not an FK 500.
  if ('linkedOrganizationId' in raw) {
    const id = str(raw.linkedOrganizationId);
    if (id) {
      const org = await db.organization.findUnique({ where: { id }, select: { id: true } });
      if (!org) throw new RouteError(400, 'Linked organization not found');
      data.linkedOrganizationId = id;
    } else {
      data.linkedOrganizationId = null;
    }
  }
  if ('linkedUserId' in raw) {
    const id = str(raw.linkedUserId);
    if (id) {
      const user = await db.user.findUnique({ where: { id }, select: { id: true } });
      if (!user) throw new RouteError(400, 'Linked user not found');
      data.linkedUserId = id;
    } else {
      data.linkedUserId = null;
    }
  }

  return data;
}

export async function createOwnerParty(actor: ScopeActor, input: Raw) {
  const data = await parsePartyInput(input, { requireName: true });
  try {
    const party = await db.propertyOwnerParty.create({
      data: { ...data, organizationId: actor.organizationId } as Prisma.PropertyOwnerPartyUncheckedCreateInput,
    });
    await auditLog(actor, 'OWNER_PARTY', 'owner_party.create', party.id, { name: party.name });
    return {
      ...party,
      idNumber: decryptFieldOutput(party.idNumber),
      homeAddress: decryptFieldOutput(party.homeAddress),
    };
  } catch (err) {
    if (isFkViolation(err)) throw new RouteError(400, 'Linked organization or user does not exist');
    throw err;
  }
}

export async function updateOwnerParty(actor: ScopeActor, id: string, input: Raw) {
  const existing = await db.propertyOwnerParty.findFirst({
    where: { id, organizationId: actor.organizationId },
    select: { id: true },
  });
  if (!existing) throw new RouteError(404, 'Owner party not found');
  const data = await parsePartyInput(input, { requireName: false });
  if (Object.keys(data).length === 0) return getOwnerParty(actor, id);
  try {
    await db.propertyOwnerParty.updateMany({
      where: { id, organizationId: actor.organizationId },
      data: data as Prisma.PropertyOwnerPartyUpdateManyMutationInput,
    });
  } catch (err) {
    if (isFkViolation(err)) throw new RouteError(400, 'Linked organization or user does not exist');
    throw err;
  }
  await auditLog(actor, 'OWNER_PARTY', 'owner_party.update', id, { fields: Object.keys(data) });
  return getOwnerParty(actor, id);
}

export async function deleteOwnerParty(actor: ScopeActor, id: string) {
  const row = await db.propertyOwnerParty.findFirst({
    where: { id, organizationId: actor.organizationId },
    select: {
      id: true,
      name: true,
      _count: { select: { ownerships: true, managedAgreements: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Owner party not found');
  const blockers: string[] = [];
  if (row._count.ownerships > 0) blockers.push('ownerships');
  if (row._count.managedAgreements > 0) blockers.push('agreements');
  if (blockers.length > 0) {
    throw new RouteError(409, `Owner party “${row.name}” is referenced by ${blockers.join(' and ')} — archive instead`);
  }
  await db.propertyOwnerParty.delete({ where: { id: row.id } });
  await auditLog(actor, 'OWNER_PARTY', 'owner_party.delete', row.id, { name: row.name });
}

// ── ownership rows (property children — portfolio-side writes) ─────────────

/** Sum of ACTIVE non-null shares in one container (property or unit) ≤ 100. */
async function assertShareBudget(
  container: { propertyId?: string; unitId?: string },
  addShare: number | null,
  excludeId?: string,
): Promise<void> {
  if (addShare === null) return;
  const now = new Date();
  const rows = await db.propertyOwnership.findMany({
    where: {
      ...(container.propertyId ? { propertyId: container.propertyId } : { unitId: container.unitId }),
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      sharePercent: { not: null },
    },
    select: { sharePercent: true },
  });
  const total = rows.reduce((sum, r) => sum + Number(r.sharePercent ?? 0), 0) + addShare;
  if (total > 100) {
    throw new RouteError(400, `Ownership shares would total ${total.toFixed(2).replace(/\.00$/, '')}% — maximum is 100%`);
  }
}

export interface OwnershipWriteOptions {
  /** Property-level (default) vs unit-level row. Exactly one is set. */
  propertyId?: string;
  unitId?: string;
}

export async function createOwnership(
  actor: ScopeActor,
  opts: OwnershipWriteOptions,
  input: Raw,
) {
  // Resolve the parent property and its portfolio org.
  let property: { id: string; portfolioOrganizationId: string };
  if (opts.unitId) {
    const unit = await db.unit.findUnique({
      where: { id: opts.unitId },
      select: { id: true, propertyId: true, unitRef: true, property: { select: { id: true, portfolioOrganizationId: true } } },
    });
    if (!unit) throw new RouteError(404, 'Unit not found');
    await requirePropertyInScope(actor, unit.propertyId);
    property = unit.property;
  } else if (opts.propertyId) {
    property = await requirePropertyInScope(actor, opts.propertyId);
  } else {
    throw new RouteError(400, 'Exactly one of property or unit is required');
  }

  if (property.portfolioOrganizationId !== actor.organizationId) {
    throw new RouteError(403, "Only the property's organization can record ownership");
  }

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

  const sharePercent = numOrNull(input.sharePercent, 'sharePercent');
  if (sharePercent !== null && (sharePercent < 0 || sharePercent > 100)) {
    throw new RouteError(400, 'sharePercent must be between 0 and 100');
  }
  const unitFactor = numOrNull(input.unitFactor, 'unitFactor');
  if (unitFactor !== null && unitFactor < 0) throw new RouteError(400, 'unitFactor must be ≥ 0');

  await assertShareBudget(
    opts.unitId ? { unitId: opts.unitId } : { propertyId: property.id },
    sharePercent,
  );

  try {
    const ownership = await db.propertyOwnership.create({
      data: {
        organizationId: property.portfolioOrganizationId,
        propertyId: opts.unitId ? null : property.id,
        unitId: opts.unitId ?? null,
        ownerPartyId,
        sharePercent,
        unitFactor,
        titleNumber: str(input.titleNumber) ?? null,
        startsAt,
        endsAt,
      },
    });
    await auditLog(
      actor,
      'OWNERSHIP',
      'ownership.create',
      ownership.id,
      { ownerPartyId, sharePercent, unitId: opts.unitId ?? null },
      property.portfolioOrganizationId,
    );
    return ownership;
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, 'This owner already holds an active row on the target');
    throw err;
  }
}

/** Fetch a scoped ownership row (property OR unit path) for mutations. */
async function requireScopedOwnership(actor: ScopeActor, id: string) {
  const row = await db.propertyOwnership.findFirst({
    where: {
      id,
      OR: [
        { property: propertyScopeWhere(actor) },
        { unit: { property: propertyScopeWhere(actor) } },
      ],
    },
    select: { id: true, organizationId: true, propertyId: true, unitId: true, sharePercent: true, startsAt: true, endsAt: true },
  });
  if (!row) throw new RouteError(404, 'Ownership not found');
  return row;
}

export async function updateOwnership(actor: ScopeActor, id: string, input: Raw) {
  const row = await requireScopedOwnership(actor, id);
  if (row.organizationId !== actor.organizationId) {
    throw new RouteError(403, "Only the property's organization can edit ownership");
  }

  const data: Record<string, unknown> = {};
  if ('sharePercent' in input) {
    const sharePercent = numOrNull(input.sharePercent, 'sharePercent');
    if (sharePercent !== null && (sharePercent < 0 || sharePercent > 100)) {
      throw new RouteError(400, 'sharePercent must be between 0 and 100');
    }
    data.sharePercent = sharePercent;
  }
  if ('unitFactor' in input) {
    const unitFactor = numOrNull(input.unitFactor, 'unitFactor');
    if (unitFactor !== null && unitFactor < 0) throw new RouteError(400, 'unitFactor must be ≥ 0');
    data.unitFactor = unitFactor;
  }
  if ('titleNumber' in input) data.titleNumber = str(input.titleNumber) ?? null;

  const startsAt = 'startsAt' in input ? dateOrNull(input.startsAt, 'startsAt') : undefined;
  if (startsAt !== undefined) {
    if (startsAt === null) throw new RouteError(400, 'startsAt is required');
    data.startsAt = startsAt;
  }
  const endsAt = 'endsAt' in input ? dateOrNull(input.endsAt, 'endsAt') : undefined;
  if (endsAt !== undefined) data.endsAt = endsAt;

  // Cross-validate the resulting window (existing values + edits).
  const effStart = (data.startsAt as Date | undefined) ?? row.startsAt;
  const effEnd = 'endsAt' in data ? (data.endsAt as Date | null) : row.endsAt;
  if (effEnd && effEnd <= effStart) throw new RouteError(400, 'endsAt must be after startsAt');

  if ('sharePercent' in input && data.sharePercent != null) {
    const container = row.unitId ? { unitId: row.unitId } : { propertyId: row.propertyId! };
    await assertShareBudget(container, data.sharePercent as number, row.id);
  }

  if (Object.keys(data).length === 0) return db.propertyOwnership.findUnique({ where: { id: row.id } });

  const result = await db.propertyOwnership.updateMany({
    where: { id: row.id, organizationId: row.organizationId },
    data: data as Prisma.PropertyOwnershipUpdateManyMutationInput,
  });
  if (result.count === 0) throw new RouteError(404, 'Ownership not found');
  await auditLog(actor, 'OWNERSHIP', 'ownership.update', row.id, { fields: Object.keys(data) }, row.organizationId);
  return db.propertyOwnership.findUnique({ where: { id: row.id } });
}

export async function deleteOwnership(actor: ScopeActor, id: string) {
  const row = await requireScopedOwnership(actor, id);
  if (row.organizationId !== actor.organizationId) {
    throw new RouteError(403, "Only the property's organization can delete ownership");
  }
  // Hard delete is deliberate (plan §3.3): ownership rows are approvals in
  // motion; AuditLog keeps the history.
  await db.propertyOwnership.delete({ where: { id: row.id } });
  await auditLog(actor, 'OWNERSHIP', 'ownership.delete', row.id, {}, row.organizationId);
}

export async function listPropertyOwnerships(actor: ScopeActor, propertyId: string) {
  await requirePropertyInScope(actor, propertyId);
  return db.propertyOwnership.findMany({
    where: {
      AND: [
        // rows whose container is this property (property-level, or via unit)
        { OR: [{ propertyId }, { unit: { propertyId } }] },
        // and through the parent scope (choke point — never removable)
        { OR: [{ property: propertyScopeWhere(actor) }, { unit: { property: propertyScopeWhere(actor) } }] },
      ],
    },
    include: {
      ownerParty: { select: { id: true, name: true, partyType: true, email: true, phone: true } },
      unit: { select: { id: true, unitRef: true } },
    },
    orderBy: { startsAt: 'desc' },
  });
}
