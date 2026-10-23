/**
 * Slice 3 smoke — payments incl. utilities, rent vs utilities ledger
 * accounts, charges read with derived balance:
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-payments.ts
 *
 * Prints one line per case; exits 1 on any failure.
 */

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import * as ledgerAccounts from '@/lib/domain/ledger-account';
import * as payments from '@/lib/domain/payment';
import * as charges from '@/lib/domain/charge';
import * as units from '@/lib/domain/unit';

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
      console.log(`  ✗ ${label} — expected ${status}, got ${err instanceof Error ? err.message : err}`);
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

const org = await prisma.organization.findFirstOrThrow();
const otherOrg = await prisma.organization.findFirst({ where: { id: { not: org.id } } });
const user = await prisma.user.findFirstOrThrow();

const actor = { userId: user.id, organizationId: org.id };
const stranger = otherOrg ? { userId: user.id, organizationId: otherOrg.id } : null;

let pid = '';
let unitId = '';
let tenantId = '';
const cleanupCharges: string[] = [];
const cleanupPayments: string[] = [];

try {
  console.log('— setup: property + unit + tenant');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Payments Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 50',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property) throw new Error('setup failed');
  pid = property.id;

  const unit = await expectOk('create unit', () =>
    units.createUnit(actor, pid, { unitRef: 'SMOKE-PAY-A', unitType: 'BED_1', defaultRent: 20000 }),
  );
  if (!unit) throw new Error('setup failed');
  unitId = unit.id;

  const tenant = await expectOk('create tenant', () =>
    prisma.tenant.create({
      data: { organizationId: org.id, displayName: 'SMOKE Pay Tenant', tenantRef: `SMOKE-PAY-${Date.now()}` },
    }),
  );
  if (!tenant) throw new Error('setup failed');
  tenantId = tenant.id;

  console.log('— ledger accounts: property pair');
  const pair = await expectOk('ensurePropertyAccounts creates the pair', () =>
    ledgerAccounts.ensurePropertyAccounts(actor, pid),
  );
  if (pair) {
    check('pair has RENT + UTILITIES', pair.length === 2, String(pair.length));
    check('RENT account named', pair.find((a) => a.accountType === 'RENT')?.name === 'Rent account');
    check('UTILITIES account named', pair.find((a) => a.accountType === 'UTILITIES')?.name === 'Utilities account');
    const again = await ledgerAccounts.ensurePropertyAccounts(actor, pid);
    check('ensure is idempotent', again.length === 2 && again[0]?.id === pair[0]?.id);
  }

  const listed = await expectOk('listLedgerAccounts returns both', () =>
    ledgerAccounts.listLedgerAccounts(actor, { propertyId: pid }),
  );
  if (listed) check('list returns 2 active', listed.length === 2);

  if (stranger) {
    await expectStatus('accounts: stranger ensure → 404', 404, () =>
      ledgerAccounts.ensurePropertyAccounts(stranger, pid),
    );
  }

  console.log('— payments: rent vs utilities');
  const rentPay = await expectOk('record RENT payment', () =>
    payments.createPayment(actor, {
      propertyId: pid,
      unitId,
      tenantId,
      amount: 20000,
      method: 'MPESA',
      reference: 'SMOKE-RENT-1',
      accountType: 'RENT',
    }),
  );
  if (rentPay) {
    cleanupPayments.push(rentPay.id);
    check('rent payment accountType RENT', rentPay.account?.accountType === 'RENT', rentPay.account?.accountType ?? 'null');
    check('rent payment amount', rentPay.amount === '20000', rentPay.amount);
    check('rent payment method MPESA', rentPay.method === 'MPESA');
  }

  const utilPay = await expectOk('record UTILITIES payment', () =>
    payments.createPayment(actor, {
      propertyId: pid,
      unitId,
      tenantId,
      amount: 500,
      method: 'CASH',
      accountType: 'UTILITIES',
      notes: 'Waste collection',
    }),
  );
  if (utilPay) {
    cleanupPayments.push(utilPay.id);
    check('utilities payment accountType UTILITIES', utilPay.account?.accountType === 'UTILITIES');
    check('utilities payment amount', utilPay.amount === '500', utilPay.amount);
  }

  const breakdown = await expectOk('paymentsBreakdown splits rent vs utilities', () =>
    payments.paymentsBreakdown(actor, { propertyId: pid }),
  );
  if (breakdown) {
    check('breakdown rent total 20000', breakdown.rent.total === '20000.00', breakdown.rent.total);
    check('breakdown rent count 1', breakdown.rent.count === 1, String(breakdown.rent.count));
    check('breakdown utilities total 500', breakdown.utilities.total === '500.00', breakdown.utilities.total);
    check('breakdown utilities count 1', breakdown.utilities.count === 1, String(breakdown.utilities.count));
    check('breakdown total 20500', breakdown.total === '20500.00', breakdown.total);
  }

  const rentList = await expectOk('listPayments accountType=RENT filter', () =>
    payments.listPayments(actor, { propertyId: pid, accountType: 'RENT' }),
  );
  if (rentList) {
    check('RENT filter returns only rent', rentList.length === 1 && rentList[0]?.account?.accountType === 'RENT', String(rentList.length));
  }

  const tenantList = await expectOk('listPayments tenantId filter', () =>
    payments.listPayments(actor, { tenantId }),
  );
  if (tenantList) check('tenant filter returns both payments', tenantList.length === 2, String(tenantList.length));

  await expectStatus('payments: bad method → 400', 400, () =>
    payments.createPayment(actor, { propertyId: pid, amount: 1, method: 'BITCOIN' }),
  );
  await expectStatus('payments: bad amount → 400', 400, () =>
    payments.createPayment(actor, { propertyId: pid, amount: -5, method: 'CASH' }),
  );
  await expectStatus('payments: unknown unit → 404', 404, () =>
    payments.createPayment(actor, {
      propertyId: pid,
      unitId: '00000000-0000-0000-0000-000000000000',
      amount: 100,
      method: 'CASH',
    }),
  );
  if (stranger) {
    await expectStatus('payments: stranger list → 404', 404, () =>
      payments.listPayments(stranger, { propertyId: pid }),
    );
  }

  console.log('— charges read: derived balance + accountType bucket');
  const charge = await expectOk('seed a posted RENT charge', () =>
    prisma.charge.create({
      data: {
        organizationId: org.id,
        propertyId: pid,
        unitId,
        tenantId,
        chargeType: 'RENT',
        title: 'Smoke rent charge',
        amount: 20000,
        currency: 'KES',
        dueDate: new Date('2026-01-05'),
        postedAt: new Date(),
      },
    }),
  );
  if (charge) cleanupCharges.push(charge.id);

  const utilCharge = await expectOk('seed a posted GARBAGE charge', () =>
    prisma.charge.create({
      data: {
        organizationId: org.id,
        propertyId: pid,
        unitId,
        tenantId,
        chargeType: 'GARBAGE',
        title: 'Smoke waste charge',
        amount: 500,
        currency: 'KES',
        dueDate: new Date('2026-01-05'),
        postedAt: new Date(),
      },
    }),
  );
  if (utilCharge) cleanupCharges.push(utilCharge.id);

  if (charge) {
    await expectOk('allocate 8000 of the rent payment to the rent charge', () =>
      prisma.paymentAllocation.create({
        data: {
          organizationId: org.id,
          paymentId: rentPay!.id,
          chargeId: charge.id,
          amount: 8000,
        },
      }),
    );
  }

  const chargeList = await expectOk('listCharges returns both', () =>
    charges.listCharges(actor, { propertyId: pid }),
  );
  if (chargeList) {
    check('charge list length 2', chargeList.length === 2, String(chargeList.length));
    const rentCharge = chargeList.find((c) => c.chargeType === 'RENT');
    check('rent charge accountType RENT', rentCharge?.accountType === 'RENT');
    check('rent charge derived balance 12000', rentCharge?.balance === '12000.00', rentCharge?.balance ?? 'missing');
    check('rent charge allocatedTotal 8000', rentCharge?.allocatedTotal === '8000.00', rentCharge?.allocatedTotal ?? 'missing');
    const utilChargeRow = chargeList.find((c) => c.chargeType === 'GARBAGE');
    check('garbage charge accountType UTILITIES', utilChargeRow?.accountType === 'UTILITIES');
    check('garbage charge balance full 500', utilChargeRow?.balance === '500.00', utilChargeRow?.balance ?? 'missing');
  }

  const rentCharges = await expectOk('listCharges accountType=RENT filter', () =>
    charges.listCharges(actor, { propertyId: pid, accountType: 'RENT' }),
  );
  if (rentCharges) check('RENT charge filter returns 1', rentCharges.length === 1, String(rentCharges.length));

  const utilCharges = await expectOk('listCharges accountType=UTILITIES filter', () =>
    charges.listCharges(actor, { propertyId: pid, accountType: 'UTILITIES' }),
  );
  if (utilCharges) check('UTILITIES charge filter returns 1', utilCharges.length === 1, String(utilCharges.length));

  if (charge && rentPay) {
    const detail = await expectOk('getCharge returns allocations', () => charges.getCharge(actor, charge.id));
    if (detail) {
      check('getCharge balance 12000', detail.balance === '12000.00', detail.balance);
      check('getCharge has 1 allocation', detail.allocations.length === 1, String(detail.allocations.length));
    }
  }

  if (rentPay) {
    const payDetail = await expectOk('getPayment returns allocations', () => payments.getPayment(actor, rentPay.id));
    if (payDetail) {
      check('getPayment allocatedTotal 8000', payDetail.allocatedTotal === '8000.00', payDetail.allocatedTotal);
    }
  }
} finally {
  console.log('— cleanup');
  if (stranger) {
    /* nothing */
  }
  for (const id of cleanupPayments) {
    await prisma.paymentAllocation.deleteMany({ where: { paymentId: id } });
    await prisma.payment.deleteMany({ where: { id } });
  }
  for (const id of cleanupCharges) {
    await prisma.paymentAllocation.deleteMany({ where: { chargeId: id } });
    await prisma.charge.deleteMany({ where: { id } });
  }
  if (tenantId) await prisma.tenant.deleteMany({ where: { id: tenantId } });
  if (unitId) await prisma.unit.deleteMany({ where: { id: unitId } });
  if (pid) {
    await prisma.ledgerAccount.deleteMany({ where: { propertyId: pid } });
    await prisma.property.deleteMany({ where: { id: pid } });
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
