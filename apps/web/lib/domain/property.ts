/**
 * Property domain service — the create/update/archive/delete logic behind
 * `/api/properties*` (plan-slice-1 §3.1).
 *
 * Scoping invariant (AGENTS.md): every read uses `propertyScopeWhere`;
 * every mutation is fetch → assert scope → `updateMany` keyed by the
 * PROPERTY'S OWN `portfolioOrganizationId` (a managing org can edit rows it
 * reaches via agreement, but the row's home org never changes).
 *
 * Audit rows for property actions log under the portfolio org (activity
 * feed sees everything; managed orgs read back only their own org's rows).
 */

import type {
  AreaUnit,
  BillingFrequency,
  Prisma,
  PropertyCategory,
  PropertyCondition,
  PropertyStatus,
  PropertyType,
  RateClearanceStatus,
  TitleType,
} from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { hasMapPin } from '@/lib/maps';
import { auditLog } from './audit';
import { propertyScopeWhere, type ScopeActor } from './property-scope';
import { occupancyByProperty } from './unit';
import { parsePartyInput } from './ownership';
import { MANAGER_KINDS } from './agreement';
import { destroyIfOrphaned } from './documents';
import { propertyBalances } from './charge';
import {
  AREA_UNITS,
  PROPERTY_CATEGORIES,
  PROPERTY_CONDITIONS,
  PROPERTY_EDITABLE_STATUSES,
  RATE_CLEARANCE_STATUSES,
  RENT_FREQUENCIES,
  TITLE_TYPES,
  typesForCategory,
  type PropertyDefaultsInput,
} from './property-constants';

type Raw = Record<string, unknown>;

export interface PropertyListOpts {
  q?: string;
  status?: string;
  category?: string;
  propertyType?: string;
  /** charge.list — attach the derived outstanding balance per property. */
  includeBalance?: boolean;
}

// ── coercion helpers ─────────────────────────────────────────────────────────

function asString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function asNumberOrNull(v: unknown, field: string): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new RouteError(400, `${field} must be a number`);
  return n;
}

function asIntOrNull(v: unknown, field: string): number | null {
  const n = asNumberOrNull(v, field);
  if (n === null) return null;
  if (!Number.isInteger(n)) throw new RouteError(400, `${field} must be a whole number`);
  return n;
}

function asStringArrayOrNull(v: unknown, field: string): string[] | null {
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v)) throw new RouteError(400, `${field} must be a list`);
  const items = v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x !== '');
  return [...new Set(items)];
}

