/**
 * Slice 3b smoke — month-by-month tracking, multi-month payments, receipts:
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-monthly.ts
 *
 * Covers: monthly charge generation (rent from ACTIVE leases + utility
 * bills from unit schedules, idempotent), the monthly ledger matrix
 * (billed vs paid, cash basis), multi-month payment allocation
 * (oldest-first, within a transaction), and receipt numbering.
 *
 * Prints one line per case; exits 1 on any failure.
 */

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import * as monthly from '@/lib/domain/monthly';
import * as receipts from '@/lib/domain/receipt';
import * as payments from '@/lib/domain/payment';
import * as charges from '@/lib/domain/charge';
import * as units from '@/lib/domain/unit';
import * as leases from '@/lib/domain/lease';
import * as schedules from '@/lib/domain/charge-schedule';

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
const user = await prisma.user.findFirstOrThrow();
const actor = { userId: user.id, organizationId: org.id };

let pid = '';
let unitId = '';
let tenantId = '';
let leaseId = '';
let scheduleId = '';
const cleanupCharges: string[] = [];
const cleanupPayments: string[] = [];
const cleanupReceipts: string[] = [];

const now = new Date();
const thisMonth = now.toISOString().slice(0, 7);
const prevMonthDate = new Date(now);
prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
const prevMonth = prevMonthDate.toISOString().slice(0, 7);

