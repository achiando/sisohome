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
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
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
  /** Latest in-app overdue reminder logged for this tenant (audit-backed). */
  lastRemindedAt: string | null;
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

/** Audit action for in-app overdue reminders (resourceType `tenant`). */
const REMIND_ACTION = 'tenant.remind';

/** Latest reminder timestamp per tenant, from the audit trail (one query). */
async function latestReminders(organizationId: string, tenantIds: string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (tenantIds.length === 0) return out;
  const logs = await db.auditLog.findMany({
    where: { action: REMIND_ACTION, organizationId, resourceId: { in: tenantIds } },
    select: { resourceId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  for (const l of logs) {
    if (l.resourceId && !out.has(l.resourceId)) out.set(l.resourceId, l.createdAt);
  }
  return out;
}

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
        lastRemindedAt: null,
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

  const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
  const reminders = await latestReminders(actor.organizationId, tenantIds);
  for (const r of rows) {
    const at = reminders.get(r.tenantId);
    r.lastRemindedAt = at ? at.toISOString() : null;
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

// ── in-app overdue reminder (Slice 9 gap pass) ───────────────────────────────

export interface ReminderResult {
  tenantId: string;
  tenantName: string;
  overdue: string;
  currency: string;
  properties: number;
  overdueCount: number;
  lastRemindedAt: string;
}

/**
 * Log an in-app overdue reminder for a tenant (no email — the audit trail is
 * the record). Overdue totals are recomputed server-side; nothing is trusted
 * from the client. The Dues register surfaces `lastRemindedAt` per row.
 */
export async function remindTenant(actor: ScopeActor, raw: unknown): Promise<ReminderResult> {
  const body = (raw ?? {}) as Record<string, unknown>;
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  if (!tenantId) throw new RouteError(400, 'tenantId is required');

  const tenant = await db.tenant.findFirst({
    where: { id: tenantId, organizationId: actor.organizationId },
    select: { id: true, displayName: true },
  });
  if (!tenant) throw new RouteError(404, 'Tenant not found');

  const result = await tenantDues(actor, { tenantId });
  const overdueRows = result.rows.filter((r) => Number(r.overdue) > 0.009);
  const primary = overdueRows.reduce<DuesRow | undefined>(
    (max, r) => (!max || Number(r.overdue) > Number(max.overdue) ? r : max),
    undefined,
  );
  if (!primary) throw new RouteError(400, 'No overdue balance to remind about');
  const overdueCount = overdueRows.reduce((s, r) => s + r.overdueCount, 0);

  await auditLog(actor, 'tenant', REMIND_ACTION, tenantId, {
    displayName: tenant.displayName,
    currency: primary.currency,
    overdue: primary.overdue,
    overdueCount,
    properties: overdueRows.length,
  });

  return {
    tenantId,
    tenantName: tenant.displayName,
    overdue: primary.overdue,
    currency: primary.currency,
    properties: overdueRows.length,
    overdueCount,
    lastRemindedAt: new Date().toISOString(),
  };
}
