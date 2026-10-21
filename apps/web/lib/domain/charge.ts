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

import { db } from '@/lib/auth';

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
