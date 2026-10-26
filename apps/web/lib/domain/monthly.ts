/**
 * Monthly ledger domain (Slice 3b) — month-by-month tracking the user asked
 * for: generate monthly charges (rent from active leases + utility bills
 * from unit schedules), a monthly ledger matrix (tenant / unit / property),
 * and multi-month payment recording with oldest-first allocation.
 *
 * Rules:
 * - Charge generation is idempotent per (scope, type, billing period):
 *   re-running a month never duplicates. Generated charges are POSTED
 *   directly (v1 decision — the draft→approve workflow lands with full
 *   Slice 4; charge.approve gates posting then).
 * - Rent charges come from LeaseUnit.monthlyRent for every ACTIVE/ENDING
 *   lease covering the month; utilities from ACTIVE non-RENT unit
 *   ChargeSchedules (MONTHLY frequency auto-generates; others generate when
 *   nextRunAt falls inside the month and advance it).
 * - Collection timing is CASH BASIS: a payment counts in the month its
 *   receivedAt falls; allocations attribute it to specific charges.
 * - Multi-month payments allocate OLDEST open charge first, within a
 *   transaction; over-allocation is rejected (400).
 */

import type { Prisma } from '@workspace/database';
import type { PaymentMethod } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';
import { resolveAccount } from './ledger-account';
import { createChargeWithInvoice } from './charge';

// ── month helpers ────────────────────────────────────────────────────────────

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function assertMonth(v: unknown, field: string): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!MONTH_RE.test(s)) throw new RouteError(400, `${field} must be YYYY-MM`);
  return s;
}

function monthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function monthEnd(month: string): Date {
  const parts = month.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function addMonths(month: string, n: number): string {
  const parts = month.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const total = y * 12 + (m - 1) + n;
  const yy = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

function listMonths(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  // hard cap 120 months (10 years) per request
  for (let i = 0; i < 120 && cur <= to; i += 1) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

// ── charge generation ────────────────────────────────────────────────────────

export interface GenerateResult {
  month: string;
  rentCreated: number;
  rentSkipped: number;
  utilitiesCreated: number;
  utilitiesSkipped: number;
}

/**
 * Generate one month of charges for a property. Idempotent per period.
 */
export async function generateMonthlyCharges(
  actor: ScopeActor,
  input: { propertyId: string; month: string },
): Promise<GenerateResult> {
  const { propertyId } = input;
  const month = assertMonth(input.month, 'month');
  await requirePropertyInScope(actor, propertyId);
  const start = monthStart(month);
  const end = monthEnd(month);

  const result: GenerateResult = {
    month,
    rentCreated: 0,
    rentSkipped: 0,
    utilitiesCreated: 0,
    utilitiesSkipped: 0,
  };

  // ── rent: ACTIVE/ENDING leases covering this month ──
  const leaseUnits = await db.leaseUnit.findMany({
    where: {
      lease: {
        propertyId,
        status: { in: ['ACTIVE', 'ENDING'] },
        startsAt: { lte: end },
        OR: [{ endsAt: null }, { endsAt: { gte: start } }],
      },
    },
    select: {
      unitId: true,
      monthlyRent: true,
      lease: {
        select: {
          id: true,
          parties: {
            where: { relationship: 'PRIMARY' },
            take: 1,
            select: { tenantId: true },
          },
        },
      },
    },
  });

  for (const lu of leaseUnits) {
    const existing = await db.charge.findFirst({
      where: {
        organizationId: actor.organizationId,
        leaseId: lu.lease.id,
        unitId: lu.unitId,
        chargeType: 'RENT',
        billingPeriodStart: start,
      },
      select: { id: true },
    });
    if (existing) {
      result.rentSkipped += 1;
      continue;
    }
    await createChargeWithInvoice({
      organizationId: actor.organizationId,
      propertyId,
      unitId: lu.unitId,
      leaseId: lu.lease.id,
      tenantId: lu.lease.parties[0]?.tenantId ?? null,
      chargeType: 'RENT',
      title: `Rent ${month}`,
      amount: lu.monthlyRent,
      currency: 'KES',
      dueDate: start,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      postedAt: new Date(),
    });
    result.rentCreated += 1;
  }

  // ── utilities: ACTIVE non-RENT unit schedules ──
  const schedules = await db.chargeSchedule.findMany({
    where: {
      unitId: { not: null },
      isActive: true,
      chargeType: { not: 'RENT' },
      unit: { propertyId },
      OR: [{ startDate: { lte: end } }, { nextRunAt: { lte: end } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: start } }] }],
    },
    select: {
      id: true,
      unitId: true,
      name: true,
      chargeType: true,
      amount: true,
      currency: true,
      frequency: true,
      nextRunAt: true,
    },
  });

  for (const sch of schedules) {
    if (!sch.unitId) continue;
    // MONTHLY generates every month; other frequencies generate only when
    // nextRunAt falls inside this month (then advance).
    const dueThisMonth =
      sch.frequency === 'MONTHLY'
        ? true
        : sch.nextRunAt != null && sch.nextRunAt >= start && sch.nextRunAt <= end;
    if (!dueThisMonth) continue;

    const existing = await db.charge.findFirst({
      where: {
        organizationId: actor.organizationId,
        scheduleId: sch.id,
        unitId: sch.unitId,
        billingPeriodStart: start,
      },
      select: { id: true },
    });
    if (existing) {
      result.utilitiesSkipped += 1;
      continue;
    }
    await createChargeWithInvoice({
      organizationId: actor.organizationId,
      propertyId,
      unitId: sch.unitId,
      scheduleId: sch.id,
      chargeType: sch.chargeType,
      title: `${sch.name} ${month}`,
      amount: sch.amount,
      currency: sch.currency,
      dueDate: start,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      postedAt: new Date(),
    });
    if (sch.frequency !== 'MONTHLY') {
      await db.chargeSchedule.update({
        where: { id: sch.id },
        data: { nextRunAt: monthStart(addMonths(month, 1)), lastRunAt: new Date() },
      });
    }
    result.utilitiesCreated += 1;
  }

  await auditLog(actor, 'CHARGE', 'charges.generate_monthly', propertyId, {
    month,
    rentCreated: result.rentCreated,
    utilitiesCreated: result.utilitiesCreated,
  });
  return result;
}

