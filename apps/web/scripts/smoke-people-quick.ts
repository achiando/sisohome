/**
 * People-plan smoke — Feature A (quick "add tenant to unit") + Feature B
 * (per-unit recurring bills / charge schedules):
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-people-quick.ts
 *
 * Prints one line per case; exits 1 on any failure.
 */

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import * as tenants from '@/lib/domain/tenant';
import * as units from '@/lib/domain/unit';
import * as leases from '@/lib/domain/lease';
import * as bills from '@/lib/domain/charge-schedule';

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
let unitId2 = '';
const cleanupLeases: string[] = [];
const cleanupTenants: string[] = [];
const cleanupBills: string[] = [];

try {
  console.log('— setup: property + vacant unit + tenant');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE People Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 40',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property) throw new Error('setup failed');
  pid = property.id;

  const unit = await expectOk('create vacant unit', () =>
    units.createUnit(actor, pid, {
      unitRef: 'SMOKE-QUICK-A',
      unitType: 'BED_1',
      defaultRent: 25000,
      depositDefault: 2,
    }),
  );
  if (!unit) throw new Error('setup failed');
  unitId = unit.id;

  const unit2 = await expectOk('create second vacant unit', () =>
    units.createUnit(actor, pid, { unitRef: 'SMOKE-QUICK-B', unitType: 'BED_2', defaultRent: 30000 }),
  );
  if (!unit2) throw new Error('setup failed');
  unitId2 = unit2.id;

  const tenant = await expectOk('create existing tenant', () =>
    tenants.createTenant(actor, {
      displayName: 'SMOKE Quick Tenant',
      email: `smoke-quick-${Date.now()}@example.com`,
    }),
  );
  if (!tenant) throw new Error('setup failed');
  cleanupTenants.push(tenant.id);

  console.log('— Feature A: quick tenancy');
  const quick = await expectOk('createQuickTenancy with existing tenant', () =>
    leases.createQuickTenancy(actor, {
      propertyId: pid,
      unitId,
      tenantId: tenant.id,
      startsAt: '2026-01-01',
      monthlyRent: 26000,
      depositMonths: 2,
    }),
  );
  if (quick) {
    cleanupLeases.push(quick.lease.id);
    check('quick lease is PENDING_APPROVAL', quick.lease.status === 'PENDING_APPROVAL', quick.lease.status);
    check('quick lease echoes tenantId', quick.tenantId === tenant.id);
    const stored = await prisma.leaseUnit.findFirst({ where: { leaseId: quick.lease.id, unitId } });
    check('quick lease links the unit', Boolean(stored));
    check(
      'deposit = rent × months on the unit row',
      stored != null && Number(stored.depositAmount) === 52000,
      stored ? String(stored.depositAmount) : 'missing',
    );
    check(
      'monthly rent persisted on the unit row',
      stored != null && Number(stored.monthlyRent) === 26000,
      stored ? String(stored.monthlyRent) : 'missing',
    );
  }

  const fresh = await expectOk('createQuickTenancy with newTenant payload', () =>
    leases.createQuickTenancy(actor, {
      propertyId: pid,
      unitId: unitId2,
      newTenant: { displayName: 'SMOKE Brand New', phone: '+254700000001' },
      startsAt: '2026-02-01',
      monthlyRent: 24000,
    }),
  );
  if (fresh) {
    cleanupLeases.push(fresh.lease.id);
    cleanupTenants.push(fresh.tenantId);
    const created = await prisma.tenant.findUnique({ where: { id: fresh.tenantId } });
    check('newTenant created a tenant record', created?.displayName === 'SMOKE Brand New');
    check('new-tenant quick lease pending', fresh.lease.status === 'PENDING_APPROVAL');
  }

  await expectStatus('quick: unknown unit → 404', 404, () =>
    leases.createQuickTenancy(actor, {
      propertyId: pid,
      unitId: '00000000-0000-0000-0000-000000000000',
      tenantId: tenant.id,
      startsAt: '2026-01-01',
      monthlyRent: 1000,
    }),
  );
  await expectStatus('quick: missing startsAt → 400', 400, () =>
    leases.createQuickTenancy(actor, {
      propertyId: pid,
      unitId,
      tenantId: tenant.id,
      monthlyRent: 1000,
    }),
  );
  await expectStatus('quick: neither tenantId nor newTenant → 400', 400, () =>
    leases.createQuickTenancy(actor, {
      propertyId: pid,
      unitId,
      startsAt: '2026-03-01',
      monthlyRent: 1000,
    }),
  );
  if (stranger) {
    await expectStatus('quick: stranger org → 404', 404, () =>
      leases.createQuickTenancy(stranger, {
        propertyId: pid,
        unitId,
        tenantId: tenant.id,
        startsAt: '2026-01-01',
        monthlyRent: 1000,
      }),
    );
  }

  console.log('— Feature B: unit charge schedules (recurring bills)');
  const bill = await expectOk('create waste bill on unit', () =>
    bills.createUnitSchedule(actor, unitId, {
      name: 'Waste collection',
      chargeType: 'GARBAGE',
      amount: 500,
      frequency: 'MONTHLY',
      startDate: '2026-01-01',
    }),
  );
  if (bill) {
    cleanupBills.push(bill.id);
    check('bill name persisted', bill.name === 'Waste collection');
    check('bill type GARBAGE', bill.chargeType === 'GARBAGE');
    check('bill frequency MONTHLY', bill.frequency === 'MONTHLY');
    check('bill amount stringified', bill.amount === '500', bill.amount);
    check('bill active by default', bill.isActive === true);
  }

  await expectStatus('bills: RENT rejected (400)', 400, () =>
    bills.createUnitSchedule(actor, unitId, {
      name: 'Rent',
      chargeType: 'RENT',
      amount: 1000,
      startDate: '2026-01-01',
    }),
  );
  await expectStatus('bills: bad frequency → 400', 400, () =>
    bills.createUnitSchedule(actor, unitId, {
      name: 'Odd cycle',
      chargeType: 'WATER',
      amount: 100,
      frequency: 'FORTNIGHTLY',
      startDate: '2026-01-01',
    }),
  );

  const listed = await expectOk('listUnitSchedules returns the bill', () =>
    bills.listUnitSchedules(actor, unitId),
  );
  if (listed && bill) {
    check('list contains created bill', listed.some((b) => b.id === bill.id));
  }

  if (bill) {
    const updated = await expectOk('updateSchedule amount + deactivate', () =>
      bills.updateSchedule(actor, bill.id, { amount: 750, isActive: false }),
    );
    if (updated) {
      check('updated amount', updated.amount === '750', updated.amount);
      check('updated isActive=false', updated.isActive === false);
    }
  }

  if (stranger) {
    await expectStatus('bills: stranger org list → 404', 404, () => bills.listUnitSchedules(stranger, unitId));
    if (bill) {
      await expectStatus('bills: stranger org update → 404', 404, () =>
        bills.updateSchedule(stranger, bill.id, { amount: 1 }),
      );
    }
  }
} finally {
  console.log('— cleanup');
  for (const id of cleanupBills) {
    await prisma.chargeSchedule.deleteMany({ where: { id } });
  }
  for (const id of cleanupLeases) {
    await prisma.chargeSchedule.deleteMany({ where: { leaseId: id } });
    await prisma.leaseUnit.deleteMany({ where: { leaseId: id } });
    await prisma.leaseTenant.deleteMany({ where: { leaseId: id } });
    await prisma.lease.deleteMany({ where: { id } });
  }
  for (const id of cleanupTenants) {
    await prisma.tenant.deleteMany({ where: { id } });
  }
  if (unitId) await prisma.unit.deleteMany({ where: { id: unitId } });
  if (unitId2) await prisma.unit.deleteMany({ where: { id: unitId2 } });
  if (pid) await prisma.property.deleteMany({ where: { id: pid } });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