try {
  console.log('— setup: property + unit + tenant + ACTIVE lease');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Monthly Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 60',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property) throw new Error('setup failed');
  pid = property.id;

  const unit = await expectOk('create unit', () =>
    units.createUnit(actor, pid, { unitRef: 'SMOKE-MON-A', unitType: 'BED_1', defaultRent: 30000 }),
  );
  if (!unit) throw new Error('setup failed');
  unitId = unit.id;

  const tenant = await expectOk('create tenant', () =>
    prisma.tenant.create({
      data: { organizationId: org.id, displayName: 'SMOKE Monthly Tenant', tenantRef: `SMOKE-MON-${Date.now()}` },
    }),
  );
  if (!tenant) throw new Error('setup failed');
  tenantId = tenant.id;

  // lease starts in the past → approveLease makes it ACTIVE
  const lease = await expectOk('create lease (starts past, open-ended)', () =>
    leases.createLease(actor, {
      propertyId: pid,
      leaseRef: `SMOKE-MON-LSE-${Date.now()}`,
      status: 'PENDING_APPROVAL',
      startsAt: '2020-01-01',
      endsAt: null,
      currency: 'KES',
      billingFrequency: 'MONTHLY',
      paymentDueDay: 5,
      units: [{ unitId, monthlyRent: 30000 }],
      parties: [{ tenantId, relationship: 'PRIMARY' }],
    }),
  );
  if (!lease) throw new Error('setup failed');
  leaseId = lease.id;
  const approved = await expectOk('approve lease → ACTIVE', () => leases.approveLease(actor, leaseId));
  check('lease is ACTIVE', approved?.status === 'ACTIVE', approved?.status ?? 'null');

  console.log('— utility schedule (MONTHLY, GARBAGE)');
  const schedule = await expectOk('create unit schedule', () =>
    schedules.createUnitSchedule(actor, unitId, {
      name: 'Waste collection',
      chargeType: 'GARBAGE',
      amount: 1000,
      frequency: 'MONTHLY',
      startDate: '2020-01-01',
    }),
  );
  if (schedule) scheduleId = schedule.id;
  check('schedule active', schedule?.isActive === true);

  console.log(`— generateMonthlyCharges(${prevMonth})`);
  const gen1 = await expectOk('generate prev month', () =>
    monthly.generateMonthlyCharges(actor, { propertyId: pid, month: prevMonth }),
  );
  if (gen1) {
    check('rent created 1', gen1.rentCreated === 1, String(gen1.rentCreated));
    check('utilities created 1', gen1.utilitiesCreated === 1, String(gen1.utilitiesCreated));
    check('month echoed', gen1.month === prevMonth);
  }

  const gen2 = await expectOk('re-run prev month (idempotent)', () =>
    monthly.generateMonthlyCharges(actor, { propertyId: pid, month: prevMonth }),
  );
  if (gen2) {
    check('rent skipped 1', gen2.rentSkipped === 1, String(gen2.rentSkipped));
    check('rent created 0', gen2.rentCreated === 0, String(gen2.rentCreated));
    check('utilities skipped 1', gen2.utilitiesSkipped === 1, String(gen2.utilitiesSkipped));
  }

  const gen3 = await expectOk('generate this month', () =>
    monthly.generateMonthlyCharges(actor, { propertyId: pid, month: thisMonth }),
  );
  if (gen3) {
    check('rent created this month', gen3.rentCreated === 1, String(gen3.rentCreated));
    check('utilities created this month', gen3.utilitiesCreated === 1, String(gen3.utilitiesCreated));
  }

  // 4 charges now: rent+garbage × 2 months
  const chargeList = await expectOk('listCharges after generation', () =>
    charges.listCharges(actor, { propertyId: pid }),
  );
  if (chargeList) {
    check('4 charges total', chargeList.length === 4, String(chargeList.length));
    check(
      'all posted',
      chargeList.every((c) => c.postedAt != null),
    );
    check(
      'rent charges have period start',
      chargeList.filter((c) => c.chargeType === 'RENT').every((c) => c.billingPeriodStart != null),
    );
  }

  console.log('— monthlyLedger (property scope, 2 months)');
  const ledger = await expectOk('monthlyLedger property', () =>
    monthly.monthlyLedger(actor, { propertyId: pid, from: prevMonth, to: thisMonth }),
  );
  if (ledger) {
    check('2 rows', ledger.length === 2, String(ledger.length));
    const prevRow = ledger.find((r) => r.month === prevMonth);
    check('prev rent billed 30000', prevRow?.rent.billed === '30000.00', prevRow?.rent.billed ?? 'missing');
    check('prev rent PENDING', prevRow?.rent.status === 'PENDING', prevRow?.rent.status ?? 'missing');
    check('prev utilities billed 1000', prevRow?.utilities.billed === '1000.00', prevRow?.utilities.billed ?? 'missing');
  }

  console.log('— multi-month rent payment (2 months, full)');
  const pay1 = await expectOk('recordMultiMonthPayment 2 months rent', () =>
    monthly.recordMultiMonthPayment(actor, {
      propertyId: pid,
      unitId,
      tenantId,
      leaseId,
      accountType: 'RENT',
      months: 2,
      fromMonth: prevMonth,
      method: 'MPESA',
      reference: 'SMOKE-MON-1',
    }),
  );
  if (pay1) {
    cleanupPayments.push(pay1.paymentId);
    check('2 months covered', pay1.monthsCovered.length === 2, String(pay1.monthsCovered.length));
    check('covers prev + this', pay1.monthsCovered[0] === prevMonth && pay1.monthsCovered[1] === thisMonth, pay1.monthsCovered.join(','));
    check('total allocated 60000', pay1.totalAllocated === '60000.00', pay1.totalAllocated);
    check('2 charge allocations', pay1.allocatedCharges.length === 2, String(pay1.allocatedCharges.length));
    check(
      'oldest first (prev before this)',
      pay1.allocatedCharges[0]?.month === prevMonth && pay1.allocatedCharges[1]?.month === thisMonth,
    );
  }

  console.log('— ledger after payment (cash basis: paid lands this month)');
  const ledger2 = await expectOk('monthlyLedger after rent payment', () =>
    monthly.monthlyLedger(actor, { propertyId: pid, from: prevMonth, to: thisMonth }),
  );
  if (ledger2) {
    const prevRow = ledger2.find((r) => r.month === prevMonth);
    const thisRow = ledger2.find((r) => r.month === thisMonth);
    // cash basis: both allocations received NOW → both paid this month;
    // prev month charge shows PENDING (billed, paid elsewhere) — actually
    // allocation is attributed to charge's month for billed, and payment
    // month for paid. Check paid totals reflect receipt month.
    check('this rent paid 60000 (cash basis)', thisRow?.rent.paid === '60000.00', thisRow?.rent.paid ?? 'missing');
    check('prev rent still PENDING (paid in this month)', prevRow?.rent.status === 'PENDING', prevRow?.rent.status ?? 'missing');
    check('this rent PAID or PARTIAL', thisRow?.rent.status === 'PARTIAL' || thisRow?.rent.status === 'PAID', thisRow?.rent.status ?? 'missing');
  }

  console.log('— multi-month utilities payment + partial allocation');
  const pay2 = await expectOk('recordMultiMonthPayment utilities, amount 1000 (partial of 2000)', () =>
    monthly.recordMultiMonthPayment(actor, {
      propertyId: pid,
      unitId,
      tenantId,
      accountType: 'UTILITIES',
      months: 2,
      fromMonth: prevMonth,
      amount: 1000,
      method: 'CASH',
    }),
  );
  if (pay2) {
    cleanupPayments.push(pay2.paymentId);
    check('utilities 1 month fully covered by 1000', pay2.monthsCovered.length === 1, String(pay2.monthsCovered.length));
    check('covers prev only', pay2.monthsCovered[0] === prevMonth, pay2.monthsCovered.join(','));
    check('allocated 1000', pay2.totalAllocated === '1000.00', pay2.totalAllocated);
  }

  console.log('— unitChargeSummary');
  const summary = await expectOk('unitChargeSummary for unit', () =>
    monthly.unitChargeSummary(actor, [unitId]),
  );
  if (summary) {
    const s = summary.get(unitId);
    check('summary present', s != null);
    // rent fully paid (60000 allocated of 60000), utilities 1000 of 2000 → pending 1000
    check('utilities pending 1000', Number(s?.pending) === 1000, s?.pending ?? 'missing');
    check('paid 61000', Number(s?.paid) === 61000, s?.paid ?? 'missing');
  }

  console.log('— validation errors');
  await expectStatus('no open charges → 400', 400, () =>
    monthly.recordMultiMonthPayment(actor, {
      propertyId: pid,
      unitId,
      tenantId,
      leaseId,
      accountType: 'RENT',
      months: 1,
      method: 'CASH',
    }),
  );
  await expectStatus('bad month format → 400', 400, () =>
    monthly.generateMonthlyCharges(actor, { propertyId: pid, month: 'not-a-month' }),
  );
  await expectStatus('from > to → 400', 400, () =>
    monthly.monthlyLedger(actor, { propertyId: pid, from: thisMonth, to: prevMonth }),
  );
  await expectStatus('months > 36 → 400', 400, () =>
    monthly.recordMultiMonthPayment(actor, {
      propertyId: pid,
      unitId,
      tenantId,
      accountType: 'UTILITIES',
      months: 99,
      method: 'CASH',
    }),
  );
  await expectStatus('rent without unit/tenant/lease → 400', 400, () =>
    monthly.recordMultiMonthPayment(actor, {
      propertyId: pid,
      accountType: 'RENT',
      months: 1,
      method: 'CASH',
    }),
  );

  console.log('— receipts');
  if (pay1) {
    const receipt = await expectOk('issueReceipt for rent payment', () =>
      receipts.issueReceipt(actor, pay1.paymentId),
    );
    if (receipt) {
      cleanupReceipts.push(receipt.id);
      check('receipt number format RE-YYYY-NNNN', /^RE-\d{4}-\d{4}$/.test(receipt.receiptNumber ?? ''), receipt.receiptNumber ?? 'null');
      check('receipt amount matches payment', receipt.amount === '60000', receipt.amount);
      check('receipt paymentId matches', receipt.paymentId === pay1.paymentId);

      const again = await expectOk('issueReceipt again (idempotent)', () =>
        receipts.issueReceipt(actor, pay1.paymentId),
      );
      check('same receipt returned', again?.id === receipt.id);

      const payDetail = await expectOk('getPayment includes receipts', () =>
        payments.getPayment(actor, pay1.paymentId),
      );
      if (payDetail) {
        check('getPayment has 1 receipt', payDetail.receipts.length === 1, String(payDetail.receipts.length));
      }
    }
  }

  // next-month generation: utilities MONTHLY schedule should produce again
  const nextMonthDate = new Date(now);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonth = nextMonthDate.toISOString().slice(0, 7);
  const genNext = await expectOk('generate next month (fresh period)', () =>
    monthly.generateMonthlyCharges(actor, { propertyId: pid, month: nextMonth }),
  );
  if (genNext) {
    check('next month rent created', genNext.rentCreated === 1, String(genNext.rentCreated));
    check('next month utilities created', genNext.utilitiesCreated === 1, String(genNext.utilitiesCreated));
  }
} finally {
  console.log('— cleanup');
  for (const id of cleanupReceipts) {
    await prisma.receipt.deleteMany({ where: { id } });
  }
  for (const id of cleanupPayments) {
    await prisma.paymentAllocation.deleteMany({ where: { paymentId: id } });
    await prisma.payment.deleteMany({ where: { id } });
  }
  if (leaseId) {
    await prisma.paymentAllocation.deleteMany({ where: { charge: { leaseId } } });
    await prisma.charge.deleteMany({ where: { leaseId } });
  }
  for (const id of cleanupCharges) {
    await prisma.paymentAllocation.deleteMany({ where: { chargeId: id } });
    await prisma.charge.deleteMany({ where: { id } });
  }
  await prisma.charge.deleteMany({ where: { unitId, organizationId: org.id } });
  if (scheduleId) await prisma.chargeSchedule.deleteMany({ where: { id: scheduleId } });
  if (leaseId) {
    await prisma.leaseUnit.deleteMany({ where: { leaseId } });
    await prisma.leaseTenant.deleteMany({ where: { leaseId } });
    await prisma.lease.deleteMany({ where: { id: leaseId } });
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
