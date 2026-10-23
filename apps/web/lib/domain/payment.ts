/**
 * Payment domain (Slice 3 — payments incl. utilities, rent vs utilities
 * accounts; full allocation workspace lands with Slice 4).
 *
 * Rules:
 * - Payments are property children (`organizationId` = portfolio org); scope
 *   through the parent property (`propertyScopeWhere`).
 * - Every payment carries `accountId` → the property's RENT or UTILITIES
 *   ledger account (unit override preferred when the unit owns a pair).
 *   `accountType` is explicit on create, defaulting to RENT; utilities
 *   payments (waste/water/etc. bills) set UTILITIES so they track separately.
 * - Balance-style totals here are DERIVED: allocated = Σ allocations.
 */

import type { PaymentMethod, Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';
import { LEDGER_ACCOUNT_TYPES, resolveAccount } from './ledger-account';

type Raw = Record<string, unknown>;

const METHODS: PaymentMethod[] = ['CASH', 'MPESA', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'];

function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new RouteError(400, `${field} is required`);
  return v.trim();
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function amount(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new RouteError(400, 'amount must be a positive number');
  return n;
}

function date(v: unknown, field: string): Date {
  const d = new Date(String(v ?? ''));
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} is not a valid date`);
  return d;
}

function pickEnum<T extends string>(v: unknown, allowed: T[], field: string, fallback: T): T {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (!s) return fallback;
  if (!allowed.includes(s as T)) throw new RouteError(400, `${field} must be one of ${allowed.join(', ')}`);
  return s as T;
}

interface PaymentShape {
  id: string;
  amount: string;
  currency: string;
  method: string;
  reference: string | null;
  receivedAt: string;
  reconciledAt: string | null;
  notes: string | null;
  allocatedTotal: string;
  account: { id: string; accountType: string; name: string } | null;
  tenant: { id: string; displayName: string } | null;
  unit: { id: string; unitRef: string } | null;
  leaseId: string | null;
  propertyId: string;
}

function shape(row: {
  id: string;
  amount: Prisma.Decimal;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  receivedAt: Date;
  reconciledAt: Date | null;
  notes: string | null;
  leaseId: string | null;
  propertyId: string;
  account: { id: string; accountType: string; name: string } | null;
  tenant: { id: string; displayName: string } | null;
  unit: { id: string; unitRef: string } | null;
  allocations: { amount: Prisma.Decimal }[];
}): PaymentShape {
  const allocated = row.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  return {
    id: row.id,
    amount: row.amount.toString(),
    currency: row.currency,
    method: row.method as string,
    reference: row.reference,
    receivedAt: row.receivedAt.toISOString(),
    reconciledAt: row.reconciledAt ? row.reconciledAt.toISOString() : null,
    notes: row.notes,
    allocatedTotal: allocated.toFixed(2),
    account: row.account,
    tenant: row.tenant,
    unit: row.unit,
    leaseId: row.leaseId,
    propertyId: row.propertyId,
  };
}

const SHAPE_SELECT = {
  id: true,
  amount: true,
  currency: true,
  method: true,
  reference: true,
  receivedAt: true,
  reconciledAt: true,
  notes: true,
  leaseId: true,
  propertyId: true,
  account: { select: { id: true, accountType: true, name: true } },
  tenant: { select: { id: true, displayName: true } },
  unit: { select: { id: true, unitRef: true } },
  allocations: { select: { amount: true } },
} satisfies Prisma.PaymentSelect;

export interface PaymentFilters {
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  leaseId?: string;
  /** RENT | UTILITIES — the account bucket. */
  accountType?: string;
  from?: string;
  to?: string;
}

export async function listPayments(actor: ScopeActor, filters: PaymentFilters = {}): Promise<PaymentShape[]> {
  if (filters.propertyId) await requirePropertyInScope(actor, filters.propertyId);
  const and: Prisma.PaymentWhereInput[] = [
    { organizationId: actor.organizationId },
    { property: propertyScopeWhere(actor) },
  ];
  if (filters.propertyId) and.push({ propertyId: filters.propertyId });
  if (filters.unitId) and.push({ unitId: filters.unitId });
  if (filters.tenantId) and.push({ tenantId: filters.tenantId });
  if (filters.leaseId) and.push({ leaseId: filters.leaseId });
  if (filters.accountType) {
    const t = pickEnum(filters.accountType, LEDGER_ACCOUNT_TYPES, 'accountType', 'RENT');
    and.push({ account: { accountType: t } });
  }
  if (filters.from) and.push({ receivedAt: { gte: date(filters.from, 'from') } });
  if (filters.to) and.push({ receivedAt: { lte: date(filters.to, 'to') } });

  const rows = await db.payment.findMany({
    where: { AND: and },
    select: SHAPE_SELECT,
    orderBy: { receivedAt: 'desc' },
    take: 200,
  });
  return rows.map(shape);
}

/** Rent vs utilities collected totals (KPI tiles on the tenant/property UI). */
export async function paymentsBreakdown(
  actor: ScopeActor,
  filter: { propertyId?: string; tenantId?: string } = {},
): Promise<{ rent: { count: number; total: string }; utilities: { count: number; total: string }; total: string }> {
  if (filter.propertyId) await requirePropertyInScope(actor, filter.propertyId);
  const and: Prisma.PaymentWhereInput[] = [
    { organizationId: actor.organizationId },
    { property: propertyScopeWhere(actor) },
  ];
  if (filter.propertyId) and.push({ propertyId: filter.propertyId });
  if (filter.tenantId) and.push({ tenantId: filter.tenantId });

  const rows = await db.payment.findMany({
    where: { AND: and },
    select: { amount: true, account: { select: { accountType: true } } },
  });
  const buckets = { RENT: { count: 0, total: 0 }, UTILITIES: { count: 0, total: 0 } };
  for (const r of rows) {
    const t = r.account?.accountType === 'UTILITIES' ? 'UTILITIES' : 'RENT';
    buckets[t].count += 1;
    buckets[t].total += Number(r.amount);
  }
  return {
    rent: { count: buckets.RENT.count, total: buckets.RENT.total.toFixed(2) },
    utilities: { count: buckets.UTILITIES.count, total: buckets.UTILITIES.total.toFixed(2) },
    total: (buckets.RENT.total + buckets.UTILITIES.total).toFixed(2),
  };
}

export async function getPayment(actor: ScopeActor, id: string): Promise<PaymentShape & { allocations: unknown[]; receipts: unknown[] }> {
  const row = await db.payment.findFirst({
    where: { id, organizationId: actor.organizationId, property: propertyScopeWhere(actor) },
    select: {
      ...SHAPE_SELECT,
      allocations: {
        select: {
          id: true,
          amount: true,
          allocatedAt: true,
          charge: { select: { id: true, chargeType: true, title: true, dueDate: true } },
        },
        orderBy: { allocatedAt: 'asc' },
      },
      receipts: {
        select: { id: true, receiptNumber: true, amount: true, issuedAt: true },
        orderBy: { issuedAt: 'desc' },
      },
    },
  });
  if (!row) throw new RouteError(404, 'Payment not found');
  return { ...shape({ ...row, allocations: row.allocations }), allocations: row.allocations, receipts: row.receipts };
}

export async function createPayment(actor: ScopeActor, raw: Raw) {
  const propertyId = str(raw.propertyId, 'propertyId');
  await requirePropertyInScope(actor, propertyId);

  let unitId: string | null = null;
  const rawUnitId = strOrNull(raw.unitId);
  if (rawUnitId) {
    unitId = rawUnitId;
    const unit = await db.unit.findFirst({
      where: { id: rawUnitId, propertyId, property: propertyScopeWhere(actor) },
      select: { id: true },
    });
    if (!unit) throw new RouteError(404, 'Unit not found in this property');
  }

  let tenantId: string | null = null;
  const rawTenantId = strOrNull(raw.tenantId);
  if (rawTenantId) {
    tenantId = rawTenantId;
    const tenant = await db.tenant.findFirst({
      where: { id: rawTenantId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!tenant) throw new RouteError(404, 'Tenant not found');
  }

  let leaseId: string | null = null;
  const rawLeaseId = strOrNull(raw.leaseId);
  if (rawLeaseId) {
    leaseId = rawLeaseId;
    const lease = await db.lease.findFirst({
      where: { id: rawLeaseId, propertyId, property: propertyScopeWhere(actor) },
      select: { id: true },
    });
    if (!lease) throw new RouteError(404, 'Lease not found in this property');
    if (tenantId) {
      const party = await db.leaseTenant.findFirst({
        where: { leaseId: rawLeaseId, tenantId },
        select: { id: true },
      });
      if (!party) throw new RouteError(400, 'Tenant is not a party of that lease');
    }
  }

  const value = amount(raw.amount);
  const method = pickEnum<PaymentMethod>(raw.method, METHODS, 'method', 'CASH');
  const receivedAt = raw.receivedAt ? date(raw.receivedAt, 'receivedAt') : new Date();
  const accountType = pickEnum(raw.accountType, LEDGER_ACCOUNT_TYPES, 'accountType', 'RENT');
  const account = await resolveAccount(actor, propertyId, accountType, { unitId });
  const currency = (typeof raw.currency === 'string' && raw.currency.trim() ? raw.currency.trim() : account.currency).toUpperCase();

  const row = await db.payment.create({
    data: {
      organizationId: actor.organizationId,
      propertyId,
      unitId,
      tenantId,
      leaseId,
      accountId: account.id,
      amount: value,
      currency,
      method,
      reference: strOrNull(raw.reference),
      receivedAt,
      receivedByUserId: actor.userId,
      notes: strOrNull(raw.notes),
    },
    select: SHAPE_SELECT,
  });
  await auditLog(actor, 'PAYMENT', 'payment.create', row.id, {
    propertyId,
    unitId,
    tenantId,
    amount: value,
    currency,
    method,
    accountType,
  });
  return shape(row);
}
