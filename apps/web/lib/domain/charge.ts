/**
 * Charge ledger reads + writes (finances Slices 3 + 8).
 *
 * Balance is DERIVED, never stored (plan-slice-4 rule), and is computed the
 * SAME way on every read surface (Slice 8 fix — the per-row reads used to
 * ignore adjustments while propertyBalances did not):
 *   balance = amount − Σ allocations − Σ APPROVED adjustments
 * Charges with `postedAt = null` are drafts — not owed yet, excluded from
 * balances/dues. Overdue is derived (posted && balance > 0 && dueDate < today)
 * — never stored. Approved adjustments carry no currency column, so they
 * reduce their charge's balance regardless of currency bucket (matching
 * propertyBalances' treatment).
 */

import type { Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';
import { auditLog } from './audit';
import { esc, formatDate, htmlDoc, money } from './html-doc';

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

// ── invoice numbering (Slice 8) ─────────────────────────────────────────────

/**
 * INV-YYYY-NNNN per org — count of the year's prefixed numbers + 1. Callers
 * that create rows should use `createChargeWithInvoice`, which retries the
 * count on the (org, number) unique-conflict race.
 */
export async function nextInvoiceNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count = await db.charge.count({
    where: { organizationId, invoiceNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

function isUniqueConflict(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002';
}

/** Create a charge with a freshly minted invoice number (races retried). */
export async function createChargeWithInvoice(
  data: Prisma.ChargeUncheckedCreateInput,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const invoiceNumber = await nextInvoiceNumber(String(data.organizationId));
      const row = await db.charge.create({ data: { ...data, invoiceNumber } });
      return row.id;
    } catch (err) {
      lastErr = err;
      if (!isUniqueConflict(err)) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new RouteError(500, 'Could not mint invoice number');
}

// ── charge register ─────────────────────────────────────────────────────────

export type ChargeStatusFilter = 'open' | 'overdue' | 'paid' | 'all';

export interface ChargeFilters {
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  leaseId?: string;
  /** RENT | UTILITIES — via the charge's own type. */
  accountType?: string;
  posted?: boolean;
  /** Derived balance state (JS-filtered after balance math — see take cap). */
  status?: ChargeStatusFilter;
  /** dueDate range, YYYY-MM-DD inclusive. */
  dueFrom?: string;
  dueTo?: string;
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
  invoiceNumber: string | null;
  allocatedTotal: string;
  adjustedTotal: string;
  balance: string;
  overdue: boolean;
  /** Whole days past dueDate when overdue, else 0. */
  overdueDays: number;
  accountType: 'RENT' | 'UTILITIES';
  tenant: { id: string; displayName: string } | null;
  unit: { id: string; unitRef: string } | null;
  property: { id: string; name: string };
  leaseId: string | null;
  propertyId: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Posted + draft charges in scope with DERIVED balance (amount − Σ
 * allocations − Σ approved adjustments) and derived `overdue` flag.
 * `status` filters post-computation (overdue/paid need the balance first);
 * result cap is 200 rows ordered dueDate asc.
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
  if (filters.dueFrom != null && filters.dueFrom !== '') {
    if (!DATE_RE.test(filters.dueFrom)) throw new RouteError(400, 'dueFrom must be YYYY-MM-DD');
    and.push({ dueDate: { gte: new Date(filters.dueFrom) } });
  }
  if (filters.dueTo != null && filters.dueTo !== '') {
    if (!DATE_RE.test(filters.dueTo)) throw new RouteError(400, 'dueTo must be YYYY-MM-DD');
    and.push({ dueDate: { lte: new Date(`${filters.dueTo}T23:59:59.999Z`) } });
  }

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
      invoiceNumber: true,
      propertyId: true,
      leaseId: true,
      tenant: { select: { id: true, displayName: true } },
      unit: { select: { id: true, unitRef: true } },
      property: { select: { id: true, name: true } },
      allocations: { select: { amount: true } },
      adjustments: { select: { amount: true, status: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 200,
  });

  const today = dayStart(new Date());
  const shaped: ChargeRow[] = rows.map((r) => {
    const allocated = r.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    const adjusted = r.adjustments
      .filter((a) => a.status === 'APPROVED')
      .reduce((sum, a) => sum + Number(a.amount), 0);
    const balance = Number(r.amount) - allocated - adjusted;
    const overdue = r.postedAt != null && balance > 0.009 && dayStart(r.dueDate) < today;
    const overdueDays = overdue
      ? Math.floor((today.getTime() - dayStart(r.dueDate).getTime()) / 86_400_000)
      : 0;
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
      invoiceNumber: r.invoiceNumber,
      allocatedTotal: allocated.toFixed(2),
      adjustedTotal: adjusted.toFixed(2),
      balance: balance.toFixed(2),
      overdue,
      overdueDays,
      accountType: bucket,
      tenant: r.tenant,
      unit: r.unit,
      property: r.property,
      leaseId: r.leaseId,
      propertyId: r.propertyId,
    };
  });

  if (filters.status && filters.status !== 'all') {
    return shaped.filter((c) => {
      const open = Number(c.balance) > 0.009;
      if (filters.status === 'open') return open;
      if (filters.status === 'overdue') return c.overdue;
      return !open; // paid
    });
  }
  return shaped;
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
      invoiceNumber: true,
      notes: true,
      propertyId: true,
      leaseId: true,
      scheduleId: true,
      tenant: { select: { id: true, displayName: true } },
      unit: { select: { id: true, unitRef: true } },
      property: { select: { id: true, name: true } },
      allocations: {
        select: {
          id: true,
          amount: true,
          allocatedAt: true,
          payment: { select: { id: true, receivedAt: true, method: true, reference: true } },
        },
        orderBy: { allocatedAt: 'asc' },
      },
      adjustments: { select: { id: true, amount: true, status: true, type: true, reason: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Charge not found');
  const allocated = row.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  const adjusted = row.adjustments
    .filter((a) => a.status === 'APPROVED')
    .reduce((sum, a) => sum + Number(a.amount), 0);
  const balance = Number(row.amount) - allocated - adjusted;
  return {
    id: row.id,
    chargeType: row.chargeType as string,
    accountType: row.chargeType === 'RENT' ? 'RENT' : 'UTILITIES',
    title: row.title,
    amount: row.amount.toString(),
    currency: row.currency,
    dueDate: row.dueDate.toISOString().slice(0, 10),
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    invoiceNumber: row.invoiceNumber,
    overdue: row.postedAt != null && balance > 0.009 && dayStart(row.dueDate) < dayStart(new Date()),
    overdueDays:
      row.postedAt != null && balance > 0.009 && dayStart(row.dueDate) < dayStart(new Date())
        ? Math.floor((dayStart(new Date()).getTime() - dayStart(row.dueDate).getTime()) / 86_400_000)
        : 0,
    notes: row.notes,
    allocatedTotal: allocated.toFixed(2),
    adjustedTotal: adjusted.toFixed(2),
    balance: balance.toFixed(2),
    tenant: row.tenant,
    unit: row.unit,
    property: row.property,
    leaseId: row.leaseId,
    scheduleId: row.scheduleId,
    allocations: row.allocations.map((a) => ({
      id: a.id,
      amount: a.amount.toString(),
      allocatedAt: a.allocatedAt.toISOString(),
      payment: a.payment,
    })),
    adjustments: row.adjustments.map((a) => ({
      id: a.id,
      type: a.type,
      amount: a.amount.toString(),
      status: a.status,
      reason: a.reason,
    })),
  };
}

// ── manual one-off charge (Slice 8) ─────────────────────────────────────────

const CHARGE_TYPES = [
  'RENT',
  'SERVICE_CHARGE',
  'WATER',
  'ELECTRICITY',
  'GARBAGE',
  'INSURANCE',
  'LATE_FEE',
  'OTHER',
] as const;

/**
 * One-off manual charge — posted immediately (the generation convention:
 * charges are collectable from birth; the draft/post workflow stays
 * deferred). Invoice number minted in the same create. Scope: property
 * via propertyScopeWhere (404), unit must belong to it (400), tenant must
 * be the caller's org's party (404), lease must sit on the property (404).
 */
export async function createManualCharge(actor: ScopeActor, raw: unknown) {
  const body = (raw ?? {}) as Record<string, unknown>;
  const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
  if (!propertyId) throw new RouteError(400, 'propertyId is required');

  const property = await db.property.findFirst({
    where: { id: propertyId, ...propertyScopeWhere(actor) },
    select: { id: true, currency: true, name: true },
  });
  if (!property) throw new RouteError(404, 'Property not found');

  const chargeType = String(body.chargeType ?? '');
  if (!(CHARGE_TYPES as readonly string[]).includes(chargeType)) {
    throw new RouteError(400, 'Invalid chargeType');
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new RouteError(400, 'amount must be positive');
  const dueRaw = typeof body.dueDate === 'string' ? body.dueDate.trim() : '';
  if (!DATE_RE.test(dueRaw)) throw new RouteError(400, 'dueDate is required (YYYY-MM-DD)');

  const unitId = typeof body.unitId === 'string' && body.unitId.trim() ? body.unitId.trim() : null;
  if (unitId) {
    const unit = await db.unit.findFirst({ where: { id: unitId, propertyId }, select: { id: true } });
    if (!unit) throw new RouteError(400, 'unitId must belong to the property');
  }
  const tenantId =
    typeof body.tenantId === 'string' && body.tenantId.trim() ? body.tenantId.trim() : null;
  if (tenantId) {
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!tenant) throw new RouteError(404, 'Tenant not found');
  }
  const leaseId =
    typeof body.leaseId === 'string' && body.leaseId.trim() ? body.leaseId.trim() : null;
  if (leaseId) {
    const lease = await db.lease.findFirst({ where: { id: leaseId, propertyId }, select: { id: true } });
    if (!lease) throw new RouteError(404, 'Lease not found');
  }
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : null;
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;

  const id = await createChargeWithInvoice({
    organizationId: actor.organizationId,
    propertyId,
    unitId,
    leaseId,
    tenantId,
    chargeType: chargeType as (typeof CHARGE_TYPES)[number],
    title,
    amount,
    currency: property.currency ?? 'KES',
    dueDate: new Date(dueRaw),
    postedAt: new Date(),
    notes,
  });

  await auditLog(actor, 'CHARGE', 'charge.create', id, {
    propertyId,
    unitId,
    tenantId,
    leaseId,
    chargeType,
    amount,
    dueDate: dueRaw,
  });
  return getCharge(actor, id);
}

// ── printable invoice (Slice 8) ─────────────────────────────────────────────

function statusChip(balance: number, overdue: boolean, posted: boolean): string {
  if (balance <= 0.009) return '<span class="chip paid">Paid</span>';
  if (!posted) return '<span class="chip due">Draft</span>';
  return overdue ? '<span class="chip overdue">Overdue</span>' : '<span class="chip due">Due</span>';
}

/**
 * Stateless invoice render for a charge. Mints the invoice number lazily
 * for pre-Slice-8 rows (updateMany on the NULL column — losers of the race
 * re-read the winner's number). Nothing is stored beyond the number.
 */
export async function invoiceCharge(
  actor: ScopeActor,
  id: string,
): Promise<{ invoiceNumber: string; html: string }> {
  const row = await db.charge.findFirst({
    where: { id, organizationId: actor.organizationId, property: propertyScopeWhere(actor) },
    select: {
      id: true,
      organizationId: true,
      invoiceNumber: true,
      chargeType: true,
      title: true,
      amount: true,
      currency: true,
      dueDate: true,
      postedAt: true,
      notes: true,
      billingPeriodStart: true,
      billingPeriodEnd: true,
      createdAt: true,
      organization: { select: { name: true } },
      property: { select: { id: true, name: true, code: true, addressLine1: true, locality: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
      lease: { select: { id: true, leaseRef: true } },
      tenant: { select: { id: true, displayName: true, email: true, phone: true } },
      allocations: { select: { amount: true, allocatedAt: true } },
      adjustments: { select: { amount: true, status: true, type: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Charge not found');

  let invoiceNumber = row.invoiceNumber;
  if (!invoiceNumber) {
    for (let attempt = 0; attempt < 5 && !invoiceNumber; attempt += 1) {
      const candidate = await nextInvoiceNumber(row.organizationId);
      const updated = await db.charge.updateMany({
        where: { id: row.id, invoiceNumber: null },
        data: { invoiceNumber: candidate },
      });
      if (updated.count === 1) {
        invoiceNumber = candidate;
        break;
      }
      const fresh = await db.charge.findUnique({
        where: { id: row.id },
        select: { invoiceNumber: true },
      });
      if (fresh?.invoiceNumber) invoiceNumber = fresh.invoiceNumber;
    }
  }
  if (!invoiceNumber) throw new RouteError(500, 'Could not mint invoice number');

  const allocated = row.allocations.reduce((s, a) => s + Number(a.amount), 0);
  const adjusted = row.adjustments
    .filter((a) => a.status === 'APPROVED')
    .reduce((s, a) => s + Number(a.amount), 0);
  const balance = Number(row.amount) - allocated - adjusted;
  const overdue = row.postedAt != null && balance > 0.009 && dayStart(row.dueDate) < dayStart(new Date());

  const org = [row.property.addressLine1, row.property.locality].filter(Boolean).join(', ');
  const billTo = [
    row.tenant?.displayName,
    row.tenant?.phone,
    row.tenant?.email,
  ].filter(Boolean).join('<br>');
  const period =
    row.billingPeriodStart && row.billingPeriodEnd
      ? `${formatDate(row.billingPeriodStart)} – ${formatDate(row.billingPeriodEnd)}`
      : row.billingPeriodStart
        ? formatDate(row.billingPeriodStart)
        : null;
  const periodRow = period
    ? `<tr><td>Billing period</td><td class="num">${esc(period)}</td></tr>`
    : '';

  const body = `
    <div class="head">
      <div>
        <p class="org">${esc(row.organization.name)}</p>
        <p class="muted">${row.property.code ? `${esc(row.property.code)} · ` : ''}${esc(row.property.name)}${org ? `<br>${esc(org)}` : ''}</p>
      </div>
      <div class="meta">
        <h1>Invoice</h1>
        <p class="num">${esc(invoiceNumber)}</p>
        <p class="muted">Issued ${formatDate(row.createdAt)} · Due ${formatDate(row.dueDate)}</p>
        <p style="margin-top:6px">${statusChip(balance, overdue, row.postedAt != null)}</p>
      </div>
    </div>
    <div class="parties">
      <div>
        <h2>Bill to</h2>
        <p>${billTo || '<span class="muted">No tenant on this charge</span>'}</p>
      </div>
      <div>
        <h2>For</h2>
        <p>${row.unit ? `Unit ${esc(row.unit.unitRef)}${row.unit.label ? ` · ${esc(row.unit.label)}` : ''}<br>` : ''}${row.lease?.leaseRef ? `Lease ${esc(row.lease.leaseRef)}<br>` : ''}${esc(row.property.name)}</p>
      </div>
    </div>
    ${periodRow ? `<table class="meta-table"><tbody>${periodRow}</tbody></table>` : ''}
    <table>
      <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>
            <strong>${esc(row.title ?? row.chargeType.replaceAll('_', ' '))}</strong><br>
            <span class="muted">${esc(row.chargeType.replaceAll('_', ' '))}</span>
          </td>
          <td class="num">${money(row.currency, row.amount.toString())}</td>
        </tr>
      </tbody>
    </table>
    <table class="totals">
      <tr><td>Amount</td><td class="num">${money(row.currency, row.amount.toString())}</td></tr>
      <tr><td>Paid</td><td class="num">− ${money(row.currency, allocated)}</td></tr>
      ${adjusted > 0 ? `<tr><td>Adjustments</td><td class="num">− ${money(row.currency, adjusted)}</td></tr>` : ''}
      <tr class="grand"><td>Balance</td><td class="num">${money(row.currency, balance)}</td></tr>
    </table>
    ${row.notes ? `<p class="muted" style="margin-top:16px">${esc(row.notes)}</p>` : ''}
    <div class="foot">
      <span>${esc(row.organization.name)} · generated ${formatDate(new Date())}</span>
      <span>${esc(invoiceNumber)}</span>
    </div>`;

  return { invoiceNumber, html: htmlDoc(`Invoice ${invoiceNumber}`, body) };
}

// ── lease-level rollup (leases register Balance column) ─────────────────────

export interface LeaseBalance {
  open: string;
  overdue: string;
  currency: string;
}

/** Per-lease open/overdue totals from posted charges (same math as dues). */
export async function leaseBalances(
  actor: ScopeActor,
  leaseIds: string[],
): Promise<Map<string, LeaseBalance>> {
  const out = new Map<string, LeaseBalance>();
  if (leaseIds.length === 0) return out;
  const charges = await db.charge.findMany({
    where: {
      leaseId: { in: leaseIds },
      organizationId: actor.organizationId,
      property: propertyScopeWhere(actor),
      postedAt: { not: null },
    },
    select: {
      leaseId: true,
      amount: true,
      currency: true,
      dueDate: true,
      allocations: { select: { amount: true } },
      adjustments: { select: { amount: true, status: true } },
    },
  });
  const today = dayStart(new Date());
  for (const c of charges) {
    if (!c.leaseId) continue;
    const allocated = c.allocations.reduce((s, a) => s + Number(a.amount), 0);
    const adjusted = c.adjustments
      .filter((a) => a.status === 'APPROVED')
      .reduce((s, a) => s + Number(a.amount), 0);
    const balance = Number(c.amount) - allocated - adjusted;
    const row = out.get(c.leaseId) ?? { open: '0', overdue: '0', currency: c.currency };
    const open = Number(row.open) + balance;
    const overdue = Number(row.overdue) + (dayStart(c.dueDate) < today && balance > 0.009 ? balance : 0);
    out.set(c.leaseId, { open: open.toFixed(2), overdue: overdue.toFixed(2), currency: c.currency });
  }
  return out;
}