function asDateOrNull(v: unknown, field: string): Date | null {
  if (v === '' || v === null || v === undefined) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} must be a valid date`);
  return d;
}

function pickEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  // '' / null mean "cleared" for nullable enum fields — callers decide
  // whether that's a clear (`?? null`) or a skip (`if (x)`).
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    throw new RouteError(400, `Invalid ${field}`);
  }
  return v as T;
}

function parseDefaults(v: unknown): Prisma.InputJsonValue | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'object' || Array.isArray(v)) {
    throw new RouteError(400, 'defaults must be an object');
  }
  const raw = v as Raw;
  const out: PropertyDefaultsInput = {};
  const freq = pickEnum(
    raw.rentFrequency,
    RENT_FREQUENCIES.map((o) => o.value),
    'defaults.rentFrequency',
  );
  if (freq) out.rentFrequency = freq as BillingFrequency;
  if (raw.depositMonths !== undefined && raw.depositMonths !== null && raw.depositMonths !== '') {
    const n = Number(raw.depositMonths);
    if (!Number.isInteger(n) || n < 0) throw new RouteError(400, 'defaults.depositMonths must be a non-negative whole number');
    out.depositMonths = n;
  }
  if (raw.noticeDays !== undefined && raw.noticeDays !== null && raw.noticeDays !== '') {
    const n = Number(raw.noticeDays);
    if (!Number.isInteger(n) || n < 0) throw new RouteError(400, 'defaults.noticeDays must be a non-negative whole number');
    out.noticeDays = n;
  }
  if (raw.serviceChargeRate !== undefined && raw.serviceChargeRate !== null && raw.serviceChargeRate !== '') {
    const n = Number(raw.serviceChargeRate);
    if (!Number.isFinite(n) || n < 0) throw new RouteError(400, 'defaults.serviceChargeRate must be a non-negative number');
    out.serviceChargeRate = n;
  }
  const lateFee = asString(raw.lateFeeRule);
  if (lateFee) out.lateFeeRule = lateFee;
  return out as Prisma.InputJsonValue;
}

// ── input parsing (shared by create + update) ────────────────────────────────

interface ParseOpts {
  mode: 'create' | 'update';
  /** Existing row (update only) — for change-sensitive validation. */
  previous?: {
    category: PropertyCategory;
    status: PropertyStatus;
    latitude: unknown;
    longitude: unknown;
    titleNumber: string | null;
    rateClearanceExpiresAt: Date | null;
  };
}

function parsePropertyInput(raw: Raw, opts: ParseOpts): Record<string, unknown> {
  const { mode, previous } = opts;
  const data: Record<string, unknown> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(raw, k);

  // identity ────────────────────────────────────────────────────────────────
  if (has('name') || mode === 'create') {
    const name = asString(raw.name);
    if (!name) throw new RouteError(400, 'Property name is required');
    data.name = name;
  }
  if (has('code')) data.code = asString(raw.code) ?? null;
  if (has('description')) data.description = asString(raw.description) ?? null;

  const category = pickEnum(raw.category, PROPERTY_CATEGORIES.map((c) => c.value), 'category');
  if (category) data.category = category;
  const finalCategory = (category ?? previous?.category) as PropertyCategory;
  if (mode === 'create' && !data.category) {
    throw new RouteError(400, 'Property category is required');
  }

  if (has('propertyType') || mode === 'create') {
    const allowed = typesForCategory(finalCategory).map((t) => t.value);
    const propertyType = pickEnum(raw.propertyType, allowed, 'propertyType');
    if (!propertyType) throw new RouteError(400, 'Property type is required and must match the category');
    data.propertyType = propertyType as PropertyType;
  }

  if (has('status')) {
    const status = pickEnum(raw.status, PROPERTY_EDITABLE_STATUSES.map((s) => s.value), 'status');
    if (status) data.status = status as PropertyStatus;
  }
  if (has('tags')) data.tags = asStringArrayOrNull(raw.tags, 'tags') ?? [];
  if (has('currency')) {
    const currency = asString(raw.currency)?.toUpperCase();
    if (currency && !/^[A-Z]{3}$/.test(currency)) throw new RouteError(400, 'Currency must be a 3-letter code');
    data.currency = currency ?? 'KES';
  }

  // location ────────────────────────────────────────────────────────────────
  if (has('addressLine1') || mode === 'create') {
    const a1 = asString(raw.addressLine1);
    if (mode === 'create' && !a1) throw new RouteError(400, 'Street address is required');
    data.addressLine1 = a1 ?? null;
  }
  for (const f of ['addressLine2', 'locality', 'region', 'postalCode', 'directionsNote', 'landmark'] as const) {
    if (has(f)) data[f] = asString(raw[f]) ?? null;
  }
  if (mode === 'create') {
    const locality = asString(raw.locality);
    if (!locality) throw new RouteError(400, 'Locality / area is required');
    data.locality = locality;
  }
  if (has('country') || mode === 'create') {
    const country = asString(raw.country);
    if (mode === 'create' && !country) throw new RouteError(400, 'Country is required');
    data.country = country ?? null;
  }

  // map pin — both-or-neither, never (0,0), valid ranges
  if (has('latitude') || has('longitude') || mode === 'create') {
    const lat = asNumberOrNull(raw.latitude, 'latitude');
    const lng = asNumberOrNull(raw.longitude, 'longitude');
    if (lat !== null && lng !== null) {
      if (!hasMapPin(lat, lng)) throw new RouteError(400, 'Invalid map pin coordinates');
      data.latitude = lat;
      data.longitude = lng;
    } else if (lat !== null || lng !== null) {
      throw new RouteError(400, 'Map pin needs both latitude and longitude');
    } else if (mode === 'create') {
      data.latitude = null;
      data.longitude = null;
    }
  }
  if (has('googlePlaceId')) data.googlePlaceId = asString(raw.googlePlaceId) ?? null;

  // derived display address (kept in sync whenever address parts are saved)
  if (mode === 'create' || ['addressLine1', 'addressLine2', 'locality', 'region', 'country'].some(has)) {
    const merged = {
      addressLine1: has('addressLine1') ? asString(raw.addressLine1) : undefined,
      addressLine2: has('addressLine2') ? asString(raw.addressLine2) : undefined,
      locality: has('locality') ? asString(raw.locality) : undefined,
      region: has('region') ? asString(raw.region) : undefined,
      country: has('country') ? asString(raw.country) : undefined,
    };
    const parts = [
      merged.addressLine1 ?? (mode === 'create' ? asString(raw.addressLine1) : undefined),
      merged.addressLine2,
      merged.locality ?? (mode === 'create' ? asString(raw.locality) : undefined),
      merged.region,
      merged.country ?? (mode === 'create' ? asString(raw.country) : undefined),
    ];
    const formatted = parts.filter((p): p is string => typeof p === 'string' && p !== '').join(', ');
    data.formattedAddress = formatted || null;
  }

  // media
  if (has('virtualTourUrl')) data.virtualTourUrl = asString(raw.virtualTourUrl) ?? null;
  if (has('videoUrl')) data.videoUrl = asString(raw.videoUrl) ?? null;

  // legal ───────────────────────────────────────────────────────────────────
  if (has('titleType')) data.titleType = (pickEnum(raw.titleType, TITLE_TYPES.map((t) => t.value), 'titleType') ?? null) as TitleType | null;
  if (has('titleNumber')) data.titleNumber = asString(raw.titleNumber) ?? null;
  if (has('registryReference')) data.registryReference = asString(raw.registryReference) ?? null;
  if (has('surveyPlanNumber')) data.surveyPlanNumber = asString(raw.surveyPlanNumber) ?? null;
  if (has('landControlArea')) data.landControlArea = asString(raw.landControlArea) ?? null;
  if (has('zoning')) data.zoning = asString(raw.zoning) ?? null;
  if (has('rateClearanceStatus')) {
    data.rateClearanceStatus = (pickEnum(
      raw.rateClearanceStatus,
      RATE_CLEARANCE_STATUSES.map((s) => s.value),
      'rateClearanceStatus',
    ) ?? null) as RateClearanceStatus | null;
  }
  if (has('rateClearanceExpiresAt')) {
    const d = asDateOrNull(raw.rateClearanceExpiresAt, 'rateClearanceExpiresAt');
    const previousExpiry = previous?.rateClearanceExpiresAt ?? null;
    const changed = (d?.getTime() ?? null) !== (previousExpiry?.getTime() ?? null);
    if (d && changed && d.getTime() < Date.now() - 86_400_000) {
      throw new RouteError(400, 'Rate clearance expiry must be in the future');
    }
    data.rateClearanceExpiresAt = d;
  }
  if (has('encumbrances')) data.encumbrances = asString(raw.encumbrances) ?? null;

  // structure ───────────────────────────────────────────────────────────────
  if (has('yearBuilt')) data.yearBuilt = asIntOrNull(raw.yearBuilt, 'yearBuilt');
  if (has('yearRenovated')) data.yearRenovated = asIntOrNull(raw.yearRenovated, 'yearRenovated');
  if (has('floors')) data.floors = asIntOrNull(raw.floors, 'floors');
  if (has('parkingSpaces')) data.parkingSpaces = asIntOrNull(raw.parkingSpaces, 'parkingSpaces');
  if (has('plotSizeValue')) data.plotSizeValue = asNumberOrNull(raw.plotSizeValue, 'plotSizeValue');
  if (has('plotSizeUnit')) data.plotSizeUnit = (pickEnum(raw.plotSizeUnit, AREA_UNITS.map((a) => a.value), 'plotSizeUnit') ?? null) as AreaUnit | null;
  if (has('buildingAreaValue')) data.buildingAreaValue = asNumberOrNull(raw.buildingAreaValue, 'buildingAreaValue');
  if (has('buildingAreaUnit')) data.buildingAreaUnit = (pickEnum(raw.buildingAreaUnit, AREA_UNITS.map((a) => a.value), 'buildingAreaUnit') ?? null) as AreaUnit | null;
  if (has('glaValue')) data.glaValue = asNumberOrNull(raw.glaValue, 'glaValue');
  if (has('condition')) data.condition = (pickEnum(raw.condition, PROPERTY_CONDITIONS.map((c) => c.value), 'condition') ?? null) as PropertyCondition | null;
  if (has('amenities')) data.amenities = asStringArrayOrNull(raw.amenities, 'amenities') ?? [];
  if (has('utilities')) data.utilities = asStringArrayOrNull(raw.utilities, 'utilities') ?? [];

  // defaults
  if (has('defaults')) data.defaults = parseDefaults(raw.defaults);

  // activation gate — LAND needs pin + title before leaving DRAFT
  const finalStatus = (data.status as PropertyStatus | undefined) ?? previous?.status ?? 'DRAFT';
  const finalTitle = data.titleNumber !== undefined ? (data.titleNumber as string | null) : previous?.titleNumber ?? null;
  const finalLat = data.latitude !== undefined ? data.latitude : previous?.latitude ?? null;
  const finalLng = data.longitude !== undefined ? data.longitude : previous?.longitude ?? null;
  if (finalStatus === 'ACTIVE' && finalCategory === 'LAND') {
    if (!hasMapPin(finalLat, finalLng) || !finalTitle) {
      throw new RouteError(400, 'Land properties need a map pin and title number before activation');
    }
  }

  return data;
}

// ── list ─────────────────────────────────────────────────────────────────────

/**
 * Most relevant agreement for the register's column: ACTIVE first, then
 * SUSPENDED, then DRAFT; otherwise the newest of the rest.
 */
function pickAgreement(
  rows: { id: string; status: string; startsAt: Date | null; endsAt: Date | null }[] | undefined,
) {
  if (!rows || rows.length === 0) return null;
  const rank = (s: string) => (s === 'ACTIVE' ? 0 : s === 'SUSPENDED' ? 1 : s === 'DRAFT' ? 2 : 3);
  const sorted = [...rows].sort((a, b) => rank(a.status) - rank(b.status));
  const top = sorted[0];
  return top ? { id: top.id, status: top.status, startsAt: top.startsAt, endsAt: top.endsAt } : null;
}

export async function list(actor: ScopeActor, opts: PropertyListOpts = {}) {
  // Scope lives under AND so a search OR can never replace it.
  const and: Prisma.PropertyWhereInput[] = [propertyScopeWhere(actor)];
  const filters: Prisma.PropertyWhereInput = {};
  if (opts.status) filters.status = opts.status as PropertyStatus;
  if (opts.category) filters.category = opts.category as PropertyCategory;
  if (opts.propertyType) filters.propertyType = opts.propertyType as PropertyType;
  if (Object.keys(filters).length > 0) and.push(filters);

  const q = opts.q?.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { locality: { contains: q, mode: 'insensitive' } },
        { addressLine1: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  const rows = await db.property.findMany({
    where: { AND: and },
    include: {
      _count: { select: { units: true, buildings: true, documents: true } },
      documents: {
        where: { kind: 'PHOTO', isCover: true },
        take: 1,
        select: { storageKey: true },
      },
      // Register Owner column (hidden for LANDLORD in the UI — data on your
      // own properties is never a leak). Property-level rows only.
      ownerships: {
        where: { unitId: null },
        take: 4,
        orderBy: [{ sharePercent: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
        select: { sharePercent: true, ownerParty: { select: { name: true } } },
      },
      // Register Agreement column — rows where THIS org is either party.
      managementAgreements: {
        where: {
          OR: [
            { organizationId: actor.organizationId },
            { managementOrganizationId: actor.organizationId },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, startsAt: true, endsAt: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const occupancy = await occupancyByProperty(rows.map((r) => r.id));
  const balances = opts.includeBalance ? await propertyBalances(rows) : null;
  return rows.map(({ documents, ownerships, managementAgreements, ...p }) => ({
    ...p,
    coverPhoto: documents[0]?.storageKey ?? null,
    occupancy: occupancy.get(p.id) ?? { occupied: 0, total: p._count.units, rate: 0 },
    owners: ownerships.map((o) => ({
      name: o.ownerParty.name,
      sharePercent: o.sharePercent != null ? Number(o.sharePercent) : null,
    })),
    agreement: pickAgreement(managementAgreements),
    ...(balances ? { balance: balances.get(p.id) ?? null } : {}),
  }));
}

// ── get ──────────────────────────────────────────────────────────────────────

const propertyDetailInclude: Prisma.PropertyInclude = {
  _count: { select: { units: true, buildings: true, ownerships: true, documents: true } },
  documents: {
    where: { kind: 'PHOTO', isCover: true },
    take: 1,
    select: { storageKey: true },
  },
  ownerships: {
    include: { ownerParty: { select: { id: true, name: true, partyType: true } } },
    orderBy: [{ sharePercent: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
  },
  staffAssignments: {
    where: { isActive: true },
    select: { id: true, userId: true, title: true, startsAt: true, endsAt: true, isActive: true },
  },
};

export async function get(actor: ScopeActor, id: string, opts: { includeBalance?: boolean } = {}) {
  const property = await db.property.findFirst({
    where: { id, ...propertyScopeWhere(actor) },
    include: {
      ...propertyDetailInclude,
      // Agreements: only rows where THIS org matches either side (the
      // managing org must not read unrelated counterparties' contracts).
      managementAgreements: {
        where: {
          OR: [
            { organizationId: actor.organizationId },
            { managementOrganizationId: actor.organizationId },
          ],
        },
        include: {
          managementOrganization: { select: { id: true, name: true } },
          ownerParty: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!property) throw new RouteError(404, 'Property not found');
  const { documents, ...rest } = property;
  const occupancy = await occupancyByProperty([id]);
  const balances = opts.includeBalance ? await propertyBalances([{ id, currency: rest.currency }]) : null;
  return {
    ...rest,
    coverPhoto: documents[0]?.storageKey ?? null,
    occupancy: occupancy.get(id) ?? { occupied: 0, total: property._count.units, rate: 0 },
    ...(balances ? { balance: balances.get(id) ?? null } : {}),
  };
}

// ── create ───────────────────────────────────────────────────────────────────

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002';
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function dateOrUndefined(v: unknown, field: string): Date | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} is not a valid date`);
  return d;
}

