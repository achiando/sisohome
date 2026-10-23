/**
 * Unit domain service — buildings, unit types, units (plan-slice-1 §3.2).
 *
 * Scoping: buildings/units are property children → scope THROUGH the parent
 * (`property: propertyScopeWhere`) and key mutations by the row's OWN
 * `organizationId` (portfolio org). Unit types are a flat per-org catalog.
 *
 * Derived occupancy: `Unit.status` is a CACHE — truth comes from active
 * leases (LeaseUnit → Lease window). Every list recomputes occupancy from
 * leases; OCCUPIED/RESERVED are never hand-settable (unit-constants.ts).
 * Unit default fields are templates — changing them never rewrites a live
 * lease or posted charge (property.md §2).
 */

import type {
  Prisma,
  UnitKind,
  UnitStatus,
} from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import {
  propertyScopeWhere,
  requirePropertyInScope,
  type ScopeActor,
} from './property-scope';
import { AREA_UNITS, RENT_FREQUENCIES } from './property-constants';
import { BULK_MAX_RANGE, BULK_MIN_RANGE, IMPORT_MAX_ROWS, UNIT_KINDS, UNIT_MANUAL_STATUSES, UNIT_STATUS_VALUES } from './unit-constants';

type Raw = Record<string, unknown>;

// ── coercion helpers ─────────────────────────────────────────────────────────

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

function intOrNull(v: unknown, field: string): number | null {
  const n = numOrNull(v, field);
  if (n === null) return null;
  if (!Number.isInteger(n)) throw new RouteError(400, `${field} must be a whole number`);
  return n;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], field: string): T | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw new RouteError(400, `Invalid ${field}`);
  return v as T;
}

function strArrayOrNull(v: unknown, field: string): string[] | null {
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v)) throw new RouteError(400, `${field} must be a list`);
  return [...new Set(v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))];
}

/**
 * A unit's/building's amenities list holds only what THAT row adds —
 * anything already recorded on the property (shared: parking, security,
 * borehole…) is stripped on every write (case-insensitive). Returns
 * `undefined` when the payload didn't touch amenities (leave unchanged).
 */
function stripPropertyAmenities(propertyAmenities: string[] | undefined, amenities: unknown): string[] | undefined {
  if (!Array.isArray(amenities)) return undefined;
  const own = new Set((propertyAmenities ?? []).map((a) => a.trim().toLowerCase()));
  return [...new Set(amenities.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))]
    .filter((a) => !own.has(a.toLowerCase()));
}

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002';

// ── occupancy (lease-derived) ────────────────────────────────────────────────

async function occupancyMap(unitIds: string[]): Promise<Set<string>> {
  if (unitIds.length === 0) return new Set();
  const now = new Date();
  const rows = await db.leaseUnit.findMany({
    where: {
      unitId: { in: unitIds },
      lease: {
        status: { in: ['ACTIVE', 'ENDING'] },
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    },
    select: { unitId: true },
  });
  return new Set(rows.map((r) => r.unitId));
}

/** Effective status: lease truth wins over the OCCUPIED cache. */
function effectiveStatus(stored: UnitStatus, occupied: boolean): UnitStatus {
  if (occupied) return 'OCCUPIED';
  if (stored === 'OCCUPIED') return 'VACANT';
  return stored;
}

/**
 * Per-property occupancy from lease truth (portfolio register KPIs).
 * Occupied = units covered by an ACTIVE/ENDING lease inside its window.
 */
export async function occupancyByProperty(
  propertyIds: string[],
): Promise<Map<string, { occupied: number; total: number; rate: number }>> {
  if (propertyIds.length === 0) return new Map();
  const now = new Date();
  const units = await db.unit.findMany({
    where: { propertyId: { in: propertyIds } },
    select: { id: true, propertyId: true },
  });
  if (units.length === 0) {
    return new Map(propertyIds.map((id) => [id, { occupied: 0, total: 0, rate: 0 }]));
  }
  const occupiedRows = await db.leaseUnit.findMany({
    where: {
      unitId: { in: units.map((u) => u.id) },
      lease: {
        status: { in: ['ACTIVE', 'ENDING'] },
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    },
    select: { unitId: true },
  });
  const propertyByUnit = new Map(units.map((u) => [u.id, u.propertyId]));
  const occupied = new Map<string, number>();
  for (const row of occupiedRows) {
    const pid = propertyByUnit.get(row.unitId);
    if (pid) occupied.set(pid, (occupied.get(pid) ?? 0) + 1);
  }
  const total = new Map<string, number>();
  for (const u of units) total.set(u.propertyId, (total.get(u.propertyId) ?? 0) + 1);
  return new Map(
    propertyIds.map((pid) => {
      const t = total.get(pid) ?? 0;
      const o = occupied.get(pid) ?? 0;
      return [pid, { occupied: o, total: t, rate: t > 0 ? Math.round((o / t) * 100) : 0 }];
    }),
  );
}

interface UnitRow extends Prisma.UnitGetPayload<{ include: { building: true } }> {
  occupancy: UnitStatus;
}

async function shapeUnits<T extends { id: string; status: UnitStatus }>(
  rows: T[],
): Promise<(T & { occupancy: UnitStatus })[]> {
  const occupied = await occupancyMap(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, occupancy: effectiveStatus(r.status, occupied.has(r.id)) }));
}

