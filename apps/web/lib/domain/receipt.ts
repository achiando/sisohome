/**
 * Receipt domain (Slice 3b) — payment evidence for tenants. Numbering:
 * RE-YYYY-NNNN per org, sequential from count+1 with retry on the unique
 * (organizationId, receiptNumber) constraint. Slice 8 adds the register
 * (`listReceipts`) and the printable view (`getReceipt` → stateless HTML).
 */

import type { Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';
import { esc, formatDate, htmlDoc, money } from './html-doc';

export interface ReceiptRow {
  id: string;
  receiptNumber: string | null;
  amount: string;
  issuedAt: string;
  paymentId: string;
}

export interface ReceiptRegisterRow extends ReceiptRow {
  currency: string;
  payment: {
    id: string;
    method: string;
    reference: string | null;
    receivedAt: string;
    amount: string;
    currency: string;
    property: { id: string; name: string };
    unit: { id: string; unitRef: string } | null;
    tenant: { id: string; displayName: string } | null;
  };
}

function shape(row: {
  id: string;
  receiptNumber: string | null;
  amount: { toString(): string } | null;
  issuedAt: Date;
  paymentId: string;
}): ReceiptRow {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    amount: row.amount ? row.amount.toString() : '0',
    issuedAt: row.issuedAt.toISOString(),
    paymentId: row.paymentId,
  };
}

