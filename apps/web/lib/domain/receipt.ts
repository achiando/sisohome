/**
 * Receipt domain (Slice 3b) — payment evidence for tenants. Numbering:
 * RE-YYYY-NNNN per org, sequential from count+1 with retry on the unique
 * (organizationId, receiptNumber) constraint.
 */

import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import { propertyScopeWhere, type ScopeActor } from './property-scope';

export interface ReceiptRow {
  id: string;
  receiptNumber: string | null;
  amount: string;
  issuedAt: string;
  paymentId: string;
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
