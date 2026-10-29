/**
 * Cross-org lead handoffs (plan-slice-5 §1–2).
 *
 * The capturing org's Lead row is NEVER re-pointed — a handoff is a
 * relationship row between two organizations over that lead. ACCEPTED is
 * what grants the receiver read access (the `handoffs.some(ACCEPTED)` arm
 * in leadScopeWhere); DECLINED/EXPIRED grant nothing.
 *
 * create: `handoff.create`, fromOrganizationId = actor.org, lead must be
 * own-org, target org is a free choice (UI previews the org name/slug).
 * respond: receiver org only, gated on `lead.update` in the RECEIVER org.
 */
import { Prisma } from '@workspace/database';
import type { HandoffStatus } from '@workspace/database';

import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';

import { auditLog } from './audit';
import type { ScopeActor } from './property-scope';
import { listingScopeWhere } from './sales';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESPOND_TO = ['ACCEPTED', 'DECLINED'] as const;

const HANDOFF_INCLUDE = {
  lead: { select: { id: true, displayName: true, phone: true, email: true, status: true } },
  listing: { select: { id: true, title: true, status: true, purpose: true } },
  fromOrganization: { select: { id: true, name: true, kind: true } },
  toOrganization: { select: { id: true, name: true, kind: true } },
} as const;

type HandoffRow = Prisma.HandoffGetPayload<{ include: typeof HANDOFF_INCLUDE }>;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function shapeHandoff(row: HandoffRow, actor: ScopeActor) {
  return {
    id: row.id,
    status: row.status,
    message: row.message,
    leadId: row.leadId,
    listingId: row.listingId,
    fromOrganizationId: row.fromOrganizationId,
    toOrganizationId: row.toOrganizationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    respondedAt: row.respondedAt ? row.respondedAt.toISOString() : null,
    respondedByUserId: row.respondedByUserId,
    direction: row.fromOrganizationId === actor.organizationId ? 'OUTGOING' : 'INCOMING',
    canRespond: row.status === 'OFFERED' && row.toOrganizationId === actor.organizationId,
    lead: row.lead,
    listing: row.listing,
    fromOrganization: row.fromOrganization,
    toOrganization: row.toOrganization,
  };
}

function handoffScopeWhere(actor: ScopeActor): Prisma.HandoffWhereInput {
  return {
    OR: [
      { fromOrganizationId: actor.organizationId },
      { toOrganizationId: actor.organizationId },
    ],
  };
}