/**
 * Auto-generated property code: `SHP-0001`, +1 per org (max numeric suffix
 * wins; codes outside the pattern are ignored). Called when the caller leaves
 * `code` blank — manual codes are honoured as-is.
 */
async function nextPropertyCode(organizationId: string): Promise<string> {
  const rows = await db.property.findMany({
    where: { portfolioOrganizationId: organizationId, code: { not: null } },
    select: { code: true },
  });
  let max = 0;
  for (const row of rows) {
    const m = /^SHP-(\d+)$/.exec(row.code ?? '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `SHP-${String(max + 1).padStart(4, '0')}`;
}

/**
 * Create a property in the caller's own portfolio, linking ownership (and
 * optionally a management agreement) in ONE transaction — account-type aware
 * (`Organization.kind`):
 *
 * - LANDLORD → auto self-owner: find-or-create the org's own owner party
 *   (`linkedOrganizationId = self`) + a 100% ownership row. No agreement
 *   payload is accepted (a self-managed landlord workspace has no manager
 *   to select).
 * - PROPERTY_MANAGEMENT / MAINTENANCE_COMPANY / MARKETING_AGENT → owner is
 *   REQUIRED (`ownership.ownerPartyId` existing party, or `ownership.owner`
 *   inline new party — 400 otherwise). Agreements (DRAFT) are accepted only
 *   for kinds that may manage (`MANAGER_KINDS`): PM + MM. MARKETING_AGENT
 *   gets a clear 400 — it markets, it never manages.
 *
 * `media` in the payload is ignored here by design: the caller registers
 * uploaded files afterwards via POST /api/documents (entityType=PROPERTY).
 */
export async function create(actor: ScopeActor, input: Raw) {
  const ownershipRaw = asObject(input.ownership);
  const agreementRaw = asObject(input.agreement);
  const data = parsePropertyInput(input, { mode: 'create' });

  // activation intent (create): status defaults to DRAFT unless asked
  let status: PropertyStatus = 'DRAFT';
  if (input.activate === true) {
    const category = (data.category ?? 'RESIDENTIAL') as PropertyCategory;
    const titleNumber = (data.titleNumber as string | null) ?? null;
    if (category === 'LAND' && !(hasMapPin(data.latitude, data.longitude) && titleNumber)) {
      throw new RouteError(400, 'Land properties need a map pin and title number before activation');
    }
    status = 'ACTIVE';
  }

  const org = await db.organization.findUnique({
    where: { id: actor.organizationId },
    select: { kind: true, name: true, legalName: true, taxId: true },
  });
  const kind = org?.kind ?? 'LANDLORD';
  const isLandlord = kind === 'LANDLORD';

  // contract check on the extension payloads (all four kinds handled)
  if (isLandlord && agreementRaw) {
    throw new RouteError(400, 'Landlord workspaces do not use management agreements');
  }
  if (!isLandlord && agreementRaw && !MANAGER_KINDS.includes(kind as (typeof MANAGER_KINDS)[number])) {
    throw new RouteError(400, 'This account type cannot attach management agreements');
  }

  const ownerPartyId = asString(ownershipRaw?.ownerPartyId) ?? '';
  const inlineOwner = asObject(ownershipRaw?.owner);
  if (!isLandlord) {
    if (!ownerPartyId && !inlineOwner) {
      throw new RouteError(400, 'Owner is required for this account type');
    }
    if (ownerPartyId) {
      const party = await db.propertyOwnerParty.findFirst({
        where: { id: ownerPartyId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!party) throw new RouteError(400, 'Owner party not found in your organization');
    }
  }

  const shareRaw = ownershipRaw?.sharePercent;
  const sharePercent = shareRaw === undefined || shareRaw === null || shareRaw === ''
    ? 100
    : Number(shareRaw);
  if (!Number.isFinite(sharePercent) || sharePercent <= 0 || sharePercent > 100) {
    throw new RouteError(400, 'sharePercent must be between 0 and 100');
  }

  const agreementStartsAt = agreementRaw ? (dateOrUndefined(agreementRaw.startsAt, 'startsAt') ?? new Date()) : undefined;
  const agreementEndsAt = agreementRaw ? dateOrUndefined(agreementRaw.endsAt, 'endsAt') : undefined;
  if (agreementStartsAt && agreementEndsAt && agreementEndsAt <= agreementStartsAt) {
    throw new RouteError(400, 'Agreement endsAt must be after startsAt');
  }
  const inlinePartyData = inlineOwner
    ? await parsePartyInput(inlineOwner, { requireName: true })
    : null;

  const autoCode = !data.code;
  let property: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !property; attempt += 1) {
    const code = autoCode ? await nextPropertyCode(actor.organizationId) : (data.code as string);
    try {
      property = await db.$transaction(async (tx) => {
        const created = await tx.property.create({
          data: {
            ...data,
            code,
            portfolioOrganizationId: actor.organizationId,
            status,
          } as Prisma.PropertyUncheckedCreateInput,
        });

        // ── ownership: landlord auto self-link; others require the owner ──
        let partyId = ownerPartyId;
        if (isLandlord && !partyId) {
          // find the org's own party; create it once if missing
          const self = await tx.propertyOwnerParty.findFirst({
            where: { organizationId: actor.organizationId, linkedOrganizationId: actor.organizationId },
            select: { id: true },
          });
          partyId = self
            ? self.id
            : (
                await tx.propertyOwnerParty.create({
                  data: {
                    organizationId: actor.organizationId,
                    partyType: 'ORGANIZATION',
                    name: org?.legalName ?? org?.name ?? 'Property owner',
                    kraPin: org?.taxId ?? null,
                    linkedOrganizationId: actor.organizationId,
                  },
                  select: { id: true },
                })
              ).id;
        } else if (!partyId && inlinePartyData) {
          partyId = (
            await tx.propertyOwnerParty.create({
              data: {
                ...inlinePartyData,
                organizationId: actor.organizationId,
              } as Prisma.PropertyOwnerPartyUncheckedCreateInput,
              select: { id: true },
            })
          ).id;
        }
        if (!partyId) throw new RouteError(400, 'Owner is required for this account type');

        await tx.propertyOwnership.create({
          data: {
            organizationId: actor.organizationId,
            propertyId: created.id,
            ownerPartyId: partyId,
            sharePercent,
            startsAt: new Date(),
          },
        });

        if (agreementRaw) {
          await tx.propertyManagementAgreement.create({
            data: {
              organizationId: actor.organizationId,
              propertyId: created.id,
              managementOrganizationId: actor.organizationId,
              ownerPartyId: partyId,
              status: 'DRAFT',
              startsAt: agreementStartsAt ?? new Date(),
              endsAt: agreementEndsAt ?? null,
              ...(agreementRaw.scope && typeof agreementRaw.scope === 'object' && !Array.isArray(agreementRaw.scope)
                ? { scope: agreementRaw.scope as Prisma.InputJsonValue }
                : {}),
            },
          });
        }
        return created;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        if (autoCode && attempt < 2) continue; // code race → next number
        throw new RouteError(409, 'Property code already in use');
      }
      throw err;
    }
  }
  if (!property) throw new RouteError(409, 'Could not allocate a property code');

  await auditLog(actor, 'PROPERTY', 'property.create', property.id, {
    name: data.name,
    category: data.category,
    status,
    autoCode,
  }, actor.organizationId);

  return db.property.findUnique({ where: { id: property.id } });
}

// ── update ───────────────────────────────────────────────────────────────────

export async function update(actor: ScopeActor, id: string, input: Raw) {
  const row = await db.property.findFirst({ where: { id, ...propertyScopeWhere(actor) } });
  if (!row) throw new RouteError(404, 'Property not found');

  const data = parsePropertyInput(input, { mode: 'update', previous: row });
  if (Object.keys(data).length === 0) return row;

  const result = await db.property.updateMany({
    where: { id: row.id, portfolioOrganizationId: row.portfolioOrganizationId },
    data: data as Prisma.PropertyUpdateManyMutationInput,
  });
  if (result.count === 0) throw new RouteError(404, 'Property not found');

  await auditLog(actor, 'PROPERTY', 'property.update', row.id, {
    changed: Object.keys(data),
  }, row.portfolioOrganizationId);

  return db.property.findUnique({ where: { id: row.id } });
}

// ── delete (drafts only) ─────────────────────────────────────────────────────

export async function remove(actor: ScopeActor, id: string) {
  const row = await db.property.findFirst({
    where: { id, ...propertyScopeWhere(actor) },
    select: {
      id: true,
      status: true,
      portfolioOrganizationId: true,
      name: true,
      _count: { select: { units: true, leases: true, managementAgreements: true, ownerships: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Property not found');
  if (row.status !== 'DRAFT') {
    throw new RouteError(409, 'Only draft properties can be deleted — archive instead');
  }
  // ownerships are NOT a blocker: every create links an owner (landlord
  // auto-link included) — the property-level rows are removed WITH the
  // draft. Real blockers stay: units, leases, agreements.
  const blockers = Object.entries(row._count)
    .filter(([k, n]) => k !== 'ownerships' && n > 0)
    .map(([k]) => k);
  if (blockers.length > 0) {
    throw new RouteError(409, `Property has related records (${blockers.join(', ')}) — archive instead`);
  }

  // Capture gallery keys first (rows cascade on delete), then clean the
  // cloud assets that become orphaned (ref-counted — shared keys survive).
  const docKeys = await db.propertyDocument.findMany({
    where: { propertyId: row.id },
    select: { storageKey: true },
  });

  await db.$transaction([
    // FK Restrict on PropertyOwnership → clear property-level rows first
    // (unit-level rows would have failed the units blocker above).
    db.propertyOwnership.deleteMany({ where: { propertyId: row.id, unitId: null } }),
    db.property.delete({ where: { id: row.id } }),
  ]);
  await auditLog(actor, 'PROPERTY', 'property.delete', row.id, { name: row.name }, row.portfolioOrganizationId);

  for (const key of new Set(docKeys.map((d) => d.storageKey))) {
    await destroyIfOrphaned(key);
  }
}

// ── archive / unarchive ──────────────────────────────────────────────────────

export async function archive(actor: ScopeActor, id: string) {
  const row = await db.property.findFirst({ where: { id, ...propertyScopeWhere(actor) } });
  if (!row) throw new RouteError(404, 'Property not found');
  if (row.status === 'ARCHIVED') return row;

  await db.property.updateMany({
    where: { id: row.id, portfolioOrganizationId: row.portfolioOrganizationId },
    data: { status: 'ARCHIVED' },
  });
  await auditLog(actor, 'PROPERTY', 'property.archive', row.id, { from: row.status }, row.portfolioOrganizationId);
  return db.property.findUnique({ where: { id: row.id } });
}

export async function unarchive(actor: ScopeActor, id: string) {
  const row = await db.property.findFirst({ where: { id, ...propertyScopeWhere(actor) } });
  if (!row) throw new RouteError(404, 'Property not found');
  if (row.status !== 'ARCHIVED') {
    throw new RouteError(409, 'Property is not archived');
  }

  // Restore to ACTIVE only when it would pass the activation gate; else DRAFT.
  const canActivate =
    hasMapPin(row.latitude, row.longitude) &&
    (row.category !== 'LAND' || Boolean(row.titleNumber));
  const status: PropertyStatus = canActivate ? 'ACTIVE' : 'DRAFT';

  await db.property.updateMany({
    where: { id: row.id, portfolioOrganizationId: row.portfolioOrganizationId },
    data: { status },
  });
  await auditLog(actor, 'PROPERTY', 'property.unarchive', row.id, { status }, row.portfolioOrganizationId);
  return db.property.findUnique({ where: { id: row.id } });
}

// ── activity feed ────────────────────────────────────────────────────────────

export async function activity(actor: ScopeActor, id: string) {
  const row = await db.property.findFirst({
    where: { id, ...propertyScopeWhere(actor) },
    select: { id: true },
  });
  if (!row) throw new RouteError(404, 'Property not found');

  return db.auditLog.findMany({
    where: { organizationId: actor.organizationId, resourceId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      action: true,
      resourceType: true,
      actorUserId: true,
      metadata: true,
      createdAt: true,
    },
  });
}