// ── monthly ledger matrix ────────────────────────────────────────────────────

export interface MonthlyLedgerRow {
  month: string;
  rent: { billed: string; paid: string; status: 'PAID' | 'PARTIAL' | 'PENDING' | 'NONE' };
  utilities: { billed: string; paid: string; status: 'PAID' | 'PARTIAL' | 'PENDING' | 'NONE' };
}

type LedgerScope = { propertyId?: string; tenantId?: string; unitId?: string };

function statusOf(billed: number, paid: number): MonthlyLedgerRow['rent']['status'] {
  if (billed <= 0) return 'NONE';
  if (paid >= billed) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'PENDING';
}

/**
 * Month-by-month billed vs paid matrix, rent and utilities split. Scope is
 * at least one of propertyId / tenantId / unitId (all scoped through the
 * parent property / org).
 */
export async function monthlyLedger(
  actor: ScopeActor,
  scope: LedgerScope & { from: string; to: string },
): Promise<MonthlyLedgerRow[]> {
  const from = assertMonth(scope.from, 'from');
  const to = assertMonth(scope.to, 'to');
  if (from > to) throw new RouteError(400, 'from must be <= to');
  if (scope.propertyId) await requirePropertyInScope(actor, scope.propertyId);

  const chargeWhere: Prisma.ChargeWhereInput = {
    organizationId: actor.organizationId,
    property: propertyScopeWhere(actor),
  };
  if (scope.propertyId) chargeWhere.propertyId = scope.propertyId;
  if (scope.tenantId) chargeWhere.tenantId = scope.tenantId;
  if (scope.unitId) chargeWhere.unitId = scope.unitId;

  const charges = await db.charge.findMany({
    where: {
      ...chargeWhere,
      billingPeriodStart: { gte: monthStart(from), lte: monthEnd(to) },
    },
    select: {
      id: true,
      chargeType: true,
      amount: true,
      billingPeriodStart: true,
      allocations: { select: { amount: true, payment: { select: { receivedAt: true } } } },
    },
  });

  const months = listMonths(from, to);
  const buckets = new Map<string, { rentB: number; rentP: number; utilB: number; utilP: number }>();
  for (const m of months) buckets.set(m, { rentB: 0, rentP: 0, utilB: 0, utilP: 0 });

  for (const c of charges) {
    if (!c.billingPeriodStart) continue;
    const key = monthKey(c.billingPeriodStart);
    const isRent = c.chargeType === 'RENT';
    const billed = Number(c.amount);
    // billed lands in the charge's billing month
    const b = buckets.get(key);
    if (b) {
      if (isRent) b.rentB += billed;
      else b.utilB += billed;
    }
    // cash-basis: paid lands in the month the payment was received
    for (const a of c.allocations) {
      const pb = buckets.get(monthKey(a.payment.receivedAt));
      if (!pb) continue;
      if (isRent) pb.rentP += Number(a.amount);
      else pb.utilP += Number(a.amount);
    }
  }

  return months.map((m) => {
    const b = buckets.get(m)!;
    return {
      month: m,
      rent: { billed: b.rentB.toFixed(2), paid: b.rentP.toFixed(2), status: statusOf(b.rentB, b.rentP) },
      utilities: {
        billed: b.utilB.toFixed(2),
        paid: b.utilP.toFixed(2),
        status: statusOf(b.utilB, b.utilP),
      },
    };
  });
}