export async function listHandoffs(
  actor: ScopeActor,
  query: { direction?: string; status?: string } = {},
) {
  const arms: Prisma.HandoffWhereInput[] = [];
  if (query.direction === 'outgoing') {
    arms.push({ fromOrganizationId: actor.organizationId });
  } else if (query.direction === 'incoming') {
    arms.push({ toOrganizationId: actor.organizationId });
  } else {
    arms.push(
      { fromOrganizationId: actor.organizationId },
      { toOrganizationId: actor.organizationId },
    );
  }

  const where: Prisma.HandoffWhereInput = { OR: arms };
  if (query.status) {
    const s = String(query.status).toUpperCase() as HandoffStatus;
    if (!['OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED'].includes(s)) {
      throw new RouteError(400, 'status must be one of OFFERED, ACCEPTED, DECLINED, EXPIRED');
    }
    where.status = s;
  }

  const rows = await db.handoff.findMany({
    where,
    include: HANDOFF_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((row) => shapeHandoff(row, actor));
}

/**
 * Free org search for the handoff dialog: id/name/kind of OTHER active orgs
 * matching a name/slug query (plan §2 — "free org slug search on this
 * endpoint, UI validates preview of target org name").
 */
export async function searchHandoffTargets(actor: ScopeActor, q: unknown) {
  const term = typeof q === 'string' ? q.trim() : '';
  if (term.length < 2) return [];

  const rows = await db.organization.findMany({
    where: {
      id: { not: actor.organizationId },
      status: 'ACTIVE',
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, slug: true, kind: true },
    orderBy: { name: 'asc' },
    take: 8,
  });
  return rows;
}

export async function getHandoff(actor: ScopeActor, id: string) {
  if (!UUID_RE.test(id)) throw new RouteError(404, 'Handoff not found');
  const row = await db.handoff.findFirst({
    where: { id, ...handoffScopeWhere(actor) },
    include: HANDOFF_INCLUDE,
  });
  if (!row) throw new RouteError(404, 'Handoff not found');
  return shapeHandoff(row, actor);
}

export async function createHandoff(actor: ScopeActor, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};

  const leadId = str(body.leadId);
  if (!leadId || !UUID_RE.test(leadId)) throw new RouteError(400, 'leadId is required');
  const toOrganizationId = str(body.toOrganizationId);
  if (!toOrganizationId || !UUID_RE.test(toOrganizationId)) {
    throw new RouteError(400, 'toOrganizationId is required');
  }
  if (toOrganizationId === actor.organizationId) {
    throw new RouteError(400, 'Cannot hand off to your own organization');
  }

  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId },
    select: { id: true },
  });
  if (!lead) throw new RouteError(404, 'Lead not found');

  const target = await db.organization.findFirst({
    where: { id: toOrganizationId, status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  if (!target) throw new RouteError(404, 'Target organization not found');

  let listingId: string | null = null;
  if (str(body.listingId)) {
    const listing = await db.listing.findFirst({
      where: { id: str(body.listingId)!, ...listingScopeWhere(actor) },
      select: { id: true },
    });
    if (!listing) throw new RouteError(404, 'Listing not found');
    listingId = listing.id;
  }

  const pending = await db.handoff.findFirst({
    where: { leadId, toOrganizationId, status: 'OFFERED' },
    select: { id: true },
  });
  if (pending) throw new RouteError(409, 'A handoff to this organization is already pending');

  const message = str(body.message);
  const handoff = await db.handoff.create({
    data: {
      fromOrganizationId: actor.organizationId,
      toOrganizationId,
      leadId,
      listingId,
      status: 'OFFERED',
      message: message ? message.slice(0, 1000) : null,
    },
    select: { id: true },
  });

  await auditLog(actor, 'HANDOFF', 'handoff.create', handoff.id, {
    leadId,
    toOrganizationId,
    to: target.name,
  });
  return getHandoff(actor, handoff.id);
}

export async function respondHandoff(actor: ScopeActor, id: string, raw: unknown) {
  const body = isPlainObject(raw) ? raw : {};
  if (!UUID_RE.test(id)) throw new RouteError(404, 'Handoff not found');

  const row = await db.handoff.findFirst({
    where: { id, toOrganizationId: actor.organizationId },
    select: { id: true, status: true, fromOrganizationId: true, leadId: true },
  });
  if (!row) throw new RouteError(404, 'Handoff not found');
  if (row.status !== 'OFFERED') {
    throw new RouteError(409, `A handoff in status ${row.status} cannot be responded to`);
  }

  const rawTo = String(body.to ?? '').toUpperCase();
  if (!RESPOND_TO.includes(rawTo as (typeof RESPOND_TO)[number])) {
    throw new RouteError(400, `to must be one of ${RESPOND_TO.join(', ')}`);
  }
  const to = rawTo as HandoffStatus;

  await db.$transaction(async (tx) => {
    const res = await tx.handoff.updateMany({
      where: { id: row.id, status: 'OFFERED', toOrganizationId: actor.organizationId },
      data: {
        status: to,
        respondedAt: new Date(),
        respondedByUserId: actor.userId,
      },
    });
    if (res.count === 0) throw new RouteError(409, 'The handoff was already answered — reload');
  });

  // ACCEPTED grants the receiver the read arm over the lead — the lead row
  // itself is never touched (re-point rule).
  await auditLog(actor, 'HANDOFF', 'handoff.respond', row.id, {
    to,
    leadId: row.leadId,
    fromOrganizationId: row.fromOrganizationId,
  });

  return getHandoff(actor, id);
}
