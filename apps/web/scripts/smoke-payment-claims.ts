/**
 * Payment claims + scheduled-jobs smoke:
 * tenant posts a payment message → confirm allocates a real Payment
 * (paidAt kept, tenant emailed) / reject notes back; scheduler runs
 * charge generation + lease-expiry notifications (idempotent, deduped);
 * /api/cron/run is bearer-gated (401 without CRON_SECRET).
 *
 *   cd apps/web && set -a && source .env && set +a \
 *     && ../../packages/database/node_modules/.bin/tsx scripts/smoke-payment-claims.ts
 *
 * Needs the dev server up (the cron HTTP cases hit http://localhost:3000).
 * Prints one line per case; exits 1 on any failure.
 */

import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '@/lib/auth';
import { ensureOtherOrg } from './lib/ensure-other-org';
import { RouteError } from '@/lib/api-route';
import * as claims from '@/lib/domain/payment-claim';
import * as scheduler from '@/lib/domain/scheduler';
import * as units from '@/lib/domain/unit';
import * as leases from '@/lib/domain/lease';
import * as ledgerAccounts from '@/lib/domain/ledger-account';

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function check(label: string, cond: boolean, detail = '') {
  if (cond) ok(label);
  else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function expectStatus(label: string, status: number, fn: () => Promise<unknown>) {
  try {
    await fn();
    failed += 1;
    console.log(`  ✗ ${label} — expected ${status}, succeeded`);
  } catch (err) {
    if (err instanceof RouteError && err.status === status) {
      ok(`${label} → ${status} (${err.message})`);
    } else {
      failed += 1;
      console.log(
        `  ✗ ${label} — expected ${status}, got ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

async function expectOk<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const result = await fn();
    ok(label);
    return result;
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${label} — ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

function isoDays(delta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

const outboxDir = path.join(process.cwd(), '.email-outbox');
const outboxCount = () => (fs.existsSync(outboxDir) ? fs.readdirSync(outboxDir).length : 0);

const BASE_URL = process.env.APP_URL ?? 'http://localhost:3000';
const month = new Date().toISOString().slice(0, 7);

const org = await prisma.organization.findFirstOrThrow();
const otherOrg = await ensureOtherOrg(org.id);
const user = await prisma.user.findFirstOrThrow();

const actor = { userId: user.id, organizationId: org.id };
const stranger = otherOrg ? { userId: user.id, organizationId: otherOrg.id } : null;
const tenantName = `SMOKE Claim Tenant ${Date.now()}`;

const claimIds: string[] = [];
const cleanupPayments: string[] = [];
let propertyId = '';
let unitA = '';
let unitB = '';
let tenantId = '';
let leaseId = '';

try {
  console.log('— setup: property, units, tenant (emailed), ACTIVE lease ending in 45 days');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Claims Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 70',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property) throw new Error('setup failed');
  propertyId = property.id;

  const a = await expectOk('create unit A', () =>
    units.createUnit(actor, propertyId, { unitRef: 'SMOKE-CLM-A', unitType: 'BED_1', defaultRent: 25000 }),
  );
  const b = await expectOk('create unit B (off-lease)', () =>
    units.createUnit(actor, propertyId, { unitRef: 'SMOKE-CLM-B', unitType: 'BED_1', defaultRent: 20000 }),
  );
  if (!a || !b) throw new Error('setup failed');
  unitA = a.id;
  unitB = b.id;

  const t = await expectOk('create tenant with email', () =>
    prisma.tenant.create({
      data: {
        organizationId: org.id,
        displayName: tenantName,
        tenantRef: `SMOKE-CLM-${Date.now()}`,
        email: 'smoke-claims@sisohomes.test',
      },
    }),
  );
  if (!t) throw new Error('setup failed');
  tenantId = t.id;

  await expectOk('ensurePropertyAccounts (RENT + UTILITIES)', () =>
    ledgerAccounts.ensurePropertyAccounts(actor, propertyId),
  );

  const lease = await expectOk('create + approve lease (ends in 45 days → expiry window)', async () => {
    const created = await leases.createLease(actor, {
      propertyId,
      leaseRef: `SMOKE-CLM-${Date.now()}`,
      status: 'PENDING_APPROVAL',
      startsAt: isoDays(-200),
      endsAt: isoDays(45),
      units: [{ unitId: unitA, monthlyRent: 25000 }],
      parties: [{ tenantId, relationship: 'PRIMARY' }],
    });
    return leases.approveLease(actor, created.id);
  });
  if (!lease) throw new Error('setup failed');
  leaseId = lease.id;
  check('lease is ACTIVE', lease.status === 'ACTIVE', lease.status);

  const portalActor = { userId: user.id, tenantId, organizationId: org.id };

  console.log('— scheduler: generate-charges (scoped, idempotent, deduped summary)');
  const gen1 = await expectOk('runGenerateCharges #1', () =>
    scheduler.runGenerateCharges({ organizationId: org.id, propertyId, month }),
  );
  check('run #1 posted rent for the lease', (gen1?.chargesCreated ?? 0) >= 1, String(gen1?.chargesCreated));
  check('run #1 no errors', (gen1?.errors.length ?? 1) === 0, (gen1?.errors ?? []).join('; '));

  const gen2 = await expectOk('runGenerateCharges #2 (idempotent)', () =>
    scheduler.runGenerateCharges({ organizationId: org.id, propertyId, month }),
  );
  check('run #2 created nothing', (gen2?.chargesCreated ?? -1) === 0, String(gen2?.chargesCreated));

  const summaryCount = await prisma.notification.count({
    where: { organizationId: org.id, type: 'cron.generate_charges' },
  });
  check('charge summary notification exists', summaryCount >= 1, String(summaryCount));

  await expectStatus('generate-charges bad month → 400', 400, () =>
    scheduler.runGenerateCharges({ organizationId: org.id, propertyId, month: '2026-13' }),
  );

  const eligible = await prisma.organizationMember.count({
    where: {
      organizationId: org.id,
      status: 'ACTIVE',
      roles: { some: { role: { permissions: { some: { permission: { key: 'lease.list' } } } } } },
    },
  });
  check('org has a lease.list member to notify', eligible >= 1, String(eligible));

  console.log('— scheduler: lease-expiry (60d window, deduped on re-run)');
  const exp1 = await expectOk('runLeaseExpiryAlerts #1', () =>
    scheduler.runLeaseExpiryAlerts({ organizationId: org.id, propertyId }),
  );
  check('run #1 created an expiry notification', (exp1?.notifications ?? 0) >= 1, String(exp1?.notifications));
  const exp2 = await expectOk('runLeaseExpiryAlerts #2 (deduped)', () =>
    scheduler.runLeaseExpiryAlerts({ organizationId: org.id, propertyId }),
  );
  check('run #2 created nothing', (exp2?.notifications ?? -1) === 0, String(exp2?.notifications));

  console.log('— claim validation: amount, method, future paidAt, off-lease unit');
  await expectStatus('amount 0 → 400', 400, () =>
    claims.createPaymentClaim(portalActor, {
      unitId: unitA,
      amount: 0,
      method: 'MPESA',
      accountType: 'RENT',
      paidAt: isoDays(-3),
    }),
  );
  await expectStatus('bad method → 400', 400, () =>
    claims.createPaymentClaim(portalActor, {
      unitId: unitA,
      amount: 1000,
      method: 'CARRIER_PIGEON',
      paidAt: isoDays(-3),
    }),
  );
  await expectStatus('future paidAt → 400', 400, () =>
    claims.createPaymentClaim(portalActor, {
      unitId: unitA,
      amount: 1000,
      method: 'MPESA',
      paidAt: isoDays(9),
    }),
  );
  await expectStatus('off-lease unit → 404', 404, () =>
    claims.createPaymentClaim(portalActor, {
      unitId: unitB,
      amount: 1000,
      method: 'MPESA',
      paidAt: isoDays(-3),
    }),
  );

  console.log('— claim #1: create (portal) → staff notified');
  const mailBefore = outboxCount();
  const c1 = await expectOk('create claim (RENT 10000, M-Pesa)', () =>
    claims.createPaymentClaim(portalActor, {
      unitId: unitA,
      amount: 10000,
      method: 'MPESA',
      accountType: 'RENT',
      paidAt: isoDays(-3),
      reference: 'SMOKE-REF-1',
      message: 'Paid via M-Pesa till 407',
    }),
  );
  if (!c1) throw new Error('claim create failed');
  claimIds.push(c1.claim.id);
  check('claim starts PENDING', c1.claim.status === 'PENDING', c1.claim.status);

  const staffNotices = await prisma.notification.count({
    where: { organizationId: org.id, type: 'payment_claim', userId: user.id },
  });
  check('staff notification written', staffNotices >= 1, String(staffNotices));

  const portalRows = await expectOk('list tenant claims', () => claims.listTenantPaymentClaims(portalActor));
  check('tenant sees their claim', (portalRows?.rows ?? []).some((r) => r.id === c1.claim.id));

  const orgRows = await expectOk('list org claims (PENDING)', () =>
    claims.listPaymentClaims(actor, { status: 'PENDING' }),
  );
  check('org sees the pending claim', (orgRows?.rows ?? []).some((r) => r.id === c1.claim.id));

  if (stranger) {
    const strangerRows = await expectOk('list stranger claims', () =>
      claims.listPaymentClaims(stranger, {}),
    );
    check('stranger org does not see it', !(strangerRows?.rows ?? []).some((r) => r.id === c1.claim.id));
    await expectStatus('stranger decide → 404', 404, () =>
      claims.decidePaymentClaim(stranger, c1.claim.id, { action: 'confirm' }),
    );
  }

  console.log('— claim #1: confirm → Payment + allocation + email + audit');
  const confirmed = await expectOk('confirm claim #1', () =>
    claims.decidePaymentClaim(actor, c1.claim.id, { action: 'confirm' }),
  );
  check('confirm returns a paymentId', Boolean(confirmed?.paymentId), JSON.stringify(confirmed));
  if (confirmed?.paymentId) cleanupPayments.push(confirmed.paymentId);

  const row1 = await prisma.paymentClaim.findUnique({ where: { id: c1.claim.id } });
  check('claim is CONFIRMED', row1?.status === 'CONFIRMED', row1?.status ?? 'null');
  check('claim stores paymentId', row1?.paymentId === confirmed?.paymentId);
  check('claim records decider', row1?.decidedByUserId === actor.userId);

  const payment = confirmed?.paymentId
    ? await prisma.payment.findUnique({
        where: { id: confirmed.paymentId },
        include: { allocations: true },
      })
    : null;
  check('payment exists', payment !== null);
  check('payment amount 10000', Number(payment?.amount ?? 0) === 10000, String(payment?.amount));
  check(
    'payment kept the tenant paidAt',
    payment?.receivedAt.toISOString() === row1?.paidAt.toISOString(),
    `${payment?.receivedAt.toISOString()} vs ${row1?.paidAt.toISOString()}`,
  );
  check('payment allocated to a charge', (payment?.allocations.length ?? 0) >= 1, String(payment?.allocations.length));

  const rentCharge = await prisma.charge.findFirst({
    where: { leaseId, chargeType: 'RENT' },
    include: { allocations: true },
  });
  const balance =
    rentCharge != null
      ? Number(rentCharge.amount) - rentCharge.allocations.reduce((s, al) => s + Number(al.amount), 0)
      : -1;
  check('charge balance dropped by 10000', Math.abs(balance - 15000) < 0.01, String(balance));

  const confirmAudit = await prisma.auditLog.count({
    where: { resourceId: c1.claim.id, action: 'payment_claim.confirm' },
  });
  check('payment_claim.confirm audit row', confirmAudit >= 1, String(confirmAudit));
  check('confirmation email queued', outboxCount() === mailBefore + 1, `${mailBefore} → ${outboxCount()}`);

  await expectStatus('confirm again → 409', 409, () =>
    claims.decidePaymentClaim(actor, c1.claim.id, { action: 'confirm' }),
  );

  console.log('— claim #2: reject with a note → tenant emailed');
  const mailBefore2 = outboxCount();
  const c2 = await expectOk('create claim #2', () =>
    claims.createPaymentClaim(portalActor, {
      unitId: unitA,
      amount: 5000,
      method: 'CASH',
      paidAt: isoDays(-2),
    }),
  );
  if (!c2) throw new Error('claim create failed');
  claimIds.push(c2.claim.id);
  const rejected = await expectOk('reject claim #2 with note', () =>
    claims.decidePaymentClaim(actor, c2.claim.id, { action: 'reject', note: 'No cash reached our office.' }),
  );
  check('reject returns REJECTED', rejected?.status === 'REJECTED', rejected?.status);
  const row2 = await prisma.paymentClaim.findUnique({ where: { id: c2.claim.id } });
  check('claim is REJECTED with note', row2?.status === 'REJECTED' && row2?.decisionNote === 'No cash reached our office.');
  check('rejection email queued', outboxCount() === mailBefore2 + 1, `${mailBefore2} → ${outboxCount()}`);
  await expectStatus('decide a rejected claim → 409', 409, () =>
    claims.decidePaymentClaim(actor, c2.claim.id, { action: 'confirm' }),
  );

  console.log('— claim #3/#4: confirm failures revert the claim to PENDING');
  const c3 = await expectOk('create claim #3 (over balance)', () =>
    claims.createPaymentClaim(portalActor, { unitId: unitA, amount: 999999, method: 'MPESA', paidAt: isoDays(-1) }),
  );
  if (!c3) throw new Error('claim create failed');
  claimIds.push(c3.claim.id);
  await expectStatus('confirm over-balance → 400', 400, () =>
    claims.decidePaymentClaim(actor, c3.claim.id, { action: 'confirm' }),
  );
  const row3 = await prisma.paymentClaim.findUnique({ where: { id: c3.claim.id } });
  check('over-balance claim reverted to PENDING', row3?.status === 'PENDING', row3?.status ?? 'null');
  await claims.decidePaymentClaim(actor, c3.claim.id, { action: 'reject', note: 'Amount does not match our records.' });

  const c4 = await expectOk('create claim #4 (UTILITIES, no open charges)', () =>
    claims.createPaymentClaim(portalActor, {
      unitId: unitA,
      amount: 2000,
      method: 'MPESA',
      accountType: 'UTILITIES',
      paidAt: isoDays(-1),
    }),
  );
  if (!c4) throw new Error('claim create failed');
  claimIds.push(c4.claim.id);
  await expectStatus('confirm utilities → 400 (no open charges)', 400, () =>
    claims.decidePaymentClaim(actor, c4.claim.id, { action: 'confirm' }),
  );
  const row4 = await prisma.paymentClaim.findUnique({ where: { id: c4.claim.id } });
  check('utilities claim still PENDING', row4?.status === 'PENDING', row4?.status ?? 'null');
  await claims.decidePaymentClaim(actor, c4.claim.id, { action: 'reject', note: 'No utility bills open.' });
  const row4b = await prisma.paymentClaim.findUnique({ where: { id: c4.claim.id } });
  check('queue cleaned (claim #4 rejected)', row4b?.status === 'REJECTED');

  console.log('— bad action → 400');
  await expectStatus('action ponder → 400', 400, () =>
    claims.decidePaymentClaim(actor, c2.claim.id, { action: 'ponder' }),
  );

  console.log('— HTTP: POST /api/cron/run (bearer-gated)');
  check('CRON_SECRET loaded from .env', Boolean(process.env.CRON_SECRET));
  const workflowPath = path.join(process.cwd(), '..', '..', '.github', 'workflows', 'scheduled-jobs.yml');
  check('GH workflow exists', fs.existsSync(workflowPath), workflowPath);

  const cron = async (headers: Record<string, string>, body: unknown) => {
    try {
      const res = await fetch(`${BASE_URL}/api/cron/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      return { status: res.status, data: await res.json().catch(() => ({})) as Record<string, unknown> };
    } catch (err) {
      return { status: 0, data: { error: err instanceof Error ? err.message : String(err) } };
    }
  };

  const noAuth = await cron({}, {});
  check('no bearer → 401 (start the dev server if this is 0)', noAuth.status === 401, JSON.stringify(noAuth.data));
  const badAuth = await cron({ Authorization: 'Bearer wrong-secret' }, {});
  check('wrong bearer → 401', badAuth.status === 401, String(badAuth.status));

  if (noAuth.status === 401) {
    const run = await cron(
      { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      { job: 'lease-expiry', organizationId: org.id, propertyId },
    );
    check('valid bearer → 200', run.status === 200, String(run.status));
    const results = (run.data?.result as { results?: { job: string }[] } | undefined)?.results ?? [];
    check('ran lease-expiry job', results[0]?.job === 'lease-expiry', JSON.stringify(results));

    const badJob = await cron({ Authorization: `Bearer ${process.env.CRON_SECRET}` }, { job: 'ponder' });
    check('unknown job → 400', badJob.status === 400, String(badJob.status));
  } else {
    failed += 1;
    console.log('  ✗ cron HTTP cases skipped — dev server unreachable');
  }
} finally {
  console.log('— cleanup');
  await prisma.notification.deleteMany({
    where: {
      organizationId: org.id,
      OR: [
        { type: 'payment_claim', title: { contains: tenantName } },
        { type: 'lease_expiring', link: `/leasing/leases/${leaseId}` },
        { type: 'cron.generate_charges', metadata: { path: ['month'], equals: month } },
      ],
    },
  });
  if (claimIds.length > 0) {
    await prisma.paymentClaim.deleteMany({ where: { id: { in: claimIds } } });
  }
  if (cleanupPayments.length > 0) {
    await prisma.paymentAllocation.deleteMany({ where: { paymentId: { in: cleanupPayments } } });
    await prisma.receipt.deleteMany({ where: { paymentId: { in: cleanupPayments } } });
    await prisma.payment.deleteMany({ where: { id: { in: cleanupPayments } } });
  }
  if (leaseId) {
    await prisma.paymentAllocation.deleteMany({ where: { charge: { leaseId } } });
    await prisma.charge.deleteMany({ where: { leaseId } });
    await prisma.lease.deleteMany({ where: { id: leaseId } });
  }
  if (tenantId) await prisma.tenant.deleteMany({ where: { id: tenantId } });
  if (unitA) await prisma.unit.deleteMany({ where: { id: unitA } });
  if (unitB) await prisma.unit.deleteMany({ where: { id: unitB } });
  if (propertyId) {
    await prisma.ledgerAccount.deleteMany({ where: { propertyId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
