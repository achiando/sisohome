/**
 * Offers + deals (plan-slice-5 §2).
 *
 * Offers and deals are property children: `organizationId` = the property's
 * portfolio org, scoped through the parent (`{ property: propertyScopeWhere }`)
 * — never by a bare org match alone.
 *
 * Rules the smoke leans on:
 * - A counter is a NEW row (`supersedesOfferId`); offers are never
 *   overwritten. The old row moves to COUNTERED in the same transaction.
 * - Accept is transactional: only one live ACCEPTED offer per listing (409
 *   on a second accept), the listing flips to UNDER_OFFER, and a
 *   `PropertyDeal` opens automatically with a category-aware checklist.
 * - Deal completion (`ownership.update`) writes the ownership flip: seller
 *   rows close (`endsAt`), a buyer row opens, deal → COMPLETED, listing →
 *   SOLD/RENTED (+ a SOLD price-history row), all in one transaction.
 */
import { Prisma } from '@workspace/database';
import type {  } from '@workspace/database';

import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';

import { auditLog } from './audit';
import { propertyScopeWhere, type ScopeActor } from './property-scope';
import { assertLeadReadable, listingOwnerWhere } from './sales';
import { dealChecklistTemplate, DEAL_TRANSITIONS, OFFER_APPROVABLE } from './sales-constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OFFER_STATUSES = ['SUBMITTED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'] as const;
const LISTABLE_OFFER_STATUSES = [...OFFER_STATUSES];
const DEAL_STATUSES = ['AGREED', 'DUE_DILIGENCE', 'COMPLETION_PENDING', 'COMPLETED', 'COLLAPSED'] as const;

// ── helpers ─────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function num(v: unknown, field: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new RouteError(400, `${field} must be a number`);
  if (n <= 0) throw new RouteError(400, `${field} must be positive`);
  if (n > 100_000_000) throw new RouteError(400, `${field} is too large`);
  return n;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  const s = String(v ?? '').trim().toUpperCase() as T;
  if (!allowed.includes(s)) throw new RouteError(400, `${field} must be one of ${allowed.join(', ')}`);
  return s;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function price(v: unknown): string {
  return Number(v).toFixed(2);
}

