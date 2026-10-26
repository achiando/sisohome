/**
 * Tenant dues / arrears (Slice 8) — org-side "who owes what" rollup.
 *
 * Rows group open posted charges by tenant × property × currency; the same
 * balance rule as `listCharges` applies (amount − Σ allocations − Σ approved
 * adjustments). Aging buckets come from the oldest open dueDate per group:
 * CURRENT (not yet due) · 0-30 · 31-60 · 61-90 · 90+ days past due.
 */

import type { Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';

export type AgeBucket = 'CURRENT' | '0-30' | '31-60' | '61-90' | '90+';

export interface DuesRow {
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  currency: string;
  /** Total open balance (past due or not). */
  open: string;
  /** Portion of `open` on charges already past due. */
  overdue: string;
  overdueCount: number;
  chargeCount: number;
  /** Earliest dueDate among open charges (drives the aging bucket). */
  oldestDueDate: string | null;
  /** Days past `oldestDueDate` (0 when nothing is past due). */
  ageDays: number;
  bucket: AgeBucket;
}

export interface DuesTotals {
  outstanding: string;
  overdue: string;
  dueThisMonth: string;
  overdueCount: number;
  tenantCount: number;
  pendingAdjustments: number;
  currency: string;
}

export interface DuesResult {
  totals: DuesTotals;
  rows: DuesRow[];
}

export interface DuesFilters {
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  overdueOnly?: boolean;
}

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketFor(ageDays: number): AgeBucket {
  if (ageDays <= 0) return 'CURRENT';
  if (ageDays <= 30) return '0-30';
  if (ageDays <= 60) return '31-60';
  if (ageDays <= 90) return '61-90';
  return '90+';
}

const MAX_CHARGES = 1000;

/**
 * Dues register: totals KPIs + one row per tenant × property with open
 * balance. Settled charges drop out entirely; the row's bucket derives from
 * its oldest open dueDate. `overdueOnly` drops rows with nothing past due.
 */
export async function tenantDues(actor: ScopeActor, filters: DuesFilters = {}): Promise<DuesResult> {
  if (filters.propertyId) await requirePropertyInScope(actor, filters.propertyId);

  const and: Prisma.ChargeWhereInput[] = [
    { organizationId: actor.organizationId },
    { property: propertyScopeWhere(actor) },
    { postedAt: { not: null } },
  ];
  if (filters.propertyId) and.push({ propertyId: filters.propertyId });
  if (filters.unitId) and.push({ unitId: filters.unitId });
  if (filters.tenantId) and.push({ tenantId: filters.tenantId });

  const charges = await db.charge.findMany({
    where: { AND: and },
    select: {
      amount: true,
      currency: true,
      dueDate: true,
      tenantId: true,
      propertyId: true,
      tenant: { select: { id: true, displayName: true } },
      property: { select: { id: true, name: true } },
      allocations: { select: { amount: true } },
      adjustments: { select: { amount: true, status: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: MAX_CHARGES,
  });

  const pendingAdjustments = await db.financialAdjustment.count({
    where: {
      organizationId: actor.organizationId,
      status: 'PENDING',
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      charge: { property: propertyScopeWhere(actor) },
    },
  });

  const now = dayStart(new Date());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  interface Group {
    tenantId: string;
    tenantName: string;
    propertyId: string;
    propertyName: string;
    currency: string;
    open: number;
    overdue: number;
    overdueCount: number;
    chargeCount: number;
    oldest: Date | null;
    oldestOverdue: Date | null;
  }
  const groups = new Map<string, Group>();
  const currencies = new Map<string, number>();
  let outstanding = 0;
  let overdueTotal = 0;
  let dueThisMonth = 0;
  let overdueCount = 0;

  for (const c of charges) {
    const allocated = c.allocations.reduce((s, a) => s + Number(a.amount), 0);
    const adjusted = c.adjustments
      .filter((a) => a.status === 'APPROVED')
      .reduce((s, a) => s + Number(a.amount), 0);
    const balance = Number(c.amount) - allocated - adjusted;
    if (balance <= 0.009) continue;

    const due = dayStart(c.dueDate);
    const pastDue = due < now;

    outstanding += balance;
    currencies.set(c.currency, (currencies.get(c.currency) ?? 0) + balance);
    if (due >= monthStart && due <= monthEnd) dueThisMonth += balance;
    if (pastDue) {
      overdueTotal += balance;
      overdueCount += 1;
    }
    if (!c.tenantId) continue; // property-level charges feed totals only

    const key = `${c.tenantId}:${c.propertyId}:${c.currency}`;
    const g =
      groups.get(key) ??
      ({
        tenantId: c.tenantId,
        tenantName: c.tenant?.displayName ?? 'Unknown tenant',
        propertyId: c.propertyId,
        propertyName: c.property?.name ?? '',
        currency: c.currency,
        open: 0,
        overdue: 0,
        overdueCount: 0,
        chargeCount: 0,
        oldest: null,
        oldestOverdue: null,
      } satisfies Group);
    g.open += balance;
    g.chargeCount += 1;
    if (!g.oldest || due < g.oldest) g.oldest = due;
    if (pastDue) {
      g.overdue += balance;
      g.overdueCount += 1;
      if (!g.oldestOverdue || due < g.oldestOverdue) g.oldestOverdue = due;
    }
    groups.set(key, g);
  }

  const rows: DuesRow[] = [...groups.values()]
    .filter((g) => !filters.overdueOnly || g.overdue > 0.009)
    .map((g) => {
      const basis = g.oldestOverdue ?? g.oldest;
      const ageDays = g.oldestOverdue
        ? Math.floor((now.getTime() - g.oldestOverdue.getTime()) / 86_400_000)
        : 0;
      return {
        tenantId: g.tenantId,
        tenantName: g.tenantName,
        propertyId: g.propertyId,
        propertyName: g.propertyName,
        currency: g.currency,
        open: g.open.toFixed(2),
        overdue: g.overdue.toFixed(2),
        overdueCount: g.overdueCount,
        chargeCount: g.chargeCount,
        oldestDueDate: basis ? basis.toISOString().slice(0, 10) : null,
        ageDays,
        bucket: bucketFor(ageDays),
      };
    })
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || Number(b.open) - Number(a.open));

  // Dominant currency for the KPI tiles (org ledgers are effectively
  // single-currency; mixed buckets still total correctly as plain sums).
  let currency = 'KES';
  let seen = -1;
  for (const [code, sum] of currencies) {
    if (sum > seen) {
      seen = sum;
      currency = code;
    }
  }

  return {
    totals: {
      outstanding: outstanding.toFixed(2),
      overdue: overdueTotal.toFixed(2),
      dueThisMonth: dueThisMonth.toFixed(2),
      overdueCount,
      tenantCount: new Set(rows.map((r) => r.tenantId)).size,
      pendingAdjustments,
      currency,
    },
    rows,
  };
}
