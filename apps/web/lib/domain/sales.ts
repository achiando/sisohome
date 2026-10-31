/**
 * Sales domain — listings, leads, viewings (plan-slice-5 §1–2).
 *
 * Listing access has three read arms (list/detail `OR`):
 *   1. `organizationId = actor.org`           → owner side (portfolio org or
 *      the PM operating a managed property) — full field access.
 *   2. `marketingOrganizationId = actor.org`  → shared side (MARKETING_AGENT):
 *      projection reads, content edits (`title/description/highlights/
 *      contact*`) and publish only. Price fields + close transitions are
 *      owner-only, enforced by a per-side field allowlist below.
 *   3. `property: propertyScopeWhere(actor)`  → operational reach through the
 *      property (e.g. a PM created the listing under the landlord's
 *      portfolio org).
 *
 * `ListingPriceHistory` is written by the server on every asking-price
 * change (REDUCED/INCREASED), on create (LISTED) and on terminal closes
 * (SOLD/WITHDRAWN) — no route ever writes history manually, so a silent
 * price overwrite is impossible.
 *
 * Leads are flat capture-org rows (`organizationId` never re-points on a
 * handoff — the Handoff relationship row is the only cross-org link). The
 * receiver org reads through `handoffs.some({toOrganizationId, ACCEPTED})`.
 *
 * Viewings scope = parent property ∪ own-org rows ∪ `agentUserId = actor`
 * (the booking agent keeps access even on a foreign property).
 */
import { Prisma } from '@workspace/database';
import type {
  ContactChannel,
  LeadSource,
  LeadStatus,
  ListingPurpose,
  ListingPriceFrequency,
  ListingStatus,
  ViewingFeedback,
  ViewingStatus,
} from '@workspace/database';

import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';

import { auditLog } from './audit';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';
import { LEAD_STAGE_ORDER, LEAD_TRANSITIONS, LEAD_TERMINAL, LISTING_CLOSEABLE, LISTING_PUBLISHABLE, VIEWING_TRANSITIONS } from './sales-constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PURPOSES: ListingPurpose[] = ['SALE', 'RENT'];
const FREQUENCIES: ListingPriceFrequency[] = ['TOTAL', 'MONTHLY', 'PER_SQM', 'ON_REQUEST'];
const LEAD_SOURCES: LeadSource[] = ['WEBSITE', 'WHATSAPP', 'REFERRAL', 'SIGNBOARD', 'PORTAL', 'CALL_IN', 'OTHER'];
const CHANNELS: ContactChannel[] = ['SMS', 'WHATSAPP', 'EMAIL'];
const VIEWING_STATUSES: ViewingStatus[] = ['SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];
const VIEWING_FEEDBACKS: ViewingFeedback[] = ['INTERESTED', 'REVIEWING', 'DECLINED'];

const LEAD_NEXT_ACTION_DAYS = 3;

// ── small parsers ────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function requireStr(raw: Record<string, unknown>, field: string, max = 200): string {
  const v = str(raw[field]);
  if (!v) throw new RouteError(400, `${field} is required`);
  if (v.length > max) throw new RouteError(400, `${field} must be at most ${max} characters`);
  return v;
}

function numOrNull(v: unknown, field: string): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new RouteError(400, `${field} must be a number`);
  return n;
}

