/**
 * Financial adjustments (Slice 8) — the charge-correction write path.
 *
 * Submit → PENDING (`adjustment.create`) → APPROVED/REJECTED
 * (`adjustment.approve`). An APPROVED adjustment (any type: CREDIT, WAIVER,
 * REVERSAL, WRITE_OFF) reduces its charge's open balance on every read —
 * the same rule `propertyBalances` has always applied. Pending/rejected are
 * inert. Void = a REVERSAL through this flow (plan-slice-8 §1 — no separate
 * void endpoint).
 *
 * Scoping: children of a charge → through the charge's property
 * (`propertyScopeWhere`) plus the row's own `organizationId` (the
 * submitting org), matching the charge/payment pattern.
 */

import type { AdjustmentStatus, AdjustmentType, Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import { propertyScopeWhere, type ScopeActor } from './property-scope';

type Raw = Record<string, unknown>;

export const ADJUSTMENT_TYPES: AdjustmentType[] = ['CREDIT', 'WAIVER', 'REVERSAL', 'WRITE_OFF'];
const DECISIONS: AdjustmentStatus[] = ['APPROVED', 'REJECTED'];

/** Decimal dust — amounts are (12,2), open balances carry cents. */
const EPSILON = 0.009;

export interface AdjustmentRow {
  id: string;
  chargeId: string;
  propertyId: string;
  type: AdjustmentType;
  amount: string;
  reason: string;
  status: AdjustmentStatus;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  decidedAt: string | null;
  createdAt: string;
  charge: {
    id: string;
    chargeType: string;
    title: string | null;
    amount: string;
    currency: string;
    balance: string;
    dueDate: string;
    unit: { id: string; unitRef: string } | null;
    property: { id: string; name: string };
    tenant: { id: string; displayName: string } | null;
  };
  submittedBy: { id: string; displayName: string | null; email: string } | null;
  approvedBy: { id: string; displayName: string | null; email: string } | null;
}

const CHARGE_SELECT = {
  id: true,
  propertyId: true,
  chargeType: true,
  title: true,
  amount: true,
  currency: true,
  dueDate: true,
  unit: { select: { id: true, unitRef: true } },
  property: { select: { id: true, name: true } },
  tenant: { select: { id: true, displayName: true } },
  allocations: { select: { amount: true } },
  adjustments: { select: { amount: true, status: true } },
} satisfies Prisma.ChargeSelect;

type ChargeForAdjustment = Prisma.ChargeGetPayload<{ select: typeof CHARGE_SELECT }>;

function chargeBalance(c: ChargeForAdjustment): number {
  const allocated = c.allocations.reduce((s, a) => s + Number(a.amount), 0);
  const adjusted = c.adjustments
    .filter((a) => a.status === 'APPROVED')
    .reduce((s, a) => s + Number(a.amount), 0);
  return Number(c.amount) - allocated - adjusted;
}

function shape(row: {
  id: string;
  chargeId: string;
  propertyId: string;
  type: AdjustmentType;
  amount: { toString(): string };
  reason: string;
  status: AdjustmentStatus;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  charge: ChargeForAdjustment;
}, people: Map<string, { id: string; displayName: string | null; email: string }>): AdjustmentRow {
  return {
    id: row.id,
    chargeId: row.chargeId,
    propertyId: row.propertyId,
    type: row.type,
    amount: row.amount.toString(),
    reason: row.reason,
    status: row.status,
    submittedByUserId: row.submittedByUserId,
    approvedByUserId: row.approvedByUserId,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    charge: {
      id: row.charge.id,
      chargeType: row.charge.chargeType as string,
      title: row.charge.title,
      amount: row.charge.amount.toString(),
      currency: row.charge.currency,
      balance: chargeBalance(row.charge).toFixed(2),
      dueDate: row.charge.dueDate.toISOString().slice(0, 10),
      unit: row.charge.unit,
      property: row.charge.property,
      tenant: row.charge.tenant,
    },
    submittedBy: row.submittedByUserId ? (people.get(row.submittedByUserId) ?? null) : null,
    approvedBy: row.approvedByUserId ? (people.get(row.approvedByUserId) ?? null) : null,
  };
}

/** Resolve submitter/approver display names (plain-uuid actors, no relation). */
async function peopleMap(ids: (string | null)[]): Promise<
  Map<string, { id: string; displayName: string | null; email: string }>
> {
  const unique = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  if (unique.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

/**
 * Submit an adjustment against an in-scope charge. Validates the amount is
 * positive and does not exceed the charge's current open balance (so an
 * approved adjustment can never push the charge negative).
 */
export async function createAdjustment(actor: ScopeActor, raw: unknown): Promise<AdjustmentRow> {
  const body = (raw ?? {}) as Raw;
  const chargeId = typeof body.chargeId === 'string' ? body.chargeId.trim() : '';
  if (!chargeId) throw new RouteError(400, 'chargeId is required');

  const charge = await db.charge.findFirst({
    where: { id: chargeId, organizationId: actor.organizationId, property: propertyScopeWhere(actor) },
    select: CHARGE_SELECT,
  });
  if (!charge) throw new RouteError(404, 'Charge not found');

  const type = typeof body.type === 'string' ? body.type.trim().toUpperCase() : '';
  if (!ADJUSTMENT_TYPES.includes(type as AdjustmentType)) {
    throw new RouteError(400, `type must be one of ${ADJUSTMENT_TYPES.join(', ')}`);
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new RouteError(400, 'amount must be positive');
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 3) throw new RouteError(400, 'reason is required');

  const open = chargeBalance(charge);
  if (open <= 0) throw new RouteError(400, 'Charge has no open balance to adjust');
  if (amount > open + EPSILON) {
    throw new RouteError(400, `amount exceeds the open balance (${open.toFixed(2)})`);
  }

  const row = await db.financialAdjustment.create({
    data: {
      organizationId: actor.organizationId,
      propertyId: charge.propertyId,
      chargeId: charge.id,
      type: type as AdjustmentType,
      amount,
      reason,
      status: 'PENDING',
      submittedByUserId: actor.userId,
    },
    select: {
      id: true,
      chargeId: true,
      propertyId: true,
      type: true,
      amount: true,
      reason: true,
      status: true,
      submittedByUserId: true,
      approvedByUserId: true,
      decidedAt: true,
      createdAt: true,
      charge: { select: CHARGE_SELECT },
    },
  });

  await auditLog(actor, 'ADJUSTMENT', 'adjustment.create', row.id, {
    chargeId: charge.id,
    type: row.type,
    amount: row.amount.toString(),
  });
  const people = await peopleMap([row.submittedByUserId]);
  return shape(row, people);
}

export interface AdjustmentFilters {
  propertyId?: string;
  status?: string;
  chargeId?: string;
}

/** Queue/register of adjustments in scope (charge's property). */
export async function listAdjustments(actor: ScopeActor, filters: AdjustmentFilters = {}): Promise<AdjustmentRow[]> {
  const and: Prisma.FinancialAdjustmentWhereInput[] = [
    { organizationId: actor.organizationId },
    { charge: { property: propertyScopeWhere(actor) } },
  ];
  if (filters.propertyId) and.push({ propertyId: filters.propertyId });
  if (filters.chargeId) and.push({ chargeId: filters.chargeId });
  if (filters.status) {
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(filters.status)) {
      throw new RouteError(400, 'status must be PENDING, APPROVED or REJECTED');
    }
    and.push({ status: filters.status as AdjustmentStatus });
  }

  const rows = await db.financialAdjustment.findMany({
    where: { AND: and },
    select: {
      id: true,
      chargeId: true,
      propertyId: true,
      type: true,
      amount: true,
      reason: true,
      status: true,
      submittedByUserId: true,
      approvedByUserId: true,
      decidedAt: true,
      createdAt: true,
      charge: { select: CHARGE_SELECT },
    },
    // PENDING first, then newest submission.
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
  const people = await peopleMap(rows.flatMap((r) => [r.submittedByUserId, r.approvedByUserId]));
  return rows.map((r) => shape(r, people));
}

/**
 * Approve or reject a PENDING adjustment (separation of duties: whoever
 * holds `adjustment.approve` decides; the submitter is stamped for audit).
 * A second decision races the `status: 'PENDING'` guard → 409.
 */
export async function decideAdjustment(
  actor: ScopeActor,
  id: string,
  decision: AdjustmentStatus,
): Promise<AdjustmentRow> {
  if (!DECISIONS.includes(decision)) throw new RouteError(400, 'decision must be APPROVED or REJECTED');

  const existing = await db.financialAdjustment.findFirst({
    where: { id, organizationId: actor.organizationId, charge: { property: propertyScopeWhere(actor) } },
    select: { id: true, status: true, submittedByUserId: true },
  });
  if (!existing) throw new RouteError(404, 'Adjustment not found');
  if (existing.status !== 'PENDING') {
    throw new RouteError(409, `Adjustment already ${existing.status.toLowerCase()}`);
  }

  const updated = await db.financialAdjustment.updateMany({
    where: { id: existing.id, organizationId: actor.organizationId, status: 'PENDING' },
    data: { status: decision, approvedByUserId: actor.userId, decidedAt: new Date() },
  });
  if (updated.count === 0) throw new RouteError(409, 'Adjustment already decided');

  await auditLog(actor, 'ADJUSTMENT', `adjustment.${decision === 'APPROVED' ? 'approve' : 'reject'}`, id, {
    decision,
  });

  const row = await db.financialAdjustment.findFirst({
    where: { id },
    select: {
      id: true,
      chargeId: true,
      propertyId: true,
      type: true,
      amount: true,
      reason: true,
      status: true,
      submittedByUserId: true,
      approvedByUserId: true,
      decidedAt: true,
      createdAt: true,
      charge: { select: CHARGE_SELECT },
    },
  });
  if (!row) throw new RouteError(404, 'Adjustment not found');
  const people = await peopleMap([row.submittedByUserId, row.approvedByUserId]);
  return shape(row, people);
}