async function nextNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.receipt.count({ where: { organizationId } });
  return `RE-${year}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Issue a receipt for a payment (full amount). Idempotent-ish: if the
 * payment already has a receipt, return it instead of creating a second.
 */
export async function issueReceipt(actor: ScopeActor, paymentId: string): Promise<ReceiptRow> {
  const payment = await db.payment.findFirst({
    where: { id: paymentId, organizationId: actor.organizationId, property: propertyScopeWhere(actor) },
    select: { id: true, amount: true, receipts: { select: { id: true } } },
  });
  if (!payment) throw new RouteError(404, 'Payment not found');

  if (payment.receipts.length > 0) {
    const existing = await db.receipt.findFirstOrThrow({
      where: { id: payment.receipts[0]!.id },
    });
    return shape(existing);
  }

  // retry a few times on unique (org, number) conflict
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const number = await nextNumber(actor.organizationId);
      const row = await db.receipt.create({
        data: {
          organizationId: actor.organizationId,
          paymentId: payment.id,
          receiptNumber: number,
          amount: payment.amount,
          issuedByUserId: actor.userId,
        },
      });
      await auditLog(actor, 'RECEIPT', 'receipt.issue', row.id, {
        paymentId: payment.id,
        receiptNumber: number,
      });
      return shape(row);
    } catch (err) {
      lastErr = err;
      const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code !== 'P2002') throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new RouteError(500, 'Could not issue receipt');
}

export async function listReceiptsForPayment(actor: ScopeActor, paymentId: string): Promise<ReceiptRow[]> {
  const rows = await db.receipt.findMany({
    where: { paymentId, organizationId: actor.organizationId, payment: { property: propertyScopeWhere(actor) } },
    orderBy: { issuedAt: 'desc' },
  });
  return rows.map(shape);
}

// ── Slice 8 — register + printable view ─────────────────────────────────────

const PAYMENT_SELECT = {
  id: true,
  method: true,
  reference: true,
  receivedAt: true,
  amount: true,
  currency: true,
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitRef: true } },
  tenant: { select: { id: true, displayName: true } },
} as const;

type ReceiptWithPayment = {
  id: string;
  receiptNumber: string | null;
  amount: { toString(): string } | null;
  issuedAt: Date;
  paymentId: string;
  payment: {
    id: string;
    method: string;
    reference: string | null;
    receivedAt: Date;
    amount: { toString(): string };
    currency: string;
    property: { id: string; name: string };
    unit: { id: string; unitRef: string } | null;
    tenant: { id: string; displayName: string } | null;
  };
};

function shapeRegister(row: ReceiptWithPayment): ReceiptRegisterRow {
  return {
    ...shape(row),
    currency: row.payment.currency,
    payment: {
      ...row.payment,
      receivedAt: row.payment.receivedAt.toISOString(),
      amount: row.payment.amount.toString(),
      method: String(row.payment.method),
    },
  };
}

export interface ReceiptFilters {
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  paymentId?: string;
  /** Inclusive ISO dates on the payment's receivedAt. */
  from?: string;
  to?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Issued receipts in scope with payment context (register). */
export async function listReceipts(actor: ScopeActor, filters: ReceiptFilters = {}): Promise<ReceiptRegisterRow[]> {
  if (filters.propertyId) await requirePropertyInScope(actor, filters.propertyId);
  const payment: Prisma.PaymentWhereInput = {
    property: propertyScopeWhere(actor),
  };
  if (filters.propertyId) payment.propertyId = filters.propertyId;
  if (filters.unitId) payment.unitId = filters.unitId;
  if (filters.tenantId) payment.tenantId = filters.tenantId;
  if (filters.paymentId) payment.id = filters.paymentId;
  if (filters.from && !DATE_RE.test(filters.from)) throw new RouteError(400, 'from must be YYYY-MM-DD');
  if (filters.to && !DATE_RE.test(filters.to)) throw new RouteError(400, 'to must be YYYY-MM-DD');
  if (filters.from || filters.to) {
    payment.receivedAt = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
    };
  }

  const rows = await db.receipt.findMany({
    where: { organizationId: actor.organizationId, payment },
    select: {
      id: true,
      receiptNumber: true,
      amount: true,
      issuedAt: true,
      paymentId: true,
      payment: { select: PAYMENT_SELECT },
    },
    orderBy: { issuedAt: 'desc' },
    take: 200,
  });
  return rows.map(shapeRegister);
}

/** One receipt with full payment context (printable view). */
export async function getReceipt(actor: ScopeActor, id: string): Promise<ReceiptRegisterRow> {
  const row = await db.receipt.findFirst({
    where: { id, organizationId: actor.organizationId, payment: { property: propertyScopeWhere(actor) } },
    select: {
      id: true,
      receiptNumber: true,
      amount: true,
      issuedAt: true,
      paymentId: true,
      payment: { select: PAYMENT_SELECT },
    },
  });
  if (!row) throw new RouteError(404, 'Receipt not found');
  return shapeRegister(row);
}

/** Stateless printable receipt (RE number, method/ref/date, parties, amount). */
export function renderReceiptHtml(r: ReceiptRegisterRow): string {
  const number = r.receiptNumber ?? '—';
  const body = `
    <div class="head">
      <div>
        <p class="org">Payment receipt</p>
        <p class="muted">${esc(r.payment.property.name)}${r.payment.unit ? ` · Unit ${esc(r.payment.unit.unitRef)}` : ''}</p>
      </div>
      <div class="meta">
        <h1>Receipt</h1>
        <p class="num">${esc(number)}</p>
        <p class="muted">Issued ${formatDate(r.issuedAt)}</p>
        <p style="margin-top:6px"><span class="chip paid">Paid</span></p>
      </div>
    </div>
    <div class="parties">
      <div>
        <h2>Received from</h2>
        <p>${r.payment.tenant ? esc(r.payment.tenant.displayName) : '<span class="muted">Walk-in / no tenant</span>'}</p>
      </div>
      <div>
        <h2>Payment</h2>
        <p>
          ${esc(r.payment.method.replaceAll('_', ' '))}${r.payment.reference ? ` · Ref ${esc(r.payment.reference)}` : ''}<br>
          Received ${formatDate(r.payment.receivedAt)}
        </p>
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>
            <strong>Payment received</strong><br>
            <span class="muted">${esc(r.payment.property.name)}${r.payment.unit ? ` · ${esc(r.payment.unit.unitRef)}` : ''}</span>
          </td>
          <td class="num">${money(r.payment.currency, r.payment.amount)}</td>
        </tr>
      </tbody>
    </table>
    <table class="totals">
      <tr class="grand"><td>Total received</td><td class="num">${money(r.payment.currency, r.amount)}</td></tr>
    </table>
    <div class="foot">
      <span>${esc(number)}</span>
      <span>Generated ${formatDate(new Date())}</span>
    </div>`;
  return htmlDoc(`Receipt ${number}`, body);
}