function dateOrNull(v: unknown, field: string): Date | null {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} must be a valid date`);
  return d;
}

function dealScopeWhere(actor: ScopeActor): Prisma.PropertyDealWhereInput {
  return {
    OR: [{ property: propertyScopeWhere(actor) }, { organizationId: actor.organizationId }],
  };
}

function offerScopeWhere(actor: ScopeActor): Prisma.OfferWhereInput {
  return {
    OR: [{ property: propertyScopeWhere(actor) }, { organizationId: actor.organizationId }],
  };
}

const OFFER_INCLUDE = {
  listing: {
    select: {
      id: true,
      title: true,
      status: true,
      purpose: true,
      currency: true,
      organizationId: true,
      marketingOrganizationId: true,
      propertyId: true,
    },
  },
  property: { select: { id: true, name: true, locality: true, category: true } },
  lead: { select: { id: true, displayName: true, phone: true, status: true } },
  supersedes: {
    select: { id: true, amount: true, currency: true, status: true, offerDate: true, terms: true },
  },
  counters: {
    select: { id: true, amount: true, status: true, offerDate: true, supersedesOfferId: true },
    orderBy: { offerDate: 'asc' as const },
  },
  deal: { select: { id: true, status: true } },
} as const;

type OfferRow = Prisma.OfferGetPayload<{ include: typeof OFFER_INCLUDE }>;

function shapeOffer(row: OfferRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    listingId: row.listingId,
    propertyId: row.propertyId,
    leadId: row.leadId,
    amount: price(row.amount),
    currency: row.currency,
    offerDate: row.offerDate.toISOString().slice(0, 10),
    status: row.status,
    terms: row.terms,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    supersedesOfferId: row.supersedesOfferId,
    respondedByUserId: row.respondedByUserId,
    respondedAt: row.respondedAt ? row.respondedAt.toISOString() : null,
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    listing: row.listing
      ? {
          id: row.listing.id,
          title: row.listing.title,
          status: row.listing.status,
          purpose: row.listing.purpose,
        }
      : null,
    property: row.property,
    lead: row.lead,
    deal: row.deal,
    supersedes: row.supersedes
      ? {
          id: row.supersedes.id,
          amount: price(row.supersedes.amount),
          currency: row.supersedes.currency,
          status: row.supersedes.status,
          offerDate: row.supersedes.offerDate.toISOString().slice(0, 10),
          terms: row.supersedes.terms,
        }
      : null,
    counters: row.counters.map((c) => ({
      id: c.id,
      amount: price(c.amount),
      status: c.status,
      offerDate: c.offerDate.toISOString().slice(0, 10),
      supersedesOfferId: c.supersedesOfferId,
    })),
  };
}

async function fetchOffer(actor: ScopeActor, id: string) {
  if (!UUID_RE.test(id)) throw new RouteError(404, 'Offer not found');
  const row = await db.offer.findFirst({
    where: { id, ...offerScopeWhere(actor) },
    include: OFFER_INCLUDE,
  });
  if (!row) throw new RouteError(404, 'Offer not found');
  return row;
}

// ── offers ──────────────────────────────────────────────────────────────────

export async function listOffers(
  actor: ScopeActor,
  query: { listingId?: string; status?: string } = {},
) {
  const where: Prisma.OfferWhereInput = { ...offerScopeWhere(actor) };
  if (query.listingId) where.listingId = query.listingId;
  if (query.status) where.status = oneOf(query.status, LISTABLE_OFFER_STATUSES, 'status');

  const rows = await db.offer.findMany({
    where,
    include: OFFER_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  return rows.map(shapeOffer);
}

export async function getOffer(actor: ScopeActor, id: string) {
  return shapeOffer(await fetchOffer(actor, id));
}

export async function createOffer(actor: ScopeActor, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  const listingId = str(body.listingId);
  if (!listingId || !UUID_RE.test(listingId)) throw new RouteError(400, 'listingId is required');

  // Owner-side reach only — a shared (marketing) listing is not offerable
  // from the marketing arm (route permission `offer.create` already blocks
  // MK marketing_agent before this runs).
  const listing = await db.listing.findFirst({
    where: { id: listingId, ...listingOwnerWhere(actor) },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      currency: true,
      status: true,
      purpose: true,
    },
  });
  if (!listing) throw new RouteError(404, 'Listing not found');
  if (listing.status !== 'PUBLISHED' && listing.status !== 'UNDER_OFFER') {
    throw new RouteError(400, 'Offers can only be made on a published listing');
  }

  const amount = num(body.amount, 'amount');
  const leadId = str(body.leadId);
  if (leadId) await assertLeadReadable(actor, leadId);
  if (body.terms !== undefined && body.terms !== null && !isPlainObject(body.terms)) {
    throw new RouteError(400, 'terms must be an object');
  }

  const offerDate = dateOrNull(body.offerDate, 'offerDate') ?? new Date();

  const offer = await db.offer.create({
    data: {
      organizationId: listing.organizationId,
      listingId: listing.id,
      propertyId: listing.propertyId,
      leadId,
      amount,
      currency: listing.currency,
      offerDate,
      status: 'SUBMITTED',
      terms: (body.terms as Prisma.InputJsonValue) ?? undefined,
      expiresAt: dateOrNull(body.expiresAt, 'expiresAt'),
    },
    select: { id: true },
  });

  await auditLog(
    actor,
    'OFFER',
    'offer.create',
    offer.id,
    { listingId: listing.id, amount, currency: listing.currency },
    listing.organizationId,
  );
  return getOffer(actor, offer.id);
}

export async function counterOffer(actor: ScopeActor, id: string, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  const row = await fetchOffer(actor, id);
  if (!OFFER_APPROVABLE.includes(row.status)) {
    throw new RouteError(409, `An offer in status ${row.status} cannot be countered`);
  }
  const amount = num(body.amount, 'amount');
  if (body.terms !== undefined && body.terms !== null && !isPlainObject(body.terms)) {
    throw new RouteError(400, 'terms must be an object');
  }

  const counter = await db.$transaction(async (tx) => {
    const old = await tx.offer.updateMany({
      where: { id: row.id, status: row.status },
      data: { status: 'COUNTERED', respondedByUserId: actor.userId, respondedAt: new Date() },
    });
    if (old.count === 0) throw new RouteError(409, 'The offer changed while countering — reload');

    return tx.offer.create({
      data: {
        organizationId: row.organizationId,
        listingId: row.listingId,
        propertyId: row.propertyId,
        leadId: row.leadId,
        amount,
        currency: row.currency,
        offerDate: new Date(),
        status: 'SUBMITTED',
        terms: (body.terms as Prisma.InputJsonValue) ?? undefined,
        expiresAt: row.expiresAt,
        supersedesOfferId: row.id,
      },
      select: { id: true },
    });
  });

  await auditLog(
    actor,
    'OFFER',
    'offer.counter',
    counter.id,
    { supersedes: row.id, from: price(row.amount), to: amount },
    row.organizationId,
  );
  return getOffer(actor, counter.id);
}

export async function approveOffer(actor: ScopeActor, id: string, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  const row = await fetchOffer(actor, id);
  if (!OFFER_APPROVABLE.includes(row.status)) {
    throw new RouteError(409, `An offer in status ${row.status} cannot be decided`);
  }
  const to = oneOf(body.to, ['ACCEPTED', 'REJECTED'] as const, 'to');

  if (to === 'REJECTED') {
    await db.$transaction(async (tx) => {
      const res = await tx.offer.updateMany({
        where: { id: row.id, status: row.status },
        data: { status: 'REJECTED', respondedByUserId: actor.userId, respondedAt: new Date() },
      });
      if (res.count === 0) throw new RouteError(409, 'The offer changed while deciding — reload');
    });
    await auditLog(actor, 'OFFER', 'offer.reject', row.id, { listingId: row.listingId }, row.organizationId);
    return getOffer(actor, id);
  }

  const property = await db.property.findUnique({
    where: { id: row.propertyId },
    select: { category: true },
  });

  await db.$transaction(async (tx) => {
    const live = await tx.offer.findFirst({
      where: { listingId: row.listingId, status: 'ACCEPTED', id: { not: row.id } },
      select: { id: true },
    });
    if (live) {
      throw new RouteError(409, 'Another offer on this listing has already been accepted');
    }

    const res = await tx.offer.updateMany({
      where: { id: row.id, status: row.status },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        respondedByUserId: actor.userId,
        respondedAt: new Date(),
      },
    });
    if (res.count === 0) throw new RouteError(409, 'The offer changed while accepting — reload');

    const listing = await tx.listing.updateMany({
      where: { id: row.listingId, status: { in: ['PUBLISHED', 'UNDER_OFFER'] } },
      data: { status: 'UNDER_OFFER' },
    });
    if (listing.count === 0) throw new RouteError(409, 'The listing is no longer available for offers');

    await tx.propertyDeal.create({
      data: {
        organizationId: row.organizationId,
        offerId: row.id,
        propertyId: row.propertyId,
        buyerLeadId: row.leadId,
        salePrice: Number(row.amount),
        currency: row.currency,
        status: 'AGREED',
        checklist: dealChecklistTemplate(property?.category ?? 'RESIDENTIAL'),
        openedAt: new Date(),
      },
    });
  });

  await auditLog(
    actor,
    'OFFER',
    'offer.accept',
    row.id,
    { listingId: row.listingId, amount: price(row.amount) },
    row.organizationId,
  );
  return getOffer(actor, id);
}

// ── deals ───────────────────────────────────────────────────────────────────

const DEAL_INCLUDE = {
  offer: {
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      offerDate: true,
      supersedesOfferId: true,
      listing: { select: { id: true, title: true, status: true, purpose: true } },
    },
  },
  property: { select: { id: true, name: true, locality: true, category: true } },
  buyerLead: { select: { id: true, displayName: true, phone: true, status: true } },
  buyerOwnerParty: { select: { id: true, name: true, organizationId: true } },
} as const;

type DealRow = Prisma.PropertyDealGetPayload<{ include: typeof DEAL_INCLUDE }>;

function shapeDeal(row: DealRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    offerId: row.offerId,
    propertyId: row.propertyId,
    buyerLeadId: row.buyerLeadId,
    buyerOwnerPartyId: row.buyerOwnerPartyId,
    salePrice: price(row.salePrice),
    currency: row.currency,
    status: row.status,
    checklist: row.checklist,
    commissionAmount: row.commissionAmount === null ? null : price(row.commissionAmount),
    completionDate: row.completionDate ? row.completionDate.toISOString() : null,
    notes: row.notes,
    openedAt: row.openedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    offer: row.offer
      ? {
          ...row.offer,
          amount: price(row.offer.amount),
          offerDate: row.offer.offerDate.toISOString().slice(0, 10),
        }
      : null,
    property: row.property,
    buyerLead: row.buyerLead,
    buyerOwnerParty: row.buyerOwnerParty,
  };
}

async function fetchDeal(actor: ScopeActor, id: string) {
  if (!UUID_RE.test(id)) throw new RouteError(404, 'Deal not found');
  const row = await db.propertyDeal.findFirst({
    where: { id, ...dealScopeWhere(actor) },
    include: DEAL_INCLUDE,
  });
  if (!row) throw new RouteError(404, 'Deal not found');
  return row;
}

export async function getDeal(actor: ScopeActor, id: string) {
  return shapeDeal(await fetchDeal(actor, id));
}

type ChecklistItem = {
  key: string;
  label: string;
  mandatory: boolean;
  done: boolean;
  doneByUserId: string | null;
  doneAt: string | null;
};

function mergeChecklist(
  stored: unknown,
  patch: unknown,
  actor: ScopeActor,
): ChecklistItem[] {
  if (!Array.isArray(stored)) throw new RouteError(500, 'Deal checklist is malformed');
  if (!Array.isArray(patch)) throw new RouteError(400, 'checklist must be an array of { key, done }');

  const merged: ChecklistItem[] = stored.map((item) => {
    const base = isPlainObject(item) ? item : {};
    return {
      key: String(base.key ?? ''),
      label: String(base.label ?? base.key ?? ''),
      mandatory: base.mandatory === true,
      done: base.done === true,
      doneByUserId: typeof base.doneByUserId === 'string' ? base.doneByUserId : null,
      doneAt: typeof base.doneAt === 'string' ? base.doneAt : null,
    };
  });

  for (const entry of patch) {
    if (!isPlainObject(entry)) throw new RouteError(400, 'checklist entries must be objects');
    const key = str(entry.key);
    const item = merged.find((i) => i.key === key);
    if (!item) throw new RouteError(400, `Unknown checklist item: ${key ?? ''}`);
    if (typeof entry.done === 'boolean') {
      item.done = entry.done;
      item.doneByUserId = entry.done ? actor.userId : null;
      item.doneAt = entry.done ? new Date().toISOString() : null;
    }
  }
  return merged;
}

const DEAL_PATCHABLE = ['checklist', 'commissionAmount', 'notes', 'status', 'buyerOwnerPartyId'] as const;

export async function patchDeal(actor: ScopeActor, id: string, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  const row = await fetchDeal(actor, id);
  if (row.status === 'COMPLETED' || row.status === 'COLLAPSED') {
    throw new RouteError(409, `A deal in status ${row.status} can no longer be edited`);
  }

  for (const key of Object.keys(body)) {
    if (body[key] === undefined) continue;
    if (!(DEAL_PATCHABLE as readonly string[]).includes(key)) {
      throw new RouteError(400, `${key} is not a editable deal field`);
    }
  }

  const data: Prisma.PropertyDealUncheckedUpdateManyInput = {};
  const touched: string[] = [];

  if (Object.prototype.hasOwnProperty.call(body, 'checklist')) {
    data.checklist = mergeChecklist(row.checklist, body.checklist, actor) as unknown as Prisma.InputJsonValue;
    touched.push('checklist');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'commissionAmount')) {
    const v = body.commissionAmount;
    if (v !== null && v !== undefined && v !== '') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new RouteError(400, 'commissionAmount must be a positive number');
      data.commissionAmount = n;
    } else {
      data.commissionAmount = null;
    }
    touched.push('commissionAmount');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
    data.notes = str(body.notes);
    touched.push('notes');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const to = oneOf(body.status, DEAL_STATUSES, 'status');
    if (to === 'COMPLETED') {
      throw new RouteError(400, 'Use the complete action to finish a deal');
    }
    if (!DEAL_TRANSITIONS[row.status].includes(to)) {
      throw new RouteError(409, `A deal in status ${row.status} cannot move to ${to}`);
    }
    data.status = to;
    touched.push('status');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'buyerOwnerPartyId')) {
    const partyId = str(body.buyerOwnerPartyId);
    if (partyId) {
      // Buyer party must live in the deal's organization (the property's
      // portfolio org — same invariant ownership.createOwnership enforces).
      const party = await db.propertyOwnerParty.findFirst({
        where: { id: partyId, organizationId: row.organizationId },
        select: { id: true },
      });
      if (!party) throw new RouteError(404, 'Buyer party not found in this organization');
    }
    data.buyerOwnerPartyId = partyId;
    touched.push('buyerOwnerPartyId');
  }

  if (touched.length > 0) {
    await db.propertyDeal.updateMany({
      where: { id: row.id, organizationId: row.organizationId },
      data,
    });
    await auditLog(actor, 'DEAL', 'deal.update', row.id, { fields: touched }, row.organizationId);
  }
  return getDeal(actor, id);
}

export async function completeDeal(actor: ScopeActor, id: string, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  const row = await fetchDeal(actor, id);
  if (!['AGREED', 'DUE_DILIGENCE', 'COMPLETION_PENDING'].includes(row.status)) {
    throw new RouteError(409, `A deal in status ${row.status} cannot be completed`);
  }

  const partyId = str(body.buyerOwnerPartyId) ?? row.buyerOwnerPartyId;
  if (!partyId) {
    throw new RouteError(400, 'Set the buyer party first (PATCH buyerOwnerPartyId)');
  }
  const party = await db.propertyOwnerParty.findFirst({
    where: { id: partyId, organizationId: row.organizationId },
    select: { id: true },
  });
  if (!party) throw new RouteError(404, 'Buyer party not found in this organization');

  const property = await db.property.findUnique({
    where: { id: row.propertyId },
    select: { portfolioOrganizationId: true, category: true },
  });
  if (!property) throw new RouteError(404, 'Property not found');

  const now = new Date();

  await db.$transaction(async (tx) => {
    const res = await tx.propertyDeal.updateMany({
      where: { id: row.id, status: row.status },
      data: { status: 'COMPLETED', completionDate: now, buyerOwnerPartyId: partyId },
    });
    if (res.count === 0) throw new RouteError(409, 'The deal changed while completing — reload');

    // Close every open SELLER row (never the buyer's own), remembering the
    // share to hand over.
    const sellers = await tx.propertyOwnership.findMany({
      where: { propertyId: row.propertyId, endsAt: null },
      select: { id: true, sharePercent: true, ownerPartyId: true },
    });
    const toClose = sellers.filter((s) => s.ownerPartyId !== partyId);
    if (toClose.length > 0) {
      await tx.propertyOwnership.updateMany({
        where: { id: { in: toClose.map((s) => s.id) } },
        data: { endsAt: now },
      });
    }

    const alreadyOwns = toClose.length !== sellers.length;
    if (!alreadyOwns) {
      const share =
        toClose.length === 1 && toClose[0]!.sharePercent !== null
          ? Number(toClose[0]!.sharePercent)
          : 100;
      await tx.propertyOwnership.create({
        data: {
          organizationId: property.portfolioOrganizationId,
          propertyId: row.propertyId,
          ownerPartyId: partyId,
          sharePercent: share,
          startsAt: now,
          endsAt: null,
        },
      });
    }

    // Close the listing the accepted offer sat on (+ SOLD price history).
    if (row.offer?.listing) {
      const listing = row.offer.listing;
      if (listing.status === 'PUBLISHED' || listing.status === 'UNDER_OFFER') {
        const to = listing.purpose === 'SALE' ? 'SOLD' : 'RENTED';
        const upd = await tx.listing.updateMany({
          where: { id: listing.id, status: listing.status },
          data: { status: to },
        });
        if (upd.count > 0) {
          const hist = await tx.listing.findUnique({
            where: { id: listing.id },
            select: { askingPrice: true, currency: true },
          });
          if (hist?.askingPrice !== null && hist?.askingPrice !== undefined) {
            await tx.listingPriceHistory.create({
              data: {
                listingId: listing.id,
                price: Number(hist.askingPrice),
                event: 'SOLD',
                note: `Deal completed — closed as ${to}`,
                changedByUserId: actor.userId,
              },
            });
          }
          await auditLog(
            actor,
            'LISTING',
            'listing.close',
            listing.id,
            { from: listing.status, to },
            row.organizationId,
          );
        }
      }
    }
  });

  await auditLog(
    actor,
    'DEAL',
    'deal.complete',
    row.id,
    { salePrice: price(row.salePrice), buyerOwnerPartyId: partyId },
    row.organizationId,
  );
  return getDeal(actor, id);
}