// ── occupants (active leases) ────────────────────────────────────────────────

export interface UnitOccupant {
  tenantId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  relationship: string;
  leaseId: string;
  leaseEndsAt: Date | null;
  monthlyRent: string;
  jointCount: number;
}

/**
 * Active occupant per unit (lease truth, same window as `occupancyMap`).
 * PRIMARY tenant leads; joints are counted. Contact fields are included only
 * when the caller holds `tenant.read` (PII mask, plan §3).
 */
async function occupantMap(
  unitIds: string[],
  includeContact: boolean,
): Promise<Map<string, UnitOccupant>> {
  if (unitIds.length === 0) return new Map();
  const now = new Date();
  const rows = await db.leaseUnit.findMany({
    where: {
      unitId: { in: unitIds },
      lease: {
        status: { in: ['ACTIVE', 'ENDING'] },
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    },
    select: {
      unitId: true,
      monthlyRent: true,
      lease: {
        select: {
          id: true,
          endsAt: true,
          parties: {
            orderBy: [{ relationship: 'asc' }, { createdAt: 'asc' }],
            select: {
              relationship: true,
              tenant: {
                select: {
                  id: true,
                  displayName: true,
                  ...(includeContact ? { email: true, phone: true } : {}),
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const out = new Map<string, UnitOccupant>();
  for (const row of rows) {
    if (out.has(row.unitId)) continue; // earliest lease wins if ever multiple
    const parties = row.lease.parties;
    const primary = parties.find((t) => t.relationship === 'PRIMARY') ?? parties[0];
    if (!primary) continue;
    out.set(row.unitId, {
      tenantId: primary.tenant.id,
      displayName: primary.tenant.displayName,
      email: 'email' in primary.tenant ? (primary.tenant.email as string | null) : undefined,
      phone: 'phone' in primary.tenant ? (primary.tenant.phone as string | null) : undefined,
      relationship: primary.relationship,
      leaseId: row.lease.id,
      leaseEndsAt: row.lease.endsAt,
      monthlyRent: row.monthlyRent.toString(),
      jointCount: Math.max(parties.length - 1, 0),
    });
  }
  return out;
}

/** Active non-rent recurring bills attached directly to a unit (register column). */
export interface UnitBillSummary {
  id: string;
  name: string;
  chargeType: string;
  amount: string;
  currency: string;
  frequency: string;
}

async function billMap(unitIds: string[]): Promise<Map<string, UnitBillSummary[]>> {
  if (unitIds.length === 0) return new Map();
  const rows = await db.chargeSchedule.findMany({
    where: { unitId: { in: unitIds }, isActive: true, chargeType: { not: 'RENT' } },
    select: {
      id: true,
      unitId: true,
      name: true,
      chargeType: true,
      amount: true,
      currency: true,
      frequency: true,
    },
    orderBy: [{ name: 'asc' }],
  });
  const out = new Map<string, UnitBillSummary[]>();
  for (const row of rows) {
    if (!row.unitId) continue;
    const list = out.get(row.unitId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      chargeType: row.chargeType as string,
      amount: row.amount.toString(),
      currency: row.currency,
      frequency: row.frequency as string,
    });
    out.set(row.unitId, list);
  }
  return out;
}

/**
 * Recompute the OCCUPIED/VACANT cache from lease truth for the given units
 * (plan-slice-2 §2.3 — called on lease approve/terminate/close/renew).
 * Manual MAINTENANCE/BLOCKED/RESERVED flags are preserved: only rows whose
 * stored status is VACANT or OCCUPIED are rewritten.
 */
export async function recomputeUnitStatus(unitIds: string[]): Promise<void> {
  const ids = [...new Set(unitIds)].filter(Boolean);
  if (ids.length === 0) return;
  const occupied = await occupancyMap(ids);
  for (const id of ids) {
    await db.unit.updateMany({
      where: { id, status: { in: ['VACANT', 'OCCUPIED'] } },
      data: { status: occupied.has(id) ? 'OCCUPIED' : 'VACANT' },
    });
  }
}

// ── buildings ────────────────────────────────────────────────────────────────

export async function listBuildings(actor: ScopeActor, propertyId: string) {
  await requirePropertyInScope(actor, propertyId);
  return db.building.findMany({
    where: { propertyId, property: propertyScopeWhere(actor) },
    include: { _count: { select: { units: true } } },
    orderBy: { code: 'asc' },
  });
}

interface BuildingInput {
  code: string;
  name?: string | null;
  floors?: number | null;
  description?: string | null;
  yearBuilt?: number | null;
  isActive?: boolean;
  amenities?: string[];
  accountNumber?: string | null;
  waterMeterNumber?: string | null;
  electricityMeterNumber?: string | null;
}

function parseBuildingInput(raw: Raw): BuildingInput {
  const code = str(raw.code);
  if (!code) throw new RouteError(400, 'Building code is required');
  const data: BuildingInput = { code };
  if ('name' in raw) data.name = str(raw.name) ?? null;
  if ('floors' in raw) data.floors = intOrNull(raw.floors, 'floors');
  if ('description' in raw) data.description = str(raw.description) ?? null;
  if ('yearBuilt' in raw) data.yearBuilt = intOrNull(raw.yearBuilt, 'yearBuilt');
  if ('isActive' in raw) data.isActive = raw.isActive !== false;
  // building-level amenities + shared utility accounts (stripped vs property
  // happens in create/update where the property row is loaded)
  if ('amenities' in raw) data.amenities = strArrayOrNull(raw.amenities, 'amenities') ?? [];
  if ('accountNumber' in raw) data.accountNumber = str(raw.accountNumber) ?? null;
  if ('waterMeterNumber' in raw) data.waterMeterNumber = str(raw.waterMeterNumber) ?? null;
  if ('electricityMeterNumber' in raw) data.electricityMeterNumber = str(raw.electricityMeterNumber) ?? null;
  return data;
}

export async function createBuilding(actor: ScopeActor, propertyId: string, input: Raw) {
  const property = await requirePropertyInScope(actor, propertyId);
  const data = parseBuildingInput(input);
  if (data.amenities) data.amenities = stripPropertyAmenities(property.amenities, data.amenities) ?? [];
  try {
    const building = await db.building.create({
      data: { ...data, propertyId, organizationId: property.portfolioOrganizationId },
    });
    await auditLog(actor, 'BUILDING', 'building.create', building.id, { code: building.code }, property.portfolioOrganizationId);
    return building;
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, `Building code “${data.code}” already exists on this property`);
    throw err;
  }
}

async function requireScopedBuilding(actor: ScopeActor, id: string) {
  const row = await db.building.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      code: true,
      property: { select: { amenities: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Building not found');
  return row;
}

export async function updateBuilding(actor: ScopeActor, id: string, input: Raw) {
  const row = await requireScopedBuilding(actor, id);
  const data = parseBuildingInput(input);
  if (data.amenities) data.amenities = stripPropertyAmenities(row.property.amenities, data.amenities) ?? [];
  try {
    const result = await db.building.updateMany({ where: { id: row.id, organizationId: row.organizationId }, data });
    if (result.count === 0) throw new RouteError(404, 'Building not found');
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, `Building code “${data.code}” already exists on this property`);
    throw err;
  }
  await auditLog(actor, 'BUILDING', 'building.update', row.id, { code: data.code }, row.organizationId);
  return db.building.findUnique({ where: { id: row.id } });
}

export async function deleteBuilding(actor: ScopeActor, id: string) {
  const row = await db.building.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: { id: true, organizationId: true, code: true, _count: { select: { units: true } } },
  });
  if (!row) throw new RouteError(404, 'Building not found');
  if (row._count.units > 0) {
    throw new RouteError(409, `Building “${row.code}” still has units — move or delete them first`);
  }
  await db.building.delete({ where: { id: row.id } });
  await auditLog(actor, 'BUILDING', 'building.delete', row.id, { code: row.code }, row.organizationId);
}

// ── unit types (flat org catalog) ────────────────────────────────────────────

export async function listUnitTypes(actor: ScopeActor) {
  return db.unitType.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { name: 'asc' },
  });
}

function parseUnitTypeInput(raw: Raw, requireName: boolean) {
  const name = str(raw.name);
  if (requireName && !name) throw new RouteError(400, 'Unit type name is required');
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if ('description' in raw) data.description = str(raw.description) ?? null;
  if ('bedrooms' in raw) data.bedrooms = intOrNull(raw.bedrooms, 'bedrooms');
  if ('bathrooms' in raw) data.bathrooms = intOrNull(raw.bathrooms, 'bathrooms');
  if ('areaValue' in raw) data.areaValue = numOrNull(raw.areaValue, 'areaValue');
  if ('areaUnit' in raw) data.areaUnit = pick(raw.areaUnit, AREA_UNITS.map((a) => a.value), 'areaUnit') ?? null;
  if ('baseRent' in raw) data.baseRent = numOrNull(raw.baseRent, 'baseRent');
  return data as { name?: string };
}

export async function createUnitType(actor: ScopeActor, input: Raw) {
  const data = parseUnitTypeInput(input, true);
  try {
    const unitType = await db.unitType.create({
      data: { ...data, organizationId: actor.organizationId } as Prisma.UnitTypeUncheckedCreateInput,
    });
    await auditLog(actor, 'UNIT_TYPE', 'unit_type.create', unitType.id, { name: unitType.name });
    return unitType;
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, `Unit type “${data.name}” already exists in your organization`);
    throw err;
  }
}

export async function updateUnitType(actor: ScopeActor, id: string, input: Raw) {
  const data = parseUnitTypeInput(input, false);
  try {
    const result = await db.unitType.updateMany({
      where: { id, organizationId: actor.organizationId },
      data: data as Prisma.UnitTypeUpdateManyMutationInput,
    });
    if (result.count === 0) throw new RouteError(404, 'Unit type not found');
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, 'Unit type name already exists in your organization');
    throw err;
  }
  await auditLog(actor, 'UNIT_TYPE', 'unit_type.update', id, { fields: Object.keys(data) });
  return db.unitType.findUnique({ where: { id } });
}

export async function deleteUnitType(actor: ScopeActor, id: string) {
  const row = await db.unitType.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!row) throw new RouteError(404, 'Unit type not found');
  await db.unitType.delete({ where: { id: row.id } });
  await auditLog(actor, 'UNIT_TYPE', 'unit_type.delete', row.id, { name: row.name });
}

// ── units ────────────────────────────────────────────────────────────────────

export async function listUnits(
  actor: ScopeActor,
  propertyId: string,
  opts: { status?: string; buildingId?: string; q?: string; includeTenantContact?: boolean } = {},
): Promise<UnitRow[]> {
  await requirePropertyInScope(actor, propertyId);
  const and: Prisma.UnitWhereInput[] = [{ propertyId, property: propertyScopeWhere(actor) }];
  if (opts.buildingId) {
    and.push(opts.buildingId === 'none' ? { buildingId: null } : { buildingId: opts.buildingId });
  }
  if (opts.status) and.push({ status: pick(opts.status, UNIT_STATUS_VALUES, 'status') as UnitStatus });
  const q = opts.q?.trim();
  if (q) {
    and.push({
      OR: [
        { unitRef: { contains: q, mode: 'insensitive' } },
        { label: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  const rows = await db.unit.findMany({
    where: { AND: and },
    include: { building: true },
    orderBy: { unitRef: 'asc' },
  });
  const shaped = await shapeUnits(rows);
  const occupants = await occupantMap(rows.map((r) => r.id), opts.includeTenantContact ?? false);
  const bills = await billMap(rows.map((r) => r.id));
  return shaped.map((r) => ({
    ...r,
    occupant: occupants.get(r.id) ?? null,
    bills: bills.get(r.id) ?? [],
  }));
}

export interface UnitListFilters {
  propertyId?: string;
  status?: string;
  buildingId?: string;
  q?: string;
  includeTenantContact?: boolean;
}

/**
 * Global units register (portfolio-wide, /units). Property-scoped via the
 * parent; occupant join follows the same PII mask as detail routes.
 */
export async function listAllUnits(actor: ScopeActor, opts: UnitListFilters = {}) {
  const and: Prisma.UnitWhereInput[] = [{ property: propertyScopeWhere(actor) }];
  if (opts.propertyId) {
    await requirePropertyInScope(actor, opts.propertyId);
    and.push({ propertyId: opts.propertyId });
  }
  if (opts.status) and.push({ status: pick(opts.status, UNIT_STATUS_VALUES, 'status') as UnitStatus });
  if (opts.buildingId) {
    and.push(opts.buildingId === 'none' ? { buildingId: null } : { buildingId: opts.buildingId });
  }
  const q = opts.q?.trim();
  if (q) {
    and.push({
      OR: [
        { unitRef: { contains: q, mode: 'insensitive' } },
        { label: { contains: q, mode: 'insensitive' } },
        { property: { name: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }
  const rows = await db.unit.findMany({
    where: { AND: and },
    include: {
      building: { select: { id: true, code: true, name: true } },
      property: {
        select: {
          id: true,
          name: true,
          code: true,
          addressLine1: true,
          locality: true,
          currency: true,
          documents: {
            where: { kind: 'PHOTO', isCover: true },
            take: 1,
            select: { storageKey: true },
          },
        },
      },
    },
    orderBy: [{ property: { name: 'asc' } }, { unitRef: 'asc' }],
  });
  const shaped = await shapeUnits(rows);
  const occupants = await occupantMap(rows.map((r) => r.id), opts.includeTenantContact ?? false);
  const bills = await billMap(rows.map((r) => r.id));
  return shaped.map((r) => ({
    ...r,
    coverPhoto: r.property.documents[0]?.storageKey ?? null,
    occupant: occupants.get(r.id) ?? null,
    bills: bills.get(r.id) ?? [],
  }));
}

async function requireScopedUnit(actor: ScopeActor, id: string) {
  const row = await db.unit.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      unitRef: true,
      status: true,
      property: { select: { amenities: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Unit not found');
  return row;
}

function parseUnitInput(raw: Raw, opts: { requireKind: boolean }) {
  const data: Record<string, unknown> = {};

  // unitRef: create validates presence itself; bulk generates refs itself;
  // absent/empty on update means "leave unchanged" (never clearable).
  if ('unitRef' in raw) {
    const unitRef = str(raw.unitRef);
    if (unitRef !== undefined) data.unitRef = unitRef;
  }
  if ('label' in raw) data.label = str(raw.label) ?? null;

  if ('unitType' in raw || opts.requireKind) {
    const unitType = pick(raw.unitType, UNIT_KINDS.map((k) => k.value), 'unitType');
    if (opts.requireKind && !unitType) throw new RouteError(400, 'Unit kind is required');
    if (unitType) data.unitType = unitType as UnitKind;
  }

  if ('floor' in raw) data.floor = intOrNull(raw.floor, 'floor');
  if ('bedrooms' in raw) data.bedrooms = intOrNull(raw.bedrooms, 'bedrooms');
  if ('bathrooms' in raw) data.bathrooms = intOrNull(raw.bathrooms, 'bathrooms');
  if ('parkingBays' in raw) data.parkingBays = intOrNull(raw.parkingBays, 'parkingBays');
  if ('areaValue' in raw) data.areaValue = numOrNull(raw.areaValue, 'areaValue');
  if ('areaUnit' in raw) data.areaUnit = pick(raw.areaUnit, AREA_UNITS.map((a) => a.value), 'areaUnit') ?? null;
  if ('amenities' in raw) data.amenities = strArrayOrNull(raw.amenities, 'amenities') ?? [];
  if ('notes' in raw) data.notes = str(raw.notes) ?? null;
  if ('isActive' in raw) data.isActive = raw.isActive !== false;

  // per-unit utility accounts (account no. / water meter / prepaid token meter)
  if ('accountNumber' in raw) data.accountNumber = str(raw.accountNumber) ?? null;
  if ('waterMeterNumber' in raw) data.waterMeterNumber = str(raw.waterMeterNumber) ?? null;
  if ('electricityMeterNumber' in raw) data.electricityMeterNumber = str(raw.electricityMeterNumber) ?? null;

  // rental defaults (templates — never touch live leases/charges)
  if ('defaultRent' in raw) data.defaultRent = numOrNull(raw.defaultRent, 'defaultRent');
  if ('currency' in raw) {
    const currency = str(raw.currency)?.toUpperCase();
    if (currency && !/^[A-Z]{3}$/.test(currency)) throw new RouteError(400, 'Currency must be a 3-letter code');
    data.currency = currency ?? null;
  }
  if ('billingFrequency' in raw) {
    data.billingFrequency = pick(raw.billingFrequency, RENT_FREQUENCIES.map((f) => f.value), 'billingFrequency') ?? null;
  }
  if ('depositDefault' in raw) data.depositDefault = numOrNull(raw.depositDefault, 'depositDefault');

  // manual status gate — OCCUPIED/RESERVED are lease-derived caches
  if ('status' in raw && raw.status !== '' && raw.status != null) {
    const requested = String(raw.status);
    if (!UNIT_STATUS_VALUES.includes(requested as UnitStatus)) {
      throw new RouteError(400, 'Invalid status');
    }
    if (!UNIT_MANUAL_STATUSES.includes(requested as UnitStatus)) {
      throw new RouteError(
        400,
        'Status may only be set to vacant, maintenance or blocked — occupancy follows active leases',
      );
    }
    data.status = requested as UnitStatus;
  }

  return data;
}

/** buildingId must belong to the same property (or be null). */
async function resolveBuilding(propertyId: string, buildingId: unknown): Promise<string | null | undefined> {
  if (buildingId === undefined) return undefined;
  if (buildingId === null || buildingId === '') return null;
  if (typeof buildingId !== 'string') throw new RouteError(400, 'Invalid building');
  const b = await db.building.findFirst({ where: { id: buildingId, propertyId }, select: { id: true } });
  if (!b) throw new RouteError(400, 'Building does not belong to this property');
  return b.id;
}

/**
 * Single unit for the detail route — lease-derived occupancy plus the active
 * occupant (same join as listUnits; contact PII follows the tenant.read mask).
 */
export async function getUnit(
  actor: ScopeActor,
  id: string,
  opts: { includeTenantContact?: boolean } = {},
) {
  const row = await db.unit.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    include: { building: true },
  });
  if (!row) throw new RouteError(404, 'Unit not found');
  const [shaped] = await shapeUnits([row]);
  const occupants = await occupantMap([id], opts.includeTenantContact ?? false);
  return { ...shaped, occupant: occupants.get(id) ?? null };
}

export async function createUnit(actor: ScopeActor, propertyId: string, input: Raw) {
  const property = await requirePropertyInScope(actor, propertyId);
  const data = parseUnitInput(input, { requireKind: true });
  if (data.unitRef == null) throw new RouteError(400, 'Unit reference is required');
  if ('amenities' in data) data.amenities = stripPropertyAmenities(property.amenities, data.amenities) ?? [];
  const buildingId = await resolveBuilding(propertyId, input.buildingId);
  if (buildingId !== undefined) data.buildingId = buildingId;
  if (data.label == null) data.label = data.unitRef;

  try {
    const unit = await db.unit.create({
      data: {
        ...data,
        propertyId,
        organizationId: property.portfolioOrganizationId,
      } as Prisma.UnitUncheckedCreateInput,
    });
    await auditLog(actor, 'UNIT', 'unit.create', unit.id, { unitRef: unit.unitRef }, property.portfolioOrganizationId);
    return unit;
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, `Unit reference “${String(data.unitRef)}” already exists on this property`);
    throw err;
  }
}

export async function updateUnit(actor: ScopeActor, id: string, input: Raw) {
  const row = await requireScopedUnit(actor, id);
  const data = parseUnitInput(input, { requireKind: false });
  if ('amenities' in data) {
    data.amenities = stripPropertyAmenities(row.property.amenities, data.amenities) ?? [];
  }
  if ('buildingId' in input) {
    const buildingId = await resolveBuilding(row.propertyId, input.buildingId);
    data.buildingId = buildingId ?? null;
  }
  if (Object.keys(data).length === 0) return getUnit(actor, id);

  try {
    const result = await db.unit.updateMany({
      where: { id: row.id, organizationId: row.organizationId },
      data: data as Prisma.UnitUpdateManyMutationInput,
    });
    if (result.count === 0) throw new RouteError(404, 'Unit not found');
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, `Unit reference “${String(data.unitRef)}” already exists on this property`);
    throw err;
  }
  await auditLog(actor, 'UNIT', 'unit.update', row.id, { fields: Object.keys(data) }, row.organizationId);
  return getUnit(actor, id);
}

export async function deleteUnit(actor: ScopeActor, id: string) {
  const row = await db.unit.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: {
      id: true,
      organizationId: true,
      unitRef: true,
      _count: { select: { leaseTerms: true, charges: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Unit not found');
  const blockers: string[] = [];
  if (row._count.leaseTerms > 0) blockers.push('leases');
  if (row._count.charges > 0) blockers.push('charges');
  if (blockers.length > 0) {
    throw new RouteError(409, `Unit ${row.unitRef} is referenced by ${blockers.join(' and ')} — archive instead`);
  }
  await db.unit.delete({ where: { id: row.id } });
  await auditLog(actor, 'UNIT', 'unit.delete', row.id, { unitRef: row.unitRef }, row.organizationId);
}

// ── bulk generator (units 101–124) ───────────────────────────────────────────

export interface BulkUnitInput {
  prefix?: string;
  from: number;
  to: number;
  skip?: number[];
  buildingId?: string | null;
  unitTypeTemplateId?: string | null;
  defaults?: Raw;
}

export function bulkRefs(prefix: string, from: number, to: number, skip: number[] = []): string[] {
  const skipped = new Set(skip);
  const refs: string[] = [];
  for (let n = from; n <= to; n += 1) {
    if (!skipped.has(n)) refs.push(`${prefix}${n}`);
  }
  return refs;
}

export async function bulkCreateUnits(actor: ScopeActor, propertyId: string, input: BulkUnitInput) {
  const property = await requirePropertyInScope(actor, propertyId);

  const from = Number(input.from);
  const to = Number(input.to);
  if (!Number.isInteger(from) || !Number.isInteger(to)) throw new RouteError(400, 'Range must be whole numbers');
  if (from > to) throw new RouteError(400, 'Range start must be ≤ end');
  const count = to - from + 1;
  if (count < BULK_MIN_RANGE) throw new RouteError(400, 'Range is empty');
  if (count > BULK_MAX_RANGE) throw new RouteError(400, `Range too large — max ${BULK_MAX_RANGE} units per batch`);
  const skip = (Array.isArray(input.skip) ? input.skip : [])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= from && n <= to);

  const prefix = typeof input.prefix === 'string' ? input.prefix : '';
  const refs = bulkRefs(prefix, from, to, skip);
  if (refs.length === 0) throw new RouteError(400, 'Nothing to create after skips');
  if (new Set(refs).size !== refs.length) throw new RouteError(400, 'Generated references collide with each other');

  // template + defaults
  let defaults: Raw = { ...(input.defaults ?? {}) };
  if (input.unitTypeTemplateId) {
    const template = await db.unitType.findFirst({
      where: { id: input.unitTypeTemplateId, organizationId: actor.organizationId },
    });
    if (!template) throw new RouteError(404, 'Unit type template not found');
    defaults = {
      unitType: defaults.unitType ?? undefined,
      bedrooms: template.bedrooms ?? undefined,
      bathrooms: template.bathrooms ?? undefined,
      areaValue: template.areaValue != null ? Number(template.areaValue) : undefined,
      areaUnit: template.areaUnit ?? undefined,
      defaultRent: template.baseRent != null ? Number(template.baseRent) : undefined,
      ...defaults,
    };
  }

  const parsed = parseUnitInput(defaults, { requireKind: true });
  if ('amenities' in parsed) parsed.amenities = stripPropertyAmenities(property.amenities, parsed.amenities) ?? [];
  const buildingId = await resolveBuilding(propertyId, input.buildingId ?? null);
  if (buildingId) parsed.buildingId = buildingId;

  // all-or-nothing: pre-flight conflicts (existing refs on this property)
  const conflicts = await db.unit.findMany({
    where: { propertyId, unitRef: { in: refs } },
    select: { unitRef: true },
  });
  if (conflicts.length > 0) {
    const list = conflicts.map((c) => c.unitRef).sort().join(', ');
    throw new RouteError(409, `Conflicting unit references already exist: ${list}`);
  }

  try {
    const result = await db.unit.createMany({
      data: refs.map((unitRef) => ({
        ...parsed,
        unitRef,
        label: (parsed.label as string | null) ?? unitRef,
        propertyId,
        organizationId: property.portfolioOrganizationId,
      })) as Prisma.UnitUncheckedCreateInput[],
    });
    await auditLog(
      actor,
      'UNIT',
      'unit.bulk_create',
      propertyId,
      { from, to, prefix, created: result.count },
      property.portfolioOrganizationId,
    );
    return { created: result.count, refs };
  } catch (err) {
    if (isUniqueViolation(err)) throw new RouteError(409, 'A generated reference conflicts with an existing unit — retry');
    throw err;
  }
}

// ── spreadsheet import (CSV / Excel) ────────────────────────────────────────

export type ImportUnitsResult = {
  success: number;
  failed: number;
  /** 0-based data-row index (header excluded) → reason. */
  errors: Record<number, string>;
};

/**
 * CSV/Excel import — PARTIAL success per row (the upload dialog surfaces
 * per-row errors and keeps going). Each row runs the same parse + create
 * path as a single-unit create: unique `unitRef` per property, kind
 * required, amenities stripped against the property's own list, building
 * resolved by id (the client maps building codes → ids before posting).
 */
export async function importUnits(actor: ScopeActor, propertyId: string, rows: unknown): Promise<ImportUnitsResult> {
  const property = await requirePropertyInScope(actor, propertyId);
  if (!Array.isArray(rows) || rows.length === 0) throw new RouteError(400, 'No rows to import');
  if (rows.length > IMPORT_MAX_ROWS) throw new RouteError(400, `Too many rows — max ${IMPORT_MAX_ROWS} per import`);

  const errors: Record<number, string> = {};
  const seen = new Set<string>();
  let success = 0;

  for (const [i, entry] of rows.entries()) {
    try {
      const raw = (entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {}) as Raw;
      const unitRef = str(raw.unitRef);
      if (!unitRef) throw new RouteError(400, 'Unit reference is required');
      if (seen.has(unitRef)) throw new RouteError(400, `Duplicate reference “${unitRef}” appears twice in this file`);
      seen.add(unitRef);

      const data = parseUnitInput(raw, { requireKind: true });
      data.unitRef = unitRef;
      data.label = (data.label as string | null) ?? unitRef;
      data.amenities = stripPropertyAmenities(property.amenities, data.amenities ?? []) ?? [];
      const buildingId = await resolveBuilding(propertyId, raw.buildingId);
      if (buildingId !== undefined) data.buildingId = buildingId;

      const unit = await db.unit.create({
        data: {
          ...data,
          propertyId,
          organizationId: property.portfolioOrganizationId,
        } as Prisma.UnitUncheckedCreateInput,
      });
      await auditLog(
        actor,
        'UNIT',
        'unit.create',
        unit.id,
        { unitRef: unit.unitRef, source: 'import' },
        property.portfolioOrganizationId,
      );
      success += 1;
    } catch (err) {
      if (isUniqueViolation(err)) errors[i] = 'Reference already exists on this property';
      else if (err instanceof RouteError) errors[i] = err.message;
      else errors[i] = 'Could not save this row';
    }
  }

  return { success, failed: Object.keys(errors).length, errors };
}