function dateOrNull(v: unknown, field: string): Date | null {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} must be a valid date`);
  return d;
}

function oneOf<T extends string>(v: unknown, allowed: T[], field: string, fallback?: T): T {
  if (v === undefined && fallback !== undefined) return fallback;
  const s = String(v ?? '').trim().toUpperCase() as T;
  if (!allowed.includes(s)) throw new RouteError(400, `${field} must be one of ${allowed.join(', ')}`);
  return s;
}

function strList(v: unknown, field: string, maxItems: number, maxLen: number): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new RouteError(400, `${field} must be an array`);
  if (v.length > maxItems) throw new RouteError(400, `${field} must have at most ${maxItems} items`);
  return v.map((item) => {
    const s = typeof item === 'string' ? item.trim() : '';
    if (!s) throw new RouteError(400, `${field} entries must be non-empty strings`);
    if (s.length > maxLen) throw new RouteError(400, `${field} entries must be at most ${maxLen} characters`);
    return s;
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ── listing scope & shape ────────────────────────────────────────────────────

export type ListingAccess = 'owner' | 'shared';

export function listingScopeWhere(actor: ScopeActor): Prisma.ListingWhereInput {
  return {
    OR: [
      { organizationId: actor.organizationId },
      { marketingOrganizationId: actor.organizationId },
      { property: propertyScopeWhere(actor) },
    ],
  };
}

/** Owner-side reach: portfolio org or an in-scope property. Never marketing. */
export function listingOwnerWhere(actor: ScopeActor): Prisma.ListingWhereInput {
  return {
    OR: [{ organizationId: actor.organizationId }, { property: propertyScopeWhere(actor) }],
  };
}

/**
 * Which side of the listing the caller stands on. `shared` only when the
 * caller reaches it purely through the marketing arm — everything else
 * (own org, managed property) is the operational side.
 */
function accessOf(
  row: { organizationId: string; marketingOrganizationId: string | null },
  actor: ScopeActor,
): ListingAccess {
  if (row.organizationId === actor.organizationId) return 'owner';
  if (row.marketingOrganizationId === actor.organizationId) return 'shared';
  return 'owner';
}

const LISTING_BASE_SELECT = {
  id: true,
  organizationId: true,
  marketingOrganizationId: true,
  propertyId: true,
  unitId: true,
  purpose: true,
  status: true,
  title: true,
  description: true,
  highlights: true,
  askingPrice: true,
  currency: true,
  priceFrequency: true,
  priceOnRequest: true,
  commissionRate: true,
  commissionBasis: true,
  sourceChannel: true,
  publishedAt: true,
  expiresAt: true,
  listedByUserId: true,
  contactPhone: true,
  contactEmail: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ListingSelect;

type ListingRow = Prisma.ListingGetPayload<{ select: typeof LISTING_BASE_SELECT }>;

type PropertyLight = {
  id: string;
  name: string;
  locality: string | null;
  addressLine1: string | null;
  latitude: unknown;
  longitude: unknown;
  category: string;
};

/**
 * Shared-side projection: ONLY the marketing-facing fields. Internal
 * property state (`defaults`, finances, agreements, …) never leaves this
 * function for `access=shared` (plan-slice-5 §5.3 — smoke asserts it).
 */
function projectProperty(p: {
  id: string;
  name: string;
  locality: string | null;
  addressLine1: string | null;
  latitude: unknown;
  longitude: unknown;
  category: string;
}) {
  return {
    id: p.id,
    name: p.name,
    locality: p.locality,
    addressLine1: p.addressLine1,
    latitude: p.latitude,
    longitude: p.longitude,
    category: p.category,
  };
}

function price(v: unknown): string | null {
  return v === null || v === undefined ? null : Number(v).toFixed(2);
}

function shapeListing(
  row: ListingRow & {
    property: PropertyLight;
    unit: { id: string; unitRef: string; label: string | null } | null;
  },
  access: ListingAccess,
) {
  return {
    id: row.id,
    access,
    organizationId: row.organizationId,
    marketingOrganizationId: row.marketingOrganizationId,
    propertyId: row.propertyId,
    unitId: row.unitId,
    purpose: row.purpose,
    status: row.status,
    title: row.title,
    description: row.description,
    highlights: row.highlights,
    askingPrice: price(row.askingPrice),
    currency: row.currency,
    priceFrequency: row.priceFrequency,
    priceOnRequest: row.priceOnRequest,
    commissionRate: price(row.commissionRate),
    commissionBasis: row.commissionBasis,
    sourceChannel: row.sourceChannel,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    listedByUserId: row.listedByUserId,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    property:
      access === 'shared'
        ? projectProperty(row.property)
        : {
            ...row.property,
            latitude: row.property.latitude === null ? null : Number(row.property.latitude),
            longitude: row.property.longitude === null ? null : Number(row.property.longitude),
          },
    unit: row.unit,
  };
}

const LISTING_INCLUDE = {
  property: {
    select: {
      id: true,
      name: true,
      locality: true,
      addressLine1: true,
      latitude: true,
      longitude: true,
      category: true,
    },
  },
  unit: { select: { id: true, unitRef: true, label: true } },
} as const;

// ── listings ────────────────────────────────────────────────────────────────

const LISTING_STATUS_VALUES: ListingStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'UNDER_OFFER',
  'SOLD',
  'RENTED',
  'WITHDRAWN',
  'EXPIRED',
];

export async function listListings(
  actor: ScopeActor,
  query: { status?: string; purpose?: string; q?: string } = {},
) {
  const where: Prisma.ListingWhereInput = { ...listingScopeWhere(actor) };
  if (query.status) where.status = oneOf(query.status, LISTING_STATUS_VALUES, 'status');
  if (query.purpose) where.purpose = oneOf(query.purpose, PURPOSES, 'purpose');
  if (query.q) {
    where.title = { contains: query.q, mode: 'insensitive' };
  }

  const rows = await db.listing.findMany({
    where,
    select: { ...LISTING_BASE_SELECT, property: LISTING_INCLUDE.property, unit: LISTING_INCLUDE.unit },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 200,
  });

  return rows.map((row) => shapeListing(row, accessOf(row, actor)));
}

async function fetchListing(actor: ScopeActor, id: string) {
  if (!UUID_RE.test(id)) throw new RouteError(404, 'Listing not found');
  const row = await db.listing.findFirst({
    where: { id, ...listingScopeWhere(actor) },
    select: { ...LISTING_BASE_SELECT, property: LISTING_INCLUDE.property, unit: LISTING_INCLUDE.unit },
  });
  if (!row) throw new RouteError(404, 'Listing not found');
  return row;
}

export async function getListing(actor: ScopeActor, id: string) {
  const row = await fetchListing(actor, id);
  const access = accessOf(row, actor);
  const base = shapeListing(row, access);

  const [fullProperty, priceHistory, leads, offers] = await Promise.all([
    access === 'owner'
      ? db.property.findUnique({ where: { id: row.propertyId } })
      : Promise.resolve(null),
    db.listingPriceHistory.findMany({
      where: { listingId: row.id },
      orderBy: { changedAt: 'desc' },
      select: { id: true, price: true, event: true, note: true, changedAt: true, changedByUserId: true },
    }),
    access === 'owner'
      ? db.lead.count({ where: { listingId: row.id } })
      : Promise.resolve(null),
    access === 'owner'
      ? db.offer.findMany({
          where: { listingId: row.id },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            offerDate: true,
            lead: { select: { id: true, displayName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    ...base,
    // Owner side sees the whole Property row; shared side keeps the
    // projection built in shapeListing (never widened here).
    property: fullProperty ? fullProperty : base.property,
    priceHistory: priceHistory.map((h) => ({
      id: h.id,
      price: price(h.price),
      event: h.event,
      note: h.note,
      changedAt: h.changedAt.toISOString(),
      changedByUserId: h.changedByUserId,
    })),
    counts: access === 'owner' ? { leads, offers: offers.length } : null,
    offers: offers.map((o) => ({
      id: o.id,
      amount: price(o.amount),
      currency: o.currency,
      status: o.status,
      offerDate: o.offerDate.toISOString().slice(0, 10),
      lead: o.lead,
    })),
  };
}

/**
 * Field allowlist per side. `shared` (marketing arm) may touch content only;
 * price/terms/sharing/close stay with the portfolio side — enforced here so
 * no route can forget it.
 */
const LISTING_CONTENT_FIELDS = ['title', 'description', 'highlights', 'contactPhone', 'contactEmail'] as const;
const LISTING_OWNER_FIELDS = [
  ...LISTING_CONTENT_FIELDS,
  'askingPrice',
  'currency',
  'priceFrequency',
  'priceOnRequest',
  'commissionRate',
  'commissionBasis',
  'sourceChannel',
  'expiresAt',
  'marketingOrganizationId',
] as const;
const LISTING_IMMUTABLE_FIELDS = ['purpose', 'propertyId', 'unitId', 'status', 'organizationId'];

export async function createListing(actor: ScopeActor, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};

  const property = await requirePropertyInScope(actor, requireStr(body, 'propertyId'));
  const purpose = oneOf(body.purpose, PURPOSES, 'purpose');
  const title = requireStr(body, 'title', 160);

  let unitId: string | null = null;
  if (str(body.unitId)) {
    unitId = str(body.unitId);
    const unit = await db.unit.findFirst({
      where: { id: unitId!, propertyId: property.id },
      select: { id: true },
    });
    if (!unit) throw new RouteError(404, 'Unit not found on this property');
  }

  const askingPrice = numOrNull(body.askingPrice, 'askingPrice');
  if (askingPrice !== null && askingPrice < 0) throw new RouteError(400, 'askingPrice must not be negative');
  const commissionRate = numOrNull(body.commissionRate, 'commissionRate');
  if (commissionRate !== null && (commissionRate < 0 || commissionRate > 100)) {
    throw new RouteError(400, 'commissionRate must be between 0 and 100');
  }

  const data: Prisma.ListingCreateInput = {
    organization: { connect: { id: property.portfolioOrganizationId } },
    property: { connect: { id: property.id } },
    ...(unitId ? { unit: { connect: { id: unitId } } } : {}),
    purpose,
    status: 'DRAFT',
    title,
    description: str(body.description),
    highlights: strList(body.highlights, 'highlights', 20, 120),
    askingPrice,
    currency: (str(body.currency) ?? 'KES').toUpperCase().slice(0, 3),
    priceFrequency: oneOf(body.priceFrequency, FREQUENCIES, 'priceFrequency', 'TOTAL'),
    priceOnRequest: body.priceOnRequest === true,
    commissionRate,
    commissionBasis: oneOf(body.commissionBasis, ['PERCENT', 'FIXED'] as const, 'commissionBasis', 'PERCENT'),
    sourceChannel: oneOf(body.sourceChannel, ['DIRECT', 'MARKETING_AGENT', 'IMPORT'] as const, 'sourceChannel', 'DIRECT'),
    listedByUserId: actor.userId,
    contactPhone: str(body.contactPhone),
    contactEmail: str(body.contactEmail),
    expiresAt: dateOrNull(body.expiresAt, 'expiresAt'),
  };

  const listing = await db.$transaction(async (tx) => {
    const created = await tx.listing.create({ data, select: { id: true } });
    if (askingPrice !== null) {
      await tx.listingPriceHistory.create({
        data: {
          listingId: created.id,
          price: askingPrice,
          event: 'LISTED',
          note: 'Initial asking price',
          changedByUserId: actor.userId,
        },
      });
    }
    return created;
  });

  await auditLog(
    actor,
    'LISTING',
    'listing.create',
    listing.id,
    { title, purpose, askingPrice },
    property.portfolioOrganizationId,
  );

  return getListing(actor, listing.id);
}

export async function updateListing(actor: ScopeActor, id: string, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  const row = await fetchListing(actor, id);
  const access = accessOf(row, actor);

  const data: Prisma.ListingUncheckedUpdateManyInput = {};
  const touched: string[] = [];
  const allowed = access === 'shared' ? LISTING_CONTENT_FIELDS : LISTING_OWNER_FIELDS;

  for (const key of Object.keys(body)) {
    if (body[key] === undefined) continue;
    if (LISTING_IMMUTABLE_FIELDS.includes(key)) {
      throw new RouteError(400, `${key} cannot be changed here`);
    }
    if (!(allowed as readonly string[]).includes(key)) {
      throw new RouteError(
        400,
        access === 'shared'
          ? `${key} is restricted to the portfolio organization`
          : `${key} is not a editable listing field`,
      );
    }
    touched.push(key);
  }
  if (touched.length === 0) return getListing(actor, id);

  // Price change → history row in the SAME transaction (never silent).
  let history: Prisma.ListingPriceHistoryCreateInput | null = null;
  if (Object.prototype.hasOwnProperty.call(body, 'askingPrice')) {
    const next = numOrNull(body.askingPrice, 'askingPrice');
    if (next !== null && next < 0) throw new RouteError(400, 'askingPrice must not be negative');
    const prev = row.askingPrice === null ? null : Number(row.askingPrice);
    if (next !== prev && next !== null) {
      const event =
        prev === null ? 'LISTED' : next < prev ? ('REDUCED' as const) : ('INCREASED' as const);
      history = {
        listing: { connect: { id: row.id } },
        price: next,
        event,
        note: prev === null ? 'Price added' : `From ${row.currency} ${prev} to ${row.currency} ${next}`,
        changedByUserId: actor.userId,
      };
    }
    data.askingPrice = next;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) data.description = str(body.description);
  if (Object.prototype.hasOwnProperty.call(body, 'contactPhone')) data.contactPhone = str(body.contactPhone);
  if (Object.prototype.hasOwnProperty.call(body, 'contactEmail')) data.contactEmail = str(body.contactEmail);
  if (Object.prototype.hasOwnProperty.call(body, 'title')) data.title = requireStr(body, 'title', 160);
  if (Object.prototype.hasOwnProperty.call(body, 'highlights')) {
    data.highlights = strList(body.highlights, 'highlights', 20, 120);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'currency')) {
    data.currency = (str(body.currency) ?? 'KES').toUpperCase().slice(0, 3);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'priceFrequency')) {
    data.priceFrequency = oneOf(body.priceFrequency, FREQUENCIES, 'priceFrequency');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'priceOnRequest')) {
    data.priceOnRequest = body.priceOnRequest === true;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'commissionRate')) {
    const rate = numOrNull(body.commissionRate, 'commissionRate');
    if (rate !== null && (rate < 0 || rate > 100)) {
      throw new RouteError(400, 'commissionRate must be between 0 and 100');
    }
    data.commissionRate = rate;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'commissionBasis')) {
    data.commissionBasis = oneOf(body.commissionBasis, ['PERCENT', 'FIXED'] as const, 'commissionBasis');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'sourceChannel')) {
    data.sourceChannel = oneOf(body.sourceChannel, ['DIRECT', 'MARKETING_AGENT', 'IMPORT'] as const, 'sourceChannel');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'expiresAt')) {
    data.expiresAt = dateOrNull(body.expiresAt, 'expiresAt');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'marketingOrganizationId')) {
    const orgId = str(body.marketingOrganizationId);
    if (orgId && !(await db.organization.findFirst({ where: { id: orgId }, select: { id: true } }))) {
      throw new RouteError(404, 'Marketing organization not found');
    }
    data.marketingOrganizationId = orgId;
  }

  await db.$transaction(async (tx) => {
    const res = await tx.listing.updateMany({
      where: { id: row.id, organizationId: row.organizationId },
      data,
    });
    if (res.count === 0) throw new RouteError(404, 'Listing not found');
    if (history) await tx.listingPriceHistory.create({ data: history });
  });

  await auditLog(actor, 'LISTING', 'listing.update', row.id, { fields: touched }, row.organizationId);
  return getListing(actor, id);
}

export async function publishListing(actor: ScopeActor, id: string) {
  const row = await fetchListing(actor, id);
  if (!LISTING_PUBLISHABLE.includes(row.status)) {
    throw new RouteError(409, `A listing in status ${row.status} cannot be published`);
  }

  const property = await db.property.findUnique({
    where: { id: row.propertyId },
    select: { latitude: true, longitude: true },
  });
  if (!property?.latitude || !property?.longitude) {
    throw new RouteError(400, 'The property needs a map pin (latitude/longitude) before it can be published');
  }
  if (row.askingPrice === null && !row.priceOnRequest) {
    throw new RouteError(400, 'Set an asking price or mark the listing price-on-request before publishing');
  }

  await db.listing.updateMany({
    where: { id: row.id, organizationId: row.organizationId },
    data: { status: 'PUBLISHED', publishedAt: row.publishedAt ?? new Date() },
  });

  await auditLog(actor, 'LISTING', 'listing.publish', row.id, { from: row.status }, row.organizationId);
  return getListing(actor, id);
}

export async function closeListing(actor: ScopeActor, id: string, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  const row = await fetchListing(actor, id);
  if (accessOf(row, actor) !== 'owner') {
    throw new RouteError(403, 'Only the portfolio organization can close a listing');
  }

  const to = oneOf(body.to, ['SOLD', 'RENTED', 'WITHDRAWN', 'EXPIRED'] as const, 'to');
  const allowed = LISTING_CLOSEABLE[row.status];
  if (!allowed.includes(to)) {
    throw new RouteError(409, `A listing in status ${row.status} cannot move to ${to}`);
  }

  const event = to === 'SOLD' ? ('SOLD' as const) : to === 'WITHDRAWN' ? ('WITHDRAWN' as const) : null;
  await db.$transaction(async (tx) => {
    const res = await tx.listing.updateMany({
      where: { id: row.id, organizationId: row.organizationId },
      data: { status: to },
    });
    if (res.count === 0) throw new RouteError(404, 'Listing not found');
    if (event && row.askingPrice !== null) {
      await tx.listingPriceHistory.create({
        data: {
          listingId: row.id,
          price: Number(row.askingPrice),
          event,
          note: `Listing closed as ${to}`,
          changedByUserId: actor.userId,
        },
      });
    }
  });

  await auditLog(actor, 'LISTING', 'listing.close', row.id, { from: row.status, to }, row.organizationId);
  return getListing(actor, id);
}

export async function listPriceHistory(actor: ScopeActor, id: string) {
  const row = await fetchListing(actor, id);
  const rows = await db.listingPriceHistory.findMany({
    where: { listingId: row.id },
    orderBy: { changedAt: 'desc' },
    select: { id: true, price: true, event: true, note: true, changedAt: true, changedByUserId: true },
  });
  return rows.map((h) => ({
    id: h.id,
    price: price(h.price),
    event: h.event,
    note: h.note,
    changedAt: h.changedAt.toISOString(),
    changedByUserId: h.changedByUserId,
  }));
}

// ── leads ───────────────────────────────────────────────────────────────────

function leadScopeWhere(actor: ScopeActor): Prisma.LeadWhereInput {
  return {
    OR: [
      { organizationId: actor.organizationId },
      { handoffs: { some: { toOrganizationId: actor.organizationId, status: 'ACCEPTED' } } },
    ],
  };
}

/** The accepted handoff granting THIS org read access (receiver view). */
type LeadVia = { fromOrganization: { id: string; name: string }; respondedAt: Date | null } | null;

const LEAD_INCLUDE = {
  listing: { select: { id: true, title: true, status: true, purpose: true } },
  property: { select: { id: true, name: true, locality: true } },
  assignedTo: { select: { id: true, displayName: true } },
} as const;

type LeadRow = Prisma.LeadGetPayload<{ include: typeof LEAD_INCLUDE }>;

function shapeLead(row: LeadRow, via: LeadVia) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    displayName: row.displayName,
    phone: row.phone,
    email: row.email,
    preferredChannel: row.preferredChannel,
    source: row.source,
    status: row.status,
    budgetMin: row.budgetMin === null ? null : Number(row.budgetMin),
    budgetMax: row.budgetMax === null ? null : Number(row.budgetMax),
    criteria: row.criteria,
    notes: row.notes,
    nextActionAt: row.nextActionAt ? row.nextActionAt.toISOString() : null,
    assignedToUserId: row.assignedToUserId,
    propertyId: row.propertyId,
    listingId: row.listingId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assignedTo: row.assignedTo,
    listing: row.listing,
    property: row.property,
    viaHandoffFrom: via
      ? {
          id: via.fromOrganization.id,
          name: via.fromOrganization.name,
          acceptedAt: via.respondedAt ? via.respondedAt.toISOString() : null,
        }
      : null,
  };
}

async function fetchViaHandoffs(actor: ScopeActor, leadIds: string[]): Promise<Map<string, LeadVia>> {
  if (leadIds.length === 0) return new Map();
  const rows = await db.handoff.findMany({
    where: { leadId: { in: leadIds }, toOrganizationId: actor.organizationId, status: 'ACCEPTED' },
    select: {
      leadId: true,
      respondedAt: true,
      fromOrganization: { select: { id: true, name: true } },
    },
  });
  return new Map(
    rows.map((r) => [r.leadId, { fromOrganization: r.fromOrganization, respondedAt: r.respondedAt } satisfies NonNullable<LeadVia>]),
  );
}

export async function listLeads(
  actor: ScopeActor,
  query: { status?: string; source?: string; assignedTo?: string; q?: string; needsAction?: string } = {},
) {
  // Scope OR lives inside AND so a text-search OR can never replace it.
  const scope: Prisma.LeadWhereInput[] = [{ ...leadScopeWhere(actor) }];
  if (query.q) {
    scope.push({
      OR: [
        { displayName: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ],
    });
  }
  const where: Prisma.LeadWhereInput = { AND: scope };
  if (query.status) {
    where.status = oneOf(
      query.status,
      ['NEW', 'QUALIFIED', 'MATCHED', 'VIEWING', 'OFFERING', 'WON', 'LOST', 'WITHDRAWN'] as LeadStatus[],
      'status',
    );
  }
  if (query.source) where.source = oneOf(query.source, LEAD_SOURCES, 'source');
  if (query.assignedTo === 'me') where.assignedToUserId = actor.userId;
  else if (query.assignedTo) where.assignedToUserId = query.assignedTo;
  if (query.needsAction === '1') where.nextActionAt = { lte: new Date() };

  const rows = await db.lead.findMany({
    where,
    include: LEAD_INCLUDE,
    orderBy: [{ nextActionAt: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });

  const foreign = rows.filter((r) => r.organizationId !== actor.organizationId).map((r) => r.id);
  const via = await fetchViaHandoffs(actor, foreign);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  return rows.map((row) => ({
    ...shapeLead(row, via.get(row.id) ?? null),
    needsAction:
      row.nextActionAt !== null &&
      row.nextActionAt <= todayEnd &&
      !LEAD_TERMINAL.includes(row.status),
  }));
}

/** Scope fetch — the receiver org reaches the row through the handoff arm. */
async function fetchOwnLead(actor: ScopeActor, id: string) {
  if (!UUID_RE.test(id)) throw new RouteError(404, 'Lead not found');
  const row = await db.lead.findFirst({
    where: { id, ...leadScopeWhere(actor) },
    include: LEAD_INCLUDE,
  });
  if (!row) throw new RouteError(404, 'Lead not found');
  return row;
}

/** Mutation fetch — only the capturing org's row is ever written. */
async function fetchOwnLeadStrict(actor: ScopeActor, id: string) {
  if (!UUID_RE.test(id)) throw new RouteError(404, 'Lead not found');
  const row = await db.lead.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: LEAD_INCLUDE,
  });
  if (!row) throw new RouteError(404, 'Lead not found');
  return row;
}

export async function getLead(actor: ScopeActor, id: string) {
  const row = await fetchOwnLead(actor, id);

  const [viewings, offers, handoffs, vias] = await Promise.all([
    db.propertyViewing.findMany({
      where: { leadId: row.id },
      orderBy: { scheduledAt: 'desc' },
      take: 20,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        feedback: true,
        property: { select: { id: true, name: true } },
      },
    }),
    db.offer.findMany({
      where: { leadId: row.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        offerDate: true,
        listing: { select: { id: true, title: true } },
        deal: { select: { id: true, status: true } },
      },
    }),
    db.handoff.findMany({
      where: {
        leadId: row.id,
        OR: [{ fromOrganizationId: row.organizationId }, { toOrganizationId: actor.organizationId }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        respondedAt: true,
        fromOrganizationId: true,
        fromOrganization: { select: { id: true, name: true } },
        toOrganization: { select: { id: true, name: true } },
      },
    }),
    fetchViaHandoffs(actor, [row.id]),
  ]);

  return {
    ...shapeLead(row, vias.get(row.id) ?? null),
    viewings: viewings.map((v) => ({
      id: v.id,
      scheduledAt: v.scheduledAt.toISOString(),
      status: v.status,
      feedback: v.feedback,
      property: v.property,
    })),
    offers: offers.map((o) => ({
      id: o.id,
      amount: price(o.amount),
      currency: o.currency,
      status: o.status,
      offerDate: o.offerDate.toISOString().slice(0, 10),
      listing: o.listing,
      deal: o.deal,
    })),
    handoffs: handoffs.map((h) => ({
      id: h.id,
      status: h.status,
      message: h.message,
      createdAt: h.createdAt.toISOString(),
      respondedAt: h.respondedAt ? h.respondedAt.toISOString() : null,
      fromOrganization: h.fromOrganization,
      toOrganization: h.toOrganization,
      direction: h.fromOrganizationId === row.organizationId ? 'OUTGOING' : 'INCOMING',
      canRespond: h.status === 'OFFERED' && h.toOrganization.id === actor.organizationId,
    })),
  };
}

/**
 * The interest refs must be reachable: a property in scope, or a listing on
 * either side (MK captures interest from the shared projection only).
 */
async function resolveInterestRefs(
  actor: ScopeActor,
  propertyId: string | null,
  listingId: string | null,
): Promise<{ propertyId: string | null; listingId: string | null }> {
  if (listingId) {
    const listing = await db.listing.findFirst({
      where: { id: listingId, ...listingScopeWhere(actor) },
      select: { id: true, propertyId: true },
    });
    if (!listing) throw new RouteError(404, 'Listing not found');
    if (propertyId && propertyId !== listing.propertyId) {
      throw new RouteError(400, 'propertyId does not belong to the given listing');
    }
    return { propertyId: listing.propertyId, listingId: listing.id };
  }
  if (propertyId) {
    const hit = await db.property.findFirst({
      where: { id: propertyId, ...propertyScopeWhere(actor) },
      select: { id: true },
    });
    if (!hit) throw new RouteError(404, 'Property not found');
    return { propertyId: hit.id, listingId: null };
  }
  return { propertyId: null, listingId: null };
}

async function assertMember(actor: ScopeActor, userId: string) {
  const member = await db.organizationMember.findFirst({
    where: { organizationId: actor.organizationId, userId, status: 'ACTIVE' },
    select: { userId: true },
  });
  if (!member) throw new RouteError(400, 'assignedToUserId must be an active member of your organization');
}

function validateLeadInput(body: Record<string, unknown>, partial: boolean) {
  const data: Record<string, unknown> = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'displayName')) {
    data.displayName = requireStr(body, 'displayName', 120);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'phone')) data.phone = str(body.phone);
  if (Object.prototype.hasOwnProperty.call(body, 'email')) data.email = str(body.email);
  if (Object.prototype.hasOwnProperty.call(body, 'preferredChannel')) {
    data.preferredChannel = oneOf(body.preferredChannel, CHANNELS, 'preferredChannel', 'WHATSAPP');
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'source')) {
    data.source = oneOf(body.source, LEAD_SOURCES, 'source', 'OTHER');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'notes')) data.notes = str(body.notes);
  if (Object.prototype.hasOwnProperty.call(body, 'nextActionAt')) {
    data.nextActionAt = dateOrNull(body.nextActionAt, 'nextActionAt');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'budgetMin')) data.budgetMin = numOrNull(body.budgetMin, 'budgetMin');
  if (Object.prototype.hasOwnProperty.call(body, 'budgetMax')) data.budgetMax = numOrNull(body.budgetMax, 'budgetMax');
  if (data.budgetMin !== undefined && data.budgetMin !== null && (data.budgetMin as number) < 0) {
    throw new RouteError(400, 'budgetMin must not be negative');
  }
  if (data.budgetMax !== undefined && data.budgetMax !== null && (data.budgetMax as number) < 0) {
    throw new RouteError(400, 'budgetMax must not be negative');
  }
  if (
    data.budgetMin !== undefined &&
    data.budgetMax !== undefined &&
    data.budgetMin !== null &&
    data.budgetMax !== null &&
    (data.budgetMin as number) > (data.budgetMax as number)
  ) {
    throw new RouteError(400, 'budgetMin must not exceed budgetMax');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'criteria')) {
    if (body.criteria !== null && body.criteria !== undefined && !isPlainObject(body.criteria)) {
      throw new RouteError(400, 'criteria must be an object');
    }
    data.criteria = body.criteria ?? null;
  }
  if (!partial && !data.phone && !data.email) {
    throw new RouteError(400, 'A lead needs a phone number or an email address');
  }
  return data;
}

export async function createLead(actor: ScopeActor, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  const data = validateLeadInput(body, false);

  const refs = await resolveInterestRefs(actor, str(body.propertyId), str(body.listingId));
  const assignedTo = str(body.assignedToUserId);
  if (assignedTo) await assertMember(actor, assignedTo);

  const lead = await db.lead.create({
    data: {
      organizationId: actor.organizationId,
      displayName: data.displayName as string,
      phone: (data.phone as string | null) ?? null,
      email: (data.email as string | null) ?? null,
      preferredChannel: (data.preferredChannel as ContactChannel) ?? 'WHATSAPP',
      source: data.source as LeadSource,
      status: 'NEW',
      budgetMin: (data.budgetMin as number | null) ?? null,
      budgetMax: (data.budgetMax as number | null) ?? null,
      criteria: (data.criteria as Prisma.InputJsonValue | null) ?? Prisma.JsonNull,
      notes: (data.notes as string | null) ?? null,
      nextActionAt: (data.nextActionAt as Date | null) ?? null,
      assignedToUserId: assignedTo,
      propertyId: refs.propertyId,
      listingId: refs.listingId,
    },
    select: { id: true },
  });

  await auditLog(actor, 'LEAD', 'lead.create', lead.id, { displayName: data.displayName });
  return getLead(actor, lead.id);
}

export async function updateLead(actor: ScopeActor, id: string, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  for (const key of ['status', 'organizationId'] as const) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      throw new RouteError(400, `${key} cannot be changed here`);
    }
  }
  const row = await fetchOwnLeadStrict(actor, id);
  const data = validateLeadInput(body, true);

  if (Object.prototype.hasOwnProperty.call(body, 'assignedToUserId')) {
    const assignedTo = str(body.assignedToUserId);
    if (assignedTo) await assertMember(actor, assignedTo);
    data.assignedToUserId = assignedTo;
  }
  if (
    Object.prototype.hasOwnProperty.call(body, 'propertyId') ||
    Object.prototype.hasOwnProperty.call(body, 'listingId')
  ) {
    const propertyId = Object.prototype.hasOwnProperty.call(body, 'propertyId')
      ? str(body.propertyId)
      : row.propertyId;
    const listingId = Object.prototype.hasOwnProperty.call(body, 'listingId')
      ? str(body.listingId)
      : row.listingId;
    const refs = await resolveInterestRefs(actor, propertyId, listingId);
    data.propertyId = refs.propertyId;
    data.listingId = refs.listingId;
  }

  // Cross-field budget check against the merged (existing ∪ patch) values.
  const mergedMin = Object.prototype.hasOwnProperty.call(data, 'budgetMin')
    ? (data.budgetMin as number | null)
    : row.budgetMin === null
      ? null
      : Number(row.budgetMin);
  const mergedMax = Object.prototype.hasOwnProperty.call(data, 'budgetMax')
    ? (data.budgetMax as number | null)
    : row.budgetMax === null
      ? null
      : Number(row.budgetMax);
  if (mergedMin !== null && mergedMax !== null && mergedMin > mergedMax) {
    throw new RouteError(400, 'budgetMin must not exceed budgetMax');
  }

  if (Object.keys(data).length > 0) {
    await db.lead.updateMany({
      where: { id: row.id, organizationId: actor.organizationId },
      data: data as Prisma.LeadUncheckedUpdateManyInput,
    });
    await auditLog(actor, 'LEAD', 'lead.update', row.id, { fields: Object.keys(data) });
  }
  return getLead(actor, id);
}

function nextActionFor(status: LeadStatus, current: Date | null, explicit?: Date | null): Date | null {
  if (LEAD_TERMINAL.includes(status)) return null;
  if (explicit !== undefined) return explicit;
  const now = Date.now();
  if (current && current.getTime() > now) return current;
  return new Date(now + LEAD_NEXT_ACTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function setLeadStatus(actor: ScopeActor, id: string, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  const row = await fetchOwnLeadStrict(actor, id);
  const to = oneOf(
    body.to,
    ['NEW', 'QUALIFIED', 'MATCHED', 'VIEWING', 'OFFERING', 'WON', 'LOST', 'WITHDRAWN'] as LeadStatus[],
    'to',
  );

  const allowed = LEAD_TRANSITIONS[row.status];
  if (!allowed.includes(to)) {
    throw new RouteError(409, `A lead in status ${row.status} cannot move to ${to}`);
  }

  const explicit = Object.prototype.hasOwnProperty.call(body, 'nextActionAt')
    ? dateOrNull(body.nextActionAt, 'nextActionAt')
    : undefined;
  const nextActionAt = nextActionFor(to, row.nextActionAt, explicit);

  await db.lead.updateMany({
    where: { id: row.id, organizationId: actor.organizationId },
    data: { status: to, nextActionAt },
  });

  await auditLog(actor, 'LEAD', 'lead.status', row.id, { from: row.status, to });
  return getLead(actor, id);
}

// ── viewings ────────────────────────────────────────────────────────────────

function viewingScopeWhere(actor: ScopeActor): Prisma.PropertyViewingWhereInput {
  return {
    OR: [
      { property: propertyScopeWhere(actor) },
      { organizationId: actor.organizationId },
      { agentUserId: actor.userId },
    ],
  };
}

const VIEWING_INCLUDE = {
  property: { select: { id: true, name: true, locality: true } },
  unit: { select: { id: true, unitRef: true, label: true } },
  lead: { select: { id: true, displayName: true, status: true } },
} as const;

type ViewingRow = Prisma.PropertyViewingGetPayload<{ include: typeof VIEWING_INCLUDE }>;

async function shapeViewings(rows: ViewingRow[]) {
  const userIds = [...new Set(rows.map((r) => r.agentUserId).filter((v): v is string => Boolean(v)))];
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u.displayName]));

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    propertyId: r.propertyId,
    unitId: r.unitId,
    leadId: r.leadId,
    tenantId: r.tenantId,
    scheduledAt: r.scheduledAt.toISOString(),
    durationMinutes: r.durationMinutes,
    agentUserId: r.agentUserId,
    agentName: r.agentUserId ? byId.get(r.agentUserId) ?? null : null,
    status: r.status,
    feedback: r.feedback,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    property: r.property,
    unit: r.unit,
    lead: r.lead ? { id: r.lead.id, displayName: r.lead.displayName, status: r.lead.status } : null,
  }));
}

export async function listViewings(
  actor: ScopeActor,
  query: { propertyId?: string; status?: string; from?: string; to?: string } = {},
) {
  const where: Prisma.PropertyViewingWhereInput = { ...viewingScopeWhere(actor) };
  if (query.propertyId) where.propertyId = query.propertyId;
  if (query.status) where.status = oneOf(query.status, VIEWING_STATUSES, 'status');
  const from = dateOrNull(query.from, 'from');
  const to = dateOrNull(query.to, 'to');
  if (from || to) {
    where.scheduledAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const rows = await db.propertyViewing.findMany({
    where,
    include: VIEWING_INCLUDE,
    orderBy: { scheduledAt: 'asc' },
    take: 300,
  });
  return shapeViewings(rows);
}

export async function getViewing(actor: ScopeActor, id: string) {
  if (!UUID_RE.test(id)) throw new RouteError(404, 'Viewing not found');
  const row = await db.propertyViewing.findFirst({
    where: { id, ...viewingScopeWhere(actor) },
    include: VIEWING_INCLUDE,
  });
  if (!row) throw new RouteError(404, 'Viewing not found');
  return (await shapeViewings([row]))[0]!;
}

/** Resolve which org owns the viewing row: portfolio scope, or through a readable listing. */
async function resolveViewingOrg(actor: ScopeActor, propertyId: string): Promise<string> {
  try {
    const property = await requirePropertyInScope(actor, propertyId);
    return property.portfolioOrganizationId;
  } catch {
    const listing = await db.listing.findFirst({
      where: { propertyId, ...listingScopeWhere(actor) },
      select: { organizationId: true },
    });
    if (!listing) throw new RouteError(404, 'Property not found');
    return listing.organizationId;
  }
}

export async function assertLeadReadable(actor: ScopeActor, leadId: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, ...leadScopeWhere(actor) },
    select: { id: true, organizationId: true, status: true },
  });
  if (!lead) throw new RouteError(404, 'Lead not found');
  return lead;
}

/**
 * Best-effort lead progression tied to viewings: booking moves NEW/QUALIFIED/
 * MATCHED → VIEWING; a completed viewing with INTERESTED feedback moves
 * VIEWING → OFFERING. Transition conflicts (somebody else already moved it)
 * are ignored — this is guidance, not the lead pipeline's source of truth.
 */
async function bumpLeadAfterViewing(
  lead: { id: string; organizationId: string; status: LeadStatus },
  actor: ScopeActor,
  to: LeadStatus,
) {
  if (lead.organizationId !== actor.organizationId) return;
  // Guidance bumps may jump ahead on the happy path (NEW/QUALIFIED/MATCHED →
  // VIEWING), but never sideways/backwards and never from a terminal status
  // (terminals are absent from LEAD_STAGE_ORDER). The explicit stepper keeps
  // the strict LEAD_TRANSITIONS rules via setLeadStatus.
  const fromIdx = LEAD_STAGE_ORDER.indexOf(lead.status);
  const toIdx = LEAD_STAGE_ORDER.indexOf(to);
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= toIdx) return;
  try {
    await db.lead.updateMany({
      where: { id: lead.id, organizationId: actor.organizationId, status: lead.status },
      data: { status: to, nextActionAt: nextActionFor(to, null) },
    });
  } catch {
    // concurrent transition — leave as-is
  }
}

export async function createViewing(actor: ScopeActor, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  const propertyId = requireStr(body, 'propertyId');
  const organizationId = await resolveViewingOrg(actor, propertyId);

  if (str(body.unitId)) {
    const unit = await db.unit.findFirst({
      where: { id: str(body.unitId)!, propertyId },
      select: { id: true },
    });
    if (!unit) throw new RouteError(404, 'Unit not found on this property');
  }

  const scheduledAt = dateOrNull(body.scheduledAt, 'scheduledAt');
  if (!scheduledAt) throw new RouteError(400, 'scheduledAt is required');

  let lead: { id: string; organizationId: string; status: LeadStatus } | null = null;
  if (str(body.leadId)) lead = await assertLeadReadable(actor, str(body.leadId)!);

  const duration = numOrNull(body.durationMinutes, 'durationMinutes');
  if (duration !== null && (duration <= 0 || duration > 1440)) {
    throw new RouteError(400, 'durationMinutes must be between 1 and 1440');
  }

  const viewing = await db.propertyViewing.create({
    data: {
      organizationId,
      propertyId,
      unitId: str(body.unitId),
      leadId: lead?.id ?? null,
      scheduledAt,
      durationMinutes: duration === null ? null : Math.round(duration),
      agentUserId: str(body.agentUserId) ?? actor.userId,
      status: 'SCHEDULED',
      notes: str(body.notes),
    },
    select: { id: true },
  });

  if (lead) await bumpLeadAfterViewing(lead, actor, 'VIEWING');
  await auditLog(actor, 'VIEWING', 'viewing.create', viewing.id, { propertyId, scheduledAt: scheduledAt.toISOString() }, organizationId);

  const rows = await db.propertyViewing.findMany({
    where: { id: viewing.id },
    include: VIEWING_INCLUDE,
  });
  return (await shapeViewings(rows))[0]!;
}

export async function updateViewing(actor: ScopeActor, id: string, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  if (!UUID_RE.test(id)) throw new RouteError(404, 'Viewing not found');
  const row = await db.propertyViewing.findFirst({
    where: { id, ...viewingScopeWhere(actor) },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      leadId: true,
      status: true,
      feedback: true,
      lead: { select: { id: true, organizationId: true, status: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Viewing not found');

  const data: Prisma.PropertyViewingUncheckedUpdateManyInput = {};
  const touched: string[] = [];

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const to = oneOf(body.status, VIEWING_STATUSES, 'status');
    const allowed = VIEWING_TRANSITIONS[row.status];
    if (!allowed.includes(to)) {
      throw new RouteError(409, `A viewing in status ${row.status} cannot move to ${to}`);
    }
    data.status = to;
    touched.push('status');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'feedback')) {
    const fb = body.feedback === null || body.feedback === '' ? null : oneOf(body.feedback, VIEWING_FEEDBACKS, 'feedback');
    data.feedback = fb;
    touched.push('feedback');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'scheduledAt')) {
    const d = dateOrNull(body.scheduledAt, 'scheduledAt');
    if (!d) throw new RouteError(400, 'scheduledAt is required');
    data.scheduledAt = d;
    touched.push('scheduledAt');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'durationMinutes')) {
    const duration = numOrNull(body.durationMinutes, 'durationMinutes');
    if (duration !== null && (duration <= 0 || duration > 1440)) {
      throw new RouteError(400, 'durationMinutes must be between 1 and 1440');
    }
    data.durationMinutes = duration === null ? null : Math.round(duration);
    touched.push('durationMinutes');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'notes')) data.notes = str(body.notes);
  if (Object.prototype.hasOwnProperty.call(body, 'agentUserId')) data.agentUserId = str(body.agentUserId);
  if (Object.prototype.hasOwnProperty.call(body, 'unitId')) {
    const unitId = str(body.unitId);
    if (unitId) {
      const unit = await db.unit.findFirst({
        where: { id: unitId, propertyId: row.propertyId },
        select: { id: true },
      });
      if (!unit) throw new RouteError(404, 'Unit not found on this property');
    }
    data.unitId = unitId;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'leadId')) {
    const leadId = str(body.leadId);
    if (leadId) await assertLeadReadable(actor, leadId);
    data.leadId = leadId;
    touched.push('leadId');
  }
  for (const key of ['propertyId', 'organizationId', 'id'] as const) {
    if (Object.prototype.hasOwnProperty.call(body, key)) throw new RouteError(400, `${key} cannot be changed here`);
  }

  if (touched.length > 0 || Object.keys(data).length > 0) {
    await db.propertyViewing.updateMany({
      where: { id: row.id, organizationId: row.organizationId },
      data,
    });
    await auditLog(actor, 'VIEWING', 'viewing.update', row.id, { fields: touched }, row.organizationId);
  }

  const nextStatus = (data.status as ViewingStatus | undefined) ?? row.status;
  const nextFeedback = Object.prototype.hasOwnProperty.call(body, 'feedback')
    ? (data.feedback as ViewingFeedback | null)
    : row.feedback;
  if (row.lead && nextStatus === 'COMPLETED' && nextFeedback === 'INTERESTED') {
    await bumpLeadAfterViewing(row.lead, actor, 'OFFERING');
  }

  const rows = await db.propertyViewing.findMany({
    where: { id: row.id },
    include: VIEWING_INCLUDE,
  });
  return (await shapeViewings(rows))[0]!;
}
