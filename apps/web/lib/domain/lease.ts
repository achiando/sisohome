/**
 * Lease domain service (plan-slice-2 §2.3) — the strictest logic in the wave.
 *
 * Leases ARE property children: scope THROUGH the parent and key mutations
 * by the row's OWN organizationId (the property's portfolio org — a PM
 * drafting a lease under an agreement still writes it under the owner's
 * portfolio, matching the property-child rule).
 *
 * Overlap rule: a serializable in-transaction check — Prisma cannot express
 * a partial unique over (unit × date-range), so create/amend SELECT the
 * occupying leases' LeaseUnits for the same units with range overlap and
 * 409 listing the conflicts. Occupancy truth also drives the Unit.status
 * cache via `recomputeUnitStatus` on approve/terminate/close/cancel.
 */

import { Prisma } from '@workspace/database';
import type { BillingFrequency, LeasePartyRelationship, LeaseTenureType } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import {
  propertyScopeWhere,
  requirePropertyInScope,
  type ScopeActor,
} from './property-scope';
import { tenantScopeWhere } from './tenant';
import { recomputeUnitStatus } from './unit';
import {
  LEASE_PARTY_RELATIONSHIP_VALUES,
  LEASE_STATUS_VALUES,
  LEASE_TENURE_VALUES,
  BILLING_FREQUENCY_VALUES,
  LEASE_TRANSITIONS,
  OCCUPYING_STATUSES,
  type LeaseStatusValue,
} from './lease-constants';

type Raw = Record<string, unknown>;
type RawArray = unknown[];

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], field: string): T | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw new RouteError(400, `Invalid ${field}`);
  return v as T;
}

