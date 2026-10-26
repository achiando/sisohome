/**
 * Payment claims — a tenant posts "I paid" from the portal; the landlord/PM
 * confirms or rejects. The real Payment row only appears on CONFIRM: it is
 * created through recordMultiMonthPayment (oldest-first allocation, keeping
 * the tenant's paidAt as receivedAt), then the claim records its paymentId.
 * Pending/rejected claims never touch balances, reports or the portal
 * statement.
 *
 * Decision race: confirming first flips the claim PENDING → CONFIRMED via a
 * conditional updateMany — a concurrent confirm loses (409) before any money
 * moves; a failure after the flip reverts the claim to PENDING.
 */
import { sendEmail } from '@workspace/email';

import { paymentClaimResultEmail } from '@/lib/email/payment-claim';
import { appUrl } from '@/lib/base-url';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import type { PaymentMethod } from '@workspace/database';

import { auditLog } from './audit';
import { recordMultiMonthPayment } from './monthly';
import { notifyOrgUsers } from './notification';
import type { ScopeActor } from './property-scope';
import type { PortalTenantActor } from '@/lib/portal-guard';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHODS: PaymentMethod[] = ['CASH', 'MPESA', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'];
const ACCOUNT_TYPES = ['RENT', 'UTILITIES'] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

const CLAIM_INCLUDE = {
  tenant: { select: { id: true, displayName: true, email: true } },
  unit: { select: { unitRef: true, label: true } },
  property: { select: { name: true } },
  payment: { select: { id: true, receivedAt: true } },
} as const;

type ClaimRecord = Awaited<ReturnType<typeof db.paymentClaim.create>> & {
  tenant: { id: string; displayName: string; email: string | null };
  unit: { unitRef: string; label: string | null };
  property: { name: string };
  payment: { id: string; receivedAt: Date } | null;
};

function money(currency: string, amount: unknown): string {
  const n = Number(amount);
  return `${currency} ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shape(c: ClaimRecord) {
  return {
    id: c.id,
    status: c.status,
    amount: Number(c.amount).toFixed(2),
    currency: c.currency,
    method: c.method,
    accountType: c.accountType,
    reference: c.reference,
    paidAt: c.paidAt.toISOString(),
    message: c.message,
    createdAt: c.createdAt.toISOString(),
    decidedAt: c.decidedAt ? c.decidedAt.toISOString() : null,
    decisionNote: c.decisionNote,
    paymentId: c.paymentId,
    tenant: { id: c.tenant.id, displayName: c.tenant.displayName },
    unit: { unitRef: c.unit.unitRef, label: c.unit.label },
    property: { name: c.property.name },
  };
}

// ── portal (tenant) side ─────────────────────────────────────────────────────

export type CreateClaimResult = {
  claim: { id: string; status: string; amount: string; currency: string; paidAt: string };
};

/**
 * Portal: post a payment message. The unit must sit on one of the tenant's
 * ACTIVE/ENDING leases in the same org — everything else (propertyId,
 * leaseId, currency) is resolved server-side from that link.
 */
export async function createPaymentClaim(
  actor: PortalTenantActor,
  raw: unknown,
): Promise<CreateClaimResult> {
  const body = (raw ?? {}) as Record<string, unknown>;

  const unitId = typeof body.unitId === 'string' ? body.unitId.trim() : '';
  if (!UUID_RE.test(unitId)) throw new RouteError(400, 'unitId is required');

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new RouteError(400, 'amount must be positive');
  if (amount > 100_000_000) throw new RouteError(400, 'amount is too large');

  const method = String(body.method ?? '')
    .trim()
    .toUpperCase();
  if (!METHODS.includes(method as PaymentMethod)) {
    throw new RouteError(400, `method must be one of ${METHODS.join(', ')}`);
  }

  const accountType = String(body.accountType ?? 'RENT').trim().toUpperCase();
  if (!ACCOUNT_TYPES.includes(accountType as AccountType)) {
    throw new RouteError(400, 'accountType must be RENT or UTILITIES');
  }

  const paidAt = new Date(typeof body.paidAt === 'string' ? body.paidAt : '');
  if (Number.isNaN(paidAt.getTime())) throw new RouteError(400, 'paidAt must be a valid date');
  if (paidAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new RouteError(400, 'paidAt cannot be in the future');
  }

  const reference =
    typeof body.reference === 'string' && body.reference.trim().length > 0
      ? body.reference.trim().slice(0, 120)
      : null;
  const message =
    typeof body.message === 'string' && body.message.trim().length > 0
      ? body.message.trim().slice(0, 2000)
      : null;

  const link = await db.leaseUnit.findFirst({
    where: {
      unitId,
      lease: {
        organizationId: actor.organizationId,
        status: { in: ['ACTIVE', 'ENDING'] },
        parties: { some: { tenantId: actor.tenantId } },
      },
    },
    select: { leaseId: true, lease: { select: { currency: true } } },
  });
  if (!link) throw new RouteError(404, 'This unit is not on your active lease');

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { id: true, propertyId: true },
  });
  if (!unit) throw new RouteError(404, 'Unit not found');

  const claim = await db.paymentClaim.create({
    data: {
      organizationId: actor.organizationId,
      tenantId: actor.tenantId,
      leaseId: link.leaseId,
      unitId,
      propertyId: unit.propertyId,
      amount: amount.toFixed(2),
      currency: link.lease.currency,
      method: method as PaymentMethod,
      accountType,
      reference,
      paidAt,
      message,
    },
  });

  await auditLog(
    actor,
    'PAYMENT',
    'payment_claim.create',
    claim.id,
    { unitId, amount: amount.toFixed(2), method, accountType },
  );

  const tenant = await db.tenant.findUnique({
    where: { id: actor.tenantId },
    select: { displayName: true },
  });
  try {
    await notifyOrgUsers(actor.organizationId, 'payment.list', {
      type: 'payment_claim',
      title: `Payment claim — ${tenant?.displayName ?? 'tenant'}`,
      body: money(claim.currency, claim.amount) + ` via ${method}${reference ? ` · ${reference}` : ''}`,
      link: '/finances',
      metadata: { claimId: claim.id },
    });
  } catch (err) {
    console.error('Payment claim notification failed:', err);
  }

  return {
    claim: {
      id: claim.id,
      status: claim.status,
      amount: Number(claim.amount).toFixed(2),
      currency: claim.currency,
      paidAt: claim.paidAt.toISOString(),
    },
  };
}

/** Portal: the tenant's own claims, newest first. */
export async function listTenantPaymentClaims(actor: PortalTenantActor) {
  const rows = await db.paymentClaim.findMany({
    where: { tenantId: actor.tenantId, organizationId: actor.organizationId },
    include: CLAIM_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return { rows: rows.map(shape) };
}

// ── org (landlord/PM) side ───────────────────────────────────────────────────

export async function listPaymentClaims(actor: ScopeActor, raw: unknown) {
  const body = (raw ?? {}) as Record<string, unknown>;
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
  if (status && !['PENDING', 'CONFIRMED', 'REJECTED'].includes(status)) {
    throw new RouteError(400, 'status must be PENDING, CONFIRMED or REJECTED');
  }

  const rows = await db.paymentClaim.findMany({
    where: {
      organizationId: actor.organizationId,
      ...(status ? { status: status as 'PENDING' | 'CONFIRMED' | 'REJECTED' } : {}),
    },
    include: CLAIM_INCLUDE,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });
  return { rows: rows.map(shape) };
}

async function mailClaimResult(claim: ClaimRecord, note: string | null): Promise<void> {
  if (!claim.tenant.email) return;
  const statementUrl = `${appUrl()}/portal/statement`;
  try {
    await sendEmail(
      paymentClaimResultEmail({
        to: claim.tenant.email,
        tenantName: claim.tenant.displayName,
        status: claim.status === 'CONFIRMED' ? 'CONFIRMED' : 'REJECTED',
        amount: money(claim.currency, claim.amount),
        paidAt: claim.paidAt.toISOString().slice(0, 10),
        reference: claim.reference,
        note,
        statementUrl,
      }),
    );
  } catch (err) {
    console.error('Payment claim email failed:', err);
  }
}

/**
 * Org side: confirm (creates the real Payment + allocation) or reject
 * (note back to the tenant). `action` is required.
 */
export async function decidePaymentClaim(
  actor: ScopeActor,
  id: string,
  raw: unknown,
): Promise<{ status: string; paymentId?: string; allocated?: number; months?: string[] }> {
  if (!UUID_RE.test(id)) throw new RouteError(404, 'Payment claim not found');
  const body = (raw ?? {}) as Record<string, unknown>;
  const action = String(body.action ?? '').trim().toLowerCase();
  if (action !== 'confirm' && action !== 'reject') {
    throw new RouteError(400, "action must be 'confirm' or 'reject'");
  }
  const note =
    typeof body.note === 'string' && body.note.trim().length > 0
      ? body.note.trim().slice(0, 1000)
      : null;

  const found = await db.paymentClaim.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: CLAIM_INCLUDE,
  });
  if (!found) throw new RouteError(404, 'Payment claim not found');
  if (found.status !== 'PENDING') throw new RouteError(409, 'This claim was already decided');

  if (action === 'reject') {
    const flipped = await db.paymentClaim.updateMany({
      where: { id, organizationId: actor.organizationId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        decidedByUserId: actor.userId,
        decidedAt: new Date(),
        decisionNote: note,
      },
    });
    if (flipped.count === 0) throw new RouteError(409, 'This claim was already decided');

    await auditLog(actor, 'PAYMENT', 'payment_claim.reject', id, { note });
    const claim = (await db.paymentClaim.findUnique({
      where: { id },
      include: CLAIM_INCLUDE,
    })) as ClaimRecord;
    await mailClaimResult(claim, note);
    return { status: 'REJECTED' };
  }

  // ── confirm ──
  const accountType = found.accountType.toUpperCase();
  if (accountType !== 'RENT' && accountType !== 'UTILITIES') {
    throw new RouteError(400, `Claim has an unsupported account type: ${found.accountType}`);
  }

  // Take the decision slot first — a concurrent confirm loses here (409)
  // before any money moves.
  const flipped = await db.paymentClaim.updateMany({
    where: { id, organizationId: actor.organizationId, status: 'PENDING' },
    data: {
      status: 'CONFIRMED',
      decidedByUserId: actor.userId,
      decidedAt: new Date(),
      decisionNote: note,
    },
  });
  if (flipped.count === 0) throw new RouteError(409, 'This claim was already decided');

  const revert = async () => {
    await db.paymentClaim.updateMany({
      where: { id, status: 'CONFIRMED', paymentId: null },
      data: { status: 'PENDING', decidedByUserId: null, decidedAt: null, decisionNote: null },
    });
  };

  let result;
  try {
    result = await recordMultiMonthPayment(actor, {
      propertyId: found.propertyId,
      unitId: found.unitId,
      tenantId: found.tenantId,
      leaseId: found.leaseId,
      accountType,
      months: 36,
      amount: Number(found.amount),
      method: found.method,
      reference: found.reference,
      notes: `Payment claim ${found.id} (claimed ${found.paidAt.toISOString().slice(0, 10)})`,
      receivedAt: found.paidAt,
    });
  } catch (err) {
    await revert();
    throw err;
  }

  await db.paymentClaim.update({ where: { id }, data: { paymentId: result.paymentId } });
  await auditLog(actor, 'PAYMENT', 'payment_claim.confirm', id, {
    paymentId: result.paymentId,
    amount: Number(found.amount).toFixed(2),
    allocated: result.allocatedCharges.length,
    months: result.monthsCovered,
    note,
  });

  const claim = (await db.paymentClaim.findUnique({
    where: { id },
    include: CLAIM_INCLUDE,
  })) as ClaimRecord;
  await mailClaimResult(claim, note);

  return {
    status: 'CONFIRMED',
    paymentId: result.paymentId,
    allocated: result.allocatedCharges.length,
    months: result.monthsCovered,
  };
}
