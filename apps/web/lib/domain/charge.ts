/**
 * Charge ledger reads (finances slice — plan-slice-4 will extend this file
 * with the register/overview queries). First reader: the property register's
 * derived Balance column.
 *
 * Balance is DERIVED, never stored (plan-slice-4 rule):
 *   balance = Σ posted charges − Σ allocations − Σ approved adjustments
 * Charges with `postedAt = null` are drafts — not owed yet, excluded.
 * Approved adjustments (CREDIT/WAIVER/REVERSAL/WRITE_OFF) carry no currency
 * column, so they reduce the property's primary-currency bucket; charges in
 * other currencies are ignored until multi-currency statements land.
 */

import type { Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';

export type PropertyBalance = { amount: string; currency: string };

export async function propertyBalances(
  rows: { id: string; currency: string | null }[],
): Promise<Map<string, PropertyBalance>> {
  const out = new Map<string, PropertyBalance>();
  if (rows.length === 0) return out;
  const ids = rows.map((r) => r.id);

  const charges = await db.charge.findMany({
    where: { propertyId: { in: ids }, postedAt: { not: null } },
    select: { id: true, propertyId: true, currency: true, amount: true },
  });

  const chargeIds = charges.map((c) => c.id);
  const allocations = chargeIds.length
    ? await db.paymentAllocation.groupBy({
        by: ['chargeId'],
        where: { chargeId: { in: chargeIds } },
        _sum: { amount: true },
      })
    : [];
  const adjustments = await db.financialAdjustment.groupBy({
    by: ['propertyId'],
    where: { propertyId: { in: ids }, status: 'APPROVED' },
    _sum: { amount: true },
  });

  const rowCurrency = new Map(rows.map((r) => [r.id, r.currency]));
  const allocated = new Map(allocations.map((a) => [a.chargeId, a._sum.amount ?? 0]));
  const adjusted = new Map(adjustments.map((a) => [a.propertyId, a._sum.amount ?? 0]));

  // Resolve each property's primary currency (property.currency, else the
  // currency of its first posted charge, else KES).
  const bucket = new Map<string, string>();
  const billed = new Map<string, number>();
  const paid = new Map<string, number>();
  for (const c of charges) {
    const resolved = bucket.get(c.propertyId) ?? rowCurrency.get(c.propertyId) ?? c.currency;
    bucket.set(c.propertyId, resolved);
    if (c.currency !== resolved) continue;
    billed.set(c.propertyId, (billed.get(c.propertyId) ?? 0) + Number(c.amount));
    paid.set(c.propertyId, (paid.get(c.propertyId) ?? 0) + Number(allocated.get(c.id) ?? 0));
  }

  for (const id of ids) {
    const currency = bucket.get(id) ?? rowCurrency.get(id) ?? 'KES';
    const amount =
      (billed.get(id) ?? 0) - (paid.get(id) ?? 0) - Number(adjusted.get(id) ?? 0);
    out.set(id, { amount: amount.toFixed(2), currency });
  }
  return out;
}

// ── charge register (Slice-3 read API; writes stay with Slice 4) ─────────────

export interface ChargeFilters {
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  leaseId?: string;
  /** RENT | UTILITIES — via the charge's own type. */
  accountType?: string;
  posted?: boolean;
}

export interface ChargeRow {
  id: string;
  chargeType: string;
  title: string | null;
  amount: string;
  currency: string;
  dueDate: string;
  billingPeriodStart: string | null;
  postedAt: string | null;
  allocatedTotal: string;
  balance: string;
  accountType: 'RENT' | 'UTILITIES';
  tenant: { id: string; displayName: string } | null;
  unit: { id: string; unitRef: string } | null;
  leaseId: string | null;
  propertyId: string;
}

/**
 * Posted + draft charges in scope with DERIVED balance (amount − Σ
 * allocations; adjustments fold into the property-level balance above).
 * `accountType` buckets RENT vs everything-else (utilities) so the tenant
 * Payments/charges tabs can split them the same way payments do.
 */
export async function listCharges(actor: ScopeActor, filters: ChargeFilters = {}): Promise<ChargeRow[]> {
  if (filters.propertyId) await requirePropertyInScope(actor, filters.propertyId);
  const and: Prisma.ChargeWhereInput[] = [
    { organizationId: actor.organizationId },
    { property: propertyScopeWhere(actor) },
  ];
  if (filters.propertyId) and.push({ propertyId: filters.propertyId });
  if (filters.unitId) and.push({ unitId: filters.unitId });
  if (filters.tenantId) and.push({ tenantId: filters.tenantId });
  if (filters.leaseId) and.push({ leaseId: filters.leaseId });
  if (filters.posted === true) and.push({ postedAt: { not: null } });
  if (filters.posted === false) and.push({ postedAt: null });
  if (filters.accountType === 'RENT') and.push({ chargeType: 'RENT' });
  if (filters.accountType === 'UTILITIES') and.push({ chargeType: { not: 'RENT' } });

  const rows = await db.charge.findMany({
    where: { AND: and },
    select: {
      id: true,
      chargeType: true,
      title: true,
      amount: true,
      currency: true,
      dueDate: true,
      billingPeriodStart: true,
      postedAt: true,
      propertyId: true,
      leaseId: true,
      tenant: { select: { id: true, displayName: true } },
      unit: { select: { id: true, unitRef: true } },
      allocations: { select: { amount: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 200,
  });
  return rows.map((r) => {
    const allocated = r.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    const bucket = r.chargeType === 'RENT' ? ('RENT' as const) : ('UTILITIES' as const);
    return {
      id: r.id,
      chargeType: r.chargeType as string,
      title: r.title,
      amount: r.amount.toString(),
      currency: r.currency,
      dueDate: r.dueDate.toISOString().slice(0, 10),
      billingPeriodStart: r.billingPeriodStart ? r.billingPeriodStart.toISOString().slice(0, 10) : null,
      postedAt: r.postedAt ? r.postedAt.toISOString() : null,
      allocatedTotal: allocated.toFixed(2),
      balance: (Number(r.amount) - allocated).toFixed(2),
      accountType: bucket,
      tenant: r.tenant,
      unit: r.unit,
      leaseId: r.leaseId,
      propertyId: r.propertyId,
    };
  });
}

export async function getCharge(actor: ScopeActor, id: string) {
  const row = await db.charge.findFirst({
    where: { id, organizationId: actor.organizationId, property: propertyScopeWhere(actor) },
    select: {
      id: true,
      chargeType: true,
      title: true,
      amount: true,
      currency: true,
      dueDate: true,
      postedAt: true,
      notes: true,
      propertyId: true,
      leaseId: true,
      scheduleId: true,
      tenant: { select: { id: true, displayName: true } },
      unit: { select: { id: true, unitRef: true } },
      allocations: {
        select: {
          id: true,
          amount: true,
          allocatedAt: true,
          payment: { select: { id: true, receivedAt: true, method: true, reference: true } },
        },
        orderBy: { allocatedAt: 'asc' },
      },
    },
  });
  if (!row) throw new RouteError(404, 'Charge not found');
  const allocated = row.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  return {
    id: row.id,
    chargeType: row.chargeType as string,
    accountType: row.chargeType === 'RENT' ? 'RENT' : 'UTILITIES',
    title: row.title,
    amount: row.amount.toString(),
    currency: row.currency,
    dueDate: row.dueDate.toISOString().slice(0, 10),
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    notes: row.notes,
    allocatedTotal: allocated.toFixed(2),
    balance: (Number(row.amount) - allocated).toFixed(2),
    tenant: row.tenant,
    unit: row.unit,
    leaseId: row.leaseId,
    scheduleId: row.scheduleId,
    allocations: row.allocations.map((a) => ({
      id: a.id,
      amount: a.amount.toString(),
      allocatedAt: a.allocatedAt.toISOString(),
      payment: a.payment,
    })),
  };
}