function dateOrNull(v: unknown, field: string): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} must be a valid date`);
  return d;
}

function decOrNull(v: unknown, field: string): Prisma.Decimal | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new RouteError(400, `${field} must be a non-negative number`);
  return new Prisma.Decimal(n.toFixed(2));
}

function intOrNull(v: unknown, field: string): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new RouteError(400, `${field} must be a whole number`);
  return n;
}

function boolOrNull(v: unknown): boolean | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 'false') return v === 'true';
  return null;
}

const MAX_END = new Date('2100-01-01T00:00:00.000Z');

const LEASE_INCLUDE = {
  property: { select: { id: true, name: true } },
  units: { include: { unit: { select: { id: true, unitRef: true, label: true, status: true } } } },
  parties: {
    include: {
      tenant: {
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
          status: true,
          portalStatus: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  renewals: { select: { id: true, status: true, startsAt: true, endsAt: true } },
  renewalOf: { select: { id: true, status: true, startsAt: true, endsAt: true } },
} satisfies Prisma.LeaseInclude;

interface LeaseRow {
  id: string;
  organizationId: string;
  propertyId: string;
  status: LeaseStatusValue;
  startsAt: Date;
  endsAt: Date | null;
}

async function requireLeaseInScope(actor: ScopeActor, id: string): Promise<LeaseRow> {
  const row = await db.lease.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      status: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!row) throw new RouteError(404, 'Lease not found');
  return row as LeaseRow;
}

/**
 * Serializable overlap check — MUST run inside the create/amend transaction.
 * `excludeLeaseId` skips the lease being amended.
 */
async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  unitIds: string[],
  startsAt: Date,
  endsAt: Date | null,
  excludeLeaseId?: string,
): Promise<void> {
  if (unitIds.length === 0) return;
  const end = endsAt ?? MAX_END;
  const overlaps = await tx.leaseUnit.findMany({
    where: {
      unitId: { in: unitIds },
      ...(excludeLeaseId ? { leaseId: { not: excludeLeaseId } } : {}),
      lease: {
        status: { in: OCCUPYING_STATUSES },
        startsAt: { lte: end },
        OR: [{ endsAt: null }, { endsAt: { gte: startsAt } }],
      },
    },
    select: {
      unitId: true,
      unit: { select: { unitRef: true } },
      lease: { select: { id: true, leaseRef: true, startsAt: true, endsAt: true } },
    },
  });
  if (overlaps.length === 0) return;
  const refs = [...new Set(overlaps.map((o) => o.unit.unitRef))];
  const windows = [
    ...new Set(
      overlaps.map(
        (o) =>
          `${o.lease.leaseRef ?? o.lease.id.slice(0, 8)} (${o.lease.startsAt.toISOString().slice(0, 10)} → ${
            o.lease.endsAt ? o.lease.endsAt.toISOString().slice(0, 10) : 'open'
          })`,
      ),
    ),
  ].join(', ');
  throw new RouteError(409, `Units already occupied in that range: ${refs.join(', ')} — ${windows}`);
}

interface ParsedUnitRow {
  unitId: string;
  monthlyRent: Prisma.Decimal;
  currency?: string;
  billingFrequency?: BillingFrequency;
  depositAmount?: Prisma.Decimal | null;
  notes?: string | null;
}

async function parseUnits(
  rawUnits: RawArray,
  propertyId: string,
): Promise<ParsedUnitRow[]> {
  if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
    throw new RouteError(400, 'At least one unit is required');
  }
  const parsed: ParsedUnitRow[] = [];
  const seen = new Set<string>();
  for (const entry of rawUnits) {
    if (!entry || typeof entry !== 'object') throw new RouteError(400, 'Invalid unit row');
    const row = entry as Raw;
    const unitId = str(row.unitId);
    if (!unitId) throw new RouteError(400, 'Each unit row needs unitId');
    if (seen.has(unitId)) throw new RouteError(400, 'Duplicate unit in lease');
    seen.add(unitId);
    const monthlyRent = decOrNull(row.monthlyRent, 'monthlyRent');
    if (monthlyRent === undefined || monthlyRent === null) {
      throw new RouteError(400, 'monthlyRent is required for each unit');
    }
    const currency = str(row.currency);
    const billingFrequency = pick(row.billingFrequency, BILLING_FREQUENCY_VALUES, 'billingFrequency') as BillingFrequency | undefined;
    const depositAmount = decOrNull(row.depositAmount, 'depositAmount');
    const notes = str(row.notes) ?? null;
    parsed.push({
      unitId,
      monthlyRent,
      ...(currency ? { currency } : {}),
      ...(billingFrequency ? { billingFrequency } : {}),
      ...(depositAmount === undefined ? {} : { depositAmount }),
      ...(notes ? { notes } : {}),
    });
  }
  // Every unit must belong to the lease's ONE property (cross-property → 400).
  const rows = await db.unit.findMany({
    where: { id: { in: parsed.map((p) => p.unitId) } },
    select: { id: true, propertyId: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r.propertyId]));
  for (const p of parsed) {
    const pid = byId.get(p.unitId);
    if (!pid) throw new RouteError(404, `Unit not found: ${p.unitId}`);
    if (pid !== propertyId) throw new RouteError(400, 'All lease units must belong to the same property');
  }
  return parsed;
}

interface ParsedPartyRow {
  tenantId: string;
  relationship: LeasePartyRelationship;
  shareOfRent?: Prisma.Decimal | null;
  notes?: string | null;
}

async function parseParties(rawParties: RawArray, actor: ScopeActor): Promise<ParsedPartyRow[]> {
  if (!Array.isArray(rawParties) || rawParties.length === 0) {
    throw new RouteError(400, 'At least one tenant party is required');
  }
  const parsed: ParsedPartyRow[] = [];
  const seen = new Set<string>();
  for (const entry of rawParties) {
    if (!entry || typeof entry !== 'object') throw new RouteError(400, 'Invalid party row');
    const row = entry as Raw;
    const tenantId = str(row.tenantId);
    if (!tenantId) throw new RouteError(400, 'Each party row needs tenantId');
    if (seen.has(tenantId)) throw new RouteError(400, 'Duplicate tenant on lease');
    seen.add(tenantId);
    const relationship = (pick(row.relationship, LEASE_PARTY_RELATIONSHIP_VALUES, 'relationship') ?? 'PRIMARY') as LeasePartyRelationship;
    const shareOfRent = decOrNull(row.shareOfRent, 'shareOfRent');
    const notes = str(row.notes) ?? null;
    parsed.push({
      tenantId,
      relationship,
      ...(shareOfRent === undefined ? {} : { shareOfRent }),
      ...(notes ? { notes } : {}),
    });
  }
  if (!parsed.some((p) => p.relationship === 'PRIMARY')) {
    throw new RouteError(400, 'A PRIMARY tenant is required');
  }
  const tenants = await db.tenant.findMany({
    where: { id: { in: parsed.map((p) => p.tenantId) }, ...tenantScopeWhere(actor) },
    select: { id: true },
  });
  const ok = new Set(tenants.map((t) => t.id));
  for (const p of parsed) {
    if (!ok.has(p.tenantId)) throw new RouteError(404, `Tenant not found: ${p.tenantId}`);
  }
  return parsed;
}

function parseTermFields(raw: Raw): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const leaseRef = str(raw.leaseRef);
  if (leaseRef !== undefined) data.leaseRef = leaseRef;
  const tenureType = pick(raw.tenureType, LEASE_TENURE_VALUES, 'tenureType') as LeaseTenureType | undefined;
  if (tenureType !== undefined) data.tenureType = tenureType;
  const currency = str(raw.currency);
  if (currency !== undefined) {
    if (currency.length !== 3) throw new RouteError(400, 'currency must be a 3-letter code');
    data.currency = currency.toUpperCase();
  }
  const billingFrequency = pick(raw.billingFrequency, BILLING_FREQUENCY_VALUES, 'billingFrequency') as BillingFrequency | undefined;
  if (billingFrequency !== undefined) data.billingFrequency = billingFrequency;
  const paymentDueDay = intOrNull(raw.paymentDueDay, 'paymentDueDay');
  if (paymentDueDay !== null && paymentDueDay !== undefined) {
    if (paymentDueDay < 1 || paymentDueDay > 31) throw new RouteError(400, 'paymentDueDay must be 1–31');
    data.paymentDueDay = paymentDueDay;
  }
  const depositMonths = decOrNull(raw.depositMonths, 'depositMonths');
  if (depositMonths !== undefined) data.depositMonths = depositMonths;
  const noticeDays = intOrNull(raw.noticeDays, 'noticeDays');
  if (noticeDays !== null && noticeDays !== undefined) data.noticeDays = noticeDays;
  const autoRenew = boolOrNull(raw.autoRenew);
  if (autoRenew !== null) data.autoRenew = autoRenew;
  const terms = str(raw.terms);
  if (terms !== undefined) data.terms = terms;
  return data;
}

function assertDates(startsAt: Date, endsAt: Date | null | undefined): void {
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new RouteError(400, 'endsAt must be after startsAt');
  }
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function listLeases(
  actor: ScopeActor,
  filters: { status?: string; propertyId?: string; expiringInDays?: string } = {},
) {
  const where: Prisma.LeaseWhereInput = { property: propertyScopeWhere(actor) };
  const status = pick(filters.status, LEASE_STATUS_VALUES, 'status');
  if (status) where.status = status;
  if (filters.propertyId) {
    await requirePropertyInScope(actor, filters.propertyId);
    where.propertyId = filters.propertyId;
  }
  const days = filters.expiringInDays ? intOrNull(filters.expiringInDays, 'expiringInDays') : null;
  if (days !== null && days !== undefined) {
    if (days < 1) throw new RouteError(400, 'expiringInDays must be at least 1');
    const until = new Date(Date.now() + days * 86_400_000);
    where.endsAt = { lte: until, gte: new Date() };
  }
  return db.lease.findMany({
    where,
    include: LEASE_INCLUDE,
    orderBy: [{ startsAt: 'desc' }],
  });
}

export async function getLease(
  actor: ScopeActor,
  id: string,
  opts: { includeTenantPii?: boolean } = {},
) {
  const row = await db.lease.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    include: {
      ...LEASE_INCLUDE,
      parties: {
        include: {
          tenant: opts.includeTenantPii
            ? true
            : {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  phone: true,
                  status: true,
                  portalStatus: true,
                },
              },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  });
  if (!row) throw new RouteError(404, 'Lease not found');
  // Documents are polymorphic (entityType=LEASE) with no back-relation on the
  // Lease model — fetch them by entity id directly.
  const documents = await db.propertyDocument.findMany({
    where: { entityType: 'LEASE', entityId: id, organizationId: row.organizationId },
    orderBy: [{ isCover: 'desc' }, { createdAt: 'desc' }],
  });
  return { ...row, documents };
}

// ── create ───────────────────────────────────────────────────────────────────

export async function createLease(actor: ScopeActor, raw: Raw) {
  const propertyId = str(raw.propertyId);
  if (!propertyId) throw new RouteError(400, 'propertyId is required');
  const property = await requirePropertyInScope(actor, propertyId);

  const startsAt = dateOrNull(raw.startsAt, 'startsAt');
  if (!startsAt) throw new RouteError(400, 'startsAt is required');
  const endsAt = dateOrNull(raw.endsAt, 'endsAt') ?? null;
  assertDates(startsAt, endsAt);

  const units = await parseUnits(raw.units as RawArray ?? [], propertyId);
  const parties = await parseParties(raw.parties as RawArray ?? [], actor);

  const status = pick(raw.status, ['DRAFT', 'PENDING_APPROVAL'] as const, 'status') ?? 'DRAFT';
  const terms = parseTermFields(raw);

  try {
    const lease = await db.$transaction(
      async (tx) => {
        await assertNoOverlap(
          tx,
          units.map((u) => u.unitId),
          startsAt,
          endsAt,
        );
        return tx.lease.create({
          data: {
            organizationId: property.portfolioOrganizationId,
            propertyId,
            status,
            startsAt,
            endsAt,
            ...terms,
            units: { create: units.map((u) => ({ ...u, organizationId: property.portfolioOrganizationId })) },
            parties: { create: parties.map((p) => ({ ...p, organizationId: property.portfolioOrganizationId })) },
          },
          include: LEASE_INCLUDE,
        });
      },
      // Remote dev DB can exceed the 5s default under load.
      { timeout: 20_000 },
    );
    await auditLog(
      actor,
      'LEASE',
      'lease.create',
      lease.id,
      { propertyId, status, units: units.length, parties: parties.length },
      property.portfolioOrganizationId,
    );
    return lease;
  } catch (err) {
    if (
      typeof err === 'object' && err !== null && 'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      throw new RouteError(409, 'Lease reference already exists');
    }
    throw err;
  }
}

// ── update (amendment) ───────────────────────────────────────────────────────

export async function updateLease(actor: ScopeActor, id: string, raw: Raw) {
  const lease = await requireLeaseInScope(actor, id);
  if (['CLOSED', 'CANCELLED', 'TERMINATED'].includes(lease.status)) {
    throw new RouteError(409, `A ${lease.status.toLowerCase()} lease cannot be amended`);
  }

  const data: Record<string, unknown> = {};
  const terms = parseTermFields(raw);
  Object.assign(data, terms);
  if ('noticeDate' in raw) data.noticeDate = dateOrNull(raw.noticeDate, 'noticeDate');

  let startsAt = lease.startsAt;
  let endsAt = lease.endsAt;
  if ('startsAt' in raw) {
    const s = dateOrNull(raw.startsAt, 'startsAt');
    if (!s) throw new RouteError(400, 'startsAt cannot be empty');
    startsAt = s;
    data.startsAt = s;
  }
  if ('endsAt' in raw) {
    endsAt = dateOrNull(raw.endsAt, 'endsAt') ?? null;
    data.endsAt = endsAt;
  }
  assertDates(startsAt, endsAt);

  const wantsUnits = Array.isArray(raw.units);
  const wantsParties = Array.isArray(raw.parties);
  const wantsStatus = raw.status !== undefined;

  if (wantsStatus) {
    const next = pick(raw.status, LEASE_STATUS_VALUES, 'status');
    if (!next) throw new RouteError(400, 'Invalid status');
    const allowed = LEASE_TRANSITIONS[lease.status] ?? [];
    if (!allowed.includes(next)) {
      throw new RouteError(409, `Cannot move a lease from ${lease.status} to ${next}`);
    }
    data.status = next;
  }

  let units: ParsedUnitRow[] | null = null;
  if (wantsUnits) units = await parseUnits(raw.units as RawArray, lease.propertyId);
  let parties: ParsedPartyRow[] | null = null;
  if (wantsParties) parties = await parseParties(raw.parties as RawArray, actor);

  if (Object.keys(data).length === 0 && !units && !parties) {
    throw new RouteError(400, 'No fields to update');
  }

  const updated = await db.$transaction(
    async (tx) => {
    if (units) {
      // Re-run overlap for the new set (own lease excluded — self-overlap is fine).
      await assertNoOverlap(tx, units.map((u) => u.unitId), startsAt, endsAt, lease.id);
      const removed = await tx.leaseUnit.findMany({
        where: { leaseId: lease.id },
        select: { id: true, unitId: true },
      });
      const keep = new Set(units.map((u) => u.unitId));
      const removedIds = removed.filter((r) => !keep.has(r.unitId)).map((r) => r.id);
      if (removedIds.length > 0) await tx.leaseUnit.deleteMany({ where: { id: { in: removedIds } } });
      for (const u of units) {
        const existing = removed.find((r) => r.unitId === u.unitId);
        if (existing) {
          await tx.leaseUnit.update({
            where: { id: existing.id },
            data: {
              monthlyRent: u.monthlyRent,
              ...(u.currency !== undefined ? { currency: u.currency } : {}),
              ...(u.billingFrequency !== undefined ? { billingFrequency: u.billingFrequency } : {}),
              ...(u.depositAmount !== undefined ? { depositAmount: u.depositAmount } : {}),
              ...(u.notes !== undefined ? { notes: u.notes } : {}),
            },
          });
        } else {
          await tx.leaseUnit.create({
            data: { ...u, leaseId: lease.id, organizationId: lease.organizationId },
          });
        }
      }
    }
    if (parties) {
      const existing = await tx.leaseTenant.findMany({ where: { leaseId: lease.id }, select: { id: true, tenantId: true } });
      const keep = new Set(parties.map((p) => p.tenantId));
      const removedIds = existing.filter((r) => !keep.has(r.tenantId)).map((r) => r.id);
      if (removedIds.length > 0) await tx.leaseTenant.deleteMany({ where: { id: { in: removedIds } } });
      for (const p of parties) {
        const row = existing.find((r) => r.tenantId === p.tenantId);
        if (row) {
          await tx.leaseTenant.update({
            where: { id: row.id },
            data: {
              relationship: p.relationship,
              ...(p.shareOfRent !== undefined ? { shareOfRent: p.shareOfRent } : {}),
              ...(p.notes !== undefined ? { notes: p.notes } : {}),
            },
          });
        } else {
          await tx.leaseTenant.create({
            data: { ...p, leaseId: lease.id, organizationId: lease.organizationId },
          });
        }
      }
    }
    if (Object.keys(data).length > 0) {
      await tx.lease.updateMany({
        where: { id, organizationId: lease.organizationId },
        data: data as Prisma.LeaseUpdateManyMutationInput,
      });
    }
    return tx.lease.findUniqueOrThrow({ where: { id }, include: LEASE_INCLUDE });
    },
    // Remote dev DB can exceed the 5s default under load.
    { timeout: 20_000 },
  );

  await auditLog(
    actor,
    'LEASE',
    'lease.update',
    id,
    { fields: Object.keys(data), units: units?.length, parties: parties?.length },
    lease.organizationId,
  );
  return updated;
}

// ── lifecycle actions ────────────────────────────────────────────────────────

async function leaseUnitIds(leaseId: string): Promise<string[]> {
  const rows = await db.leaseUnit.findMany({ where: { leaseId }, select: { unitId: true } });
  return rows.map((r) => r.unitId);
}

export async function approveLease(actor: ScopeActor, id: string, raw?: Raw) {
  const lease = await requireLeaseInScope(actor, id);
  if (lease.status !== 'PENDING_APPROVAL') {
    throw new RouteError(409, 'Only a pending-approval lease can be approved');
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next: LeaseStatusValue = lease.startsAt.getTime() <= today.getTime() ? 'ACTIVE' : 'SCHEDULED';
  const signedAt = raw ? dateOrNull(raw.signedAt, 'signedAt') : undefined;

  const updated = await db.lease.update({
    where: { id },
    data: { status: next, ...(signedAt ? { signedAt } : {}) },
    include: LEASE_INCLUDE,
  });
  await recomputeUnitStatus(await leaseUnitIds(id));
  await auditLog(actor, 'LEASE', 'lease.approve', id, { status: next }, lease.organizationId);
  return updated;
}

export async function cancelLease(actor: ScopeActor, id: string) {
  const lease = await requireLeaseInScope(actor, id);
  if (!['DRAFT', 'PENDING_APPROVAL'].includes(lease.status)) {
    throw new RouteError(409, 'Only a draft or pending lease can be cancelled');
  }
  const updated = await db.lease.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: LEASE_INCLUDE,
  });
  await recomputeUnitStatus(await leaseUnitIds(id));
  await auditLog(actor, 'LEASE', 'lease.cancel', id, {}, lease.organizationId);
  return updated;
}

export async function terminateLease(actor: ScopeActor, id: string, raw?: Raw) {
  const lease = await requireLeaseInScope(actor, id);
  if (!['SCHEDULED', 'ACTIVE', 'ENDING'].includes(lease.status)) {
    throw new RouteError(409, 'Only a scheduled, active or ending lease can be terminated');
  }
  const noticeDate = raw ? dateOrNull(raw.noticeDate, 'noticeDate') : undefined;
  const endsToday = raw ? boolOrNull(raw.endsToday) !== false : true;
  const data: Prisma.LeaseUpdateInput = { status: 'TERMINATED' };
  if (noticeDate) data.noticeDate = noticeDate;
  if (endsToday) data.endsAt = new Date();

  const updated = await db.lease.update({ where: { id }, data, include: LEASE_INCLUDE });
  await recomputeUnitStatus(await leaseUnitIds(id));
  await auditLog(
    actor,
    'LEASE',
    'lease.terminate',
    id,
    { noticeDate: noticeDate?.toISOString() ?? null, endsToday },
    lease.organizationId,
  );
  return updated;
}

export async function closeLease(actor: ScopeActor, id: string) {
  const lease = await requireLeaseInScope(actor, id);
  if (!['SCHEDULED', 'ACTIVE', 'ENDING', 'TERMINATED'].includes(lease.status)) {
    throw new RouteError(409, 'This lease cannot be closed from its current status');
  }
  // Balance check rides the charge domain (slice 4) — until then close is open.
  const updated = await db.lease.update({
    where: { id },
    data: { status: 'CLOSED' },
    include: LEASE_INCLUDE,
  });
  await recomputeUnitStatus(await leaseUnitIds(id));
  await auditLog(actor, 'LEASE', 'lease.close', id, {}, lease.organizationId);
  return updated;
}

export async function renewLease(actor: ScopeActor, id: string, raw: Raw) {
  const old = await requireLeaseInScope(actor, id);
  if (['CANCELLED', 'CLOSED'].includes(old.status)) {
    throw new RouteError(409, `A ${old.status.toLowerCase()} lease cannot be renewed`);
  }
  const startsAt = dateOrNull(raw.startsAt, 'startsAt');
  if (!startsAt) throw new RouteError(400, 'startsAt is required for the renewal');
  const endsAt = dateOrNull(raw.endsAt, 'endsAt') ?? null;
  assertDates(startsAt, endsAt);

  const oldStatus = pick(raw.oldStatus, ['ENDING', 'TERMINATED'] as const, 'oldStatus') ?? 'ENDING';
  const status = pick(raw.status, ['DRAFT', 'PENDING_APPROVAL'] as const, 'status') ?? 'PENDING_APPROVAL';

  const source = await db.lease.findUniqueOrThrow({
    where: { id },
    include: { units: true, parties: true },
  });

  const renewal = await db.$transaction(
    async (tx) => {
      await assertNoOverlap(
        tx,
        source.units.map((u) => u.unitId),
        startsAt,
        endsAt,
        old.id, // the lease being renewed frees its own units for the new window
      );
      const created = await tx.lease.create({
        data: {
          organizationId: old.organizationId,
          propertyId: old.propertyId,
          status,
          tenureType: source.tenureType,
          startsAt,
          endsAt,
          currency: source.currency,
          billingFrequency: source.billingFrequency,
          paymentDueDay: source.paymentDueDay,
          depositMonths: source.depositMonths,
          noticeDays: source.noticeDays,
          autoRenew: source.autoRenew,
          terms: source.terms,
          renewalOfId: old.id,
          units: {
            create: source.units.map((u) => ({
              organizationId: old.organizationId,
              unitId: u.unitId,
              monthlyRent: u.monthlyRent,
              currency: u.currency,
              billingFrequency: u.billingFrequency,
              depositAmount: u.depositAmount,
              notes: u.notes,
            })),
          },
          parties: {
            create: source.parties.map((p) => ({
              organizationId: old.organizationId,
              tenantId: p.tenantId,
              relationship: p.relationship,
              shareOfRent: p.shareOfRent,
              notes: p.notes,
            })),
          },
        },
        include: LEASE_INCLUDE,
      });
      await tx.lease.update({ where: { id: old.id }, data: { status: oldStatus } });
      return created;
    },
    // Remote dev DB can exceed the 5s default under load.
    { timeout: 20_000 },
  );

  await recomputeUnitStatus(await leaseUnitIds(id));
  await auditLog(
    actor,
    'LEASE',
    'lease.renew',
    renewal.id,
    { renewalOf: id, oldStatus },
    old.organizationId,
  );
  return renewal;
}