// ── multi-month payment recording ────────────────────────────────────────────

export interface MultiMonthResult {
  paymentId: string;
  allocatedCharges: { chargeId: string; month: string; amount: string }[];
  totalAllocated: string;
  monthsCovered: string[];
}

/**
 * Record a payment that covers N months of open charges (rent or
 * utilities), allocating oldest-first in one transaction. `amount` optional
 * — defaults to the full sum of the covered charges; a smaller amount
 * partially allocates oldest-first.
 */
export async function recordMultiMonthPayment(
  actor: ScopeActor,
  input: {
    propertyId: string;
    unitId?: string | null;
    tenantId?: string | null;
    leaseId?: string | null;
    accountType: 'RENT' | 'UTILITIES';
    months: number;
    fromMonth?: string;
    amount?: number;
    method: string;
    reference?: string | null;
    notes?: string | null;
  },
): Promise<MultiMonthResult> {
  const { propertyId } = input;
  await requirePropertyInScope(actor, propertyId);
  const months = Math.floor(Number(input.months));
  if (!Number.isFinite(months) || months < 1 || months > 36) {
    throw new RouteError(400, 'months must be between 1 and 36');
  }
  if (input.unitId) {
    const unit = await db.unit.findFirst({
      where: { id: input.unitId, propertyId, property: propertyScopeWhere(actor) },
      select: { id: true },
    });
    if (!unit) throw new RouteError(404, 'Unit not found in this property');
  }
  if (input.tenantId) {
    const tenant = await db.tenant.findFirst({
      where: { id: input.tenantId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!tenant) throw new RouteError(404, 'Tenant not found');
  }

  const isRent = input.accountType === 'RENT';
  const chargeWhere: Prisma.ChargeWhereInput = {
    organizationId: actor.organizationId,
    propertyId,
    property: propertyScopeWhere(actor),
    postedAt: { not: null },
    chargeType: isRent ? 'RENT' : { not: 'RENT' },
  };
  if (isRent) {
    if (input.leaseId) chargeWhere.leaseId = input.leaseId;
    if (input.tenantId) chargeWhere.tenantId = input.tenantId;
  }
  if (input.unitId) chargeWhere.unitId = input.unitId;
  // rent without tenant/lease/unit would hit the whole property — refuse
  if (isRent && !input.leaseId && !input.tenantId && !input.unitId) {
    throw new RouteError(400, 'Rent payments need leaseId, tenantId or unitId');
  }
  if (!isRent && !input.unitId && !input.tenantId) {
    throw new RouteError(400, 'Utilities payments need unitId or tenantId');
  }

  // open charges (balance > 0), oldest first
  const open = await db.charge.findMany({
    where: chargeWhere,
    select: {
      id: true,
      amount: true,
      billingPeriodStart: true,
      allocations: { select: { amount: true } },
    },
    orderBy: { billingPeriodStart: 'asc' },
  });
  const withBalance = open
    .filter((c) => c.billingPeriodStart != null)
    .map((c) => ({
      ...c,
      billingPeriodStart: c.billingPeriodStart as Date,
      balance: Number(c.amount) - c.allocations.reduce((s, a) => s + Number(a.amount), 0),
    }))
    .filter((c) => c.balance > 0.009);

  if (withBalance.length === 0) {
    throw new RouteError(400, `No open ${input.accountType.toLowerCase()} charges to allocate against`);
  }

  // take charges across up to `months` distinct periods, oldest first
  // (open is already ordered by billingPeriodStart asc, so first N months)
  const keepPeriods = new Set<string>();
  for (const c of withBalance) {
    const key = monthKey(c.billingPeriodStart);
    if (!keepPeriods.has(key)) {
      if (keepPeriods.size >= months) break;
      keepPeriods.add(key);
    }
  }
  const toAllocate = withBalance.filter((c) => keepPeriods.has(monthKey(c.billingPeriodStart)));

  const fullSum = toAllocate.reduce((s, c) => s + c.balance, 0);
  const payAmount = input.amount != null ? Number(input.amount) : fullSum;
  if (!Number.isFinite(payAmount) || payAmount <= 0) throw new RouteError(400, 'amount must be positive');
  if (payAmount > fullSum + 0.009) {
    throw new RouteError(400, `amount ${payAmount} exceeds open total ${fullSum.toFixed(2)}`);
  }

  const method = String(input.method ?? '').trim().toUpperCase();
  const METHODS: PaymentMethod[] = ['CASH', 'MPESA', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'];
  if (!METHODS.includes(method as PaymentMethod)) throw new RouteError(400, `method must be one of ${METHODS.join(', ')}`);

  // allocate oldest-first
  let remaining = payAmount;
  const allocations: { chargeId: string; month: string; amount: number }[] = [];
  for (const c of toAllocate) {
    if (remaining <= 0.009) break;
    const take = Math.min(remaining, c.balance);
    allocations.push({ chargeId: c.id, month: monthKey(c.billingPeriodStart), amount: take });
    remaining -= take;
  }

  const account = await resolveAccount(actor, propertyId, input.accountType, { unitId: input.unitId ?? null });

  const payment = await db.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        organizationId: actor.organizationId,
        propertyId,
        unitId: input.unitId ?? null,
        tenantId: input.tenantId ?? null,
        leaseId: input.leaseId ?? null,
        accountId: account.id,
        amount: payAmount,
        currency: account.currency,
        method: method as PaymentMethod,
        reference: input.reference ?? null,
        receivedAt: new Date(),
        receivedByUserId: actor.userId,
        notes: input.notes ?? null,
      },
    });
    for (const a of allocations) {
      await tx.paymentAllocation.create({
        data: {
          organizationId: actor.organizationId,
          paymentId: p.id,
          chargeId: a.chargeId,
          amount: a.amount,
          allocatedByUserId: actor.userId,
        },
      });
    }
    return p;
  });

  await auditLog(actor, 'PAYMENT', 'payment.create_multi_month', payment.id, {
    propertyId,
    months,
    accountType: input.accountType,
    amount: payAmount,
    allocations: allocations.length,
  });

  return {
    paymentId: payment.id,
    allocatedCharges: allocations.map((a) => ({
      chargeId: a.chargeId,
      month: a.month,
      amount: a.amount.toFixed(2),
    })),
    totalAllocated: (payAmount - remaining).toFixed(2),
    monthsCovered: [...new Set(allocations.map((a) => a.month))].sort(),
  };
}

// ── per-unit pending / paid summary ──────────────────────────────────────────

export interface UnitChargeSummary {
  pending: string;
  paid: string;
  /** Open balance on charges past their due date (Slice 8). */
  overdue: string;
  /** Max days past due across open charges; 0 when nothing is overdue. */
  overdueDays: number;
  currency: string;
}

/**
 * Per-unit open (pending) vs settled (paid) totals from posted charges,
 * with the overdue slice split out (same balance math as listCharges:
 * amount − allocations − approved adjustments).
 */
export async function unitChargeSummary(
  actor: ScopeActor,
  unitIds: string[],
): Promise<Map<string, UnitChargeSummary>> {
  const out = new Map<string, UnitChargeSummary>();
  if (unitIds.length === 0) return out;
  const charges = await db.charge.findMany({
    where: {
      unitId: { in: unitIds },
      organizationId: actor.organizationId,
      property: propertyScopeWhere(actor),
      postedAt: { not: null },
    },
    select: {
      unitId: true,
      amount: true,
      currency: true,
      dueDate: true,
      allocations: { select: { amount: true } },
      adjustments: { select: { amount: true, status: true } },
    },
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const c of charges) {
    if (!c.unitId) continue;
    const row =
      out.get(c.unitId) ?? { pending: '0', paid: '0', overdue: '0', overdueDays: 0, currency: c.currency };
    const allocated = c.allocations.reduce((s, a) => s + Number(a.amount), 0);
    const adjusted = c.adjustments
      .filter((a) => a.status === 'APPROVED')
      .reduce((s, a) => s + Number(a.amount), 0);
    const balance = Number(c.amount) - allocated - adjusted;
    const due = new Date(c.dueDate);
    due.setHours(0, 0, 0, 0);
    const isOverdue = due < today && balance > 0.009;
    const days = isOverdue ? Math.floor((today.getTime() - due.getTime()) / 86_400_000) : 0;
    out.set(c.unitId, {
      pending: (Number(row.pending) + balance).toFixed(2),
      paid: (Number(row.paid) + allocated).toFixed(2),
      overdue: (Number(row.overdue) + (isOverdue ? balance : 0)).toFixed(2),
      overdueDays: Math.max(row.overdueDays, days),
      currency: c.currency,
    });
  }
  return out;
}
