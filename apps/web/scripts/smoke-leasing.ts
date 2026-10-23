/**
 * Slice 2 service smoke — leasing domain (tenants, applications, leases):
 * scope enforcement, portal invite hashing, application decision single-use,
 * lease overlap in serializable transactions, unit occupancy recompute,
 * renewal chains, transition guards (plan-slice-2 §2).
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-leasing.ts
 *
 * Prints one line per case; exits 1 on any failure.
 */

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import * as tenants from '@/lib/domain/tenant';
import * as applications from '@/lib/domain/application';
import * as leases from '@/lib/domain/lease';
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
let unitId2 = '';
let otherPid = '';
let otherUnitId = '';
let tenantA = '';
let tenantB = '';
let applicationId = '';
let leaseId = '';

try {
  console.log('— setup: property, units, tenants');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Leasing Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 22',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property) throw new Error('setup failed');
  pid = property.id;

  const unitA = await expectOk('create unit A', () =>
    units.createUnit(actor, pid, { unitRef: 'SMOKE-LEASE-A', unitType: 'BED_1' }),
  );
  if (!unitA) throw new Error('setup failed');
  unitId = unitA.id;

  const unitB = await expectOk('create unit B', () =>
    units.createUnit(actor, pid, { unitRef: 'SMOKE-LEASE-B', unitType: 'BED_2' }),
  );
  if (!unitB) throw new Error('setup failed');
  unitId2 = unitB.id;

  const tA = await expectOk('create tenant A', () =>
    tenants.createTenant(actor, { displayName: 'Smoke Tenant A', email: `smoke-a-${Date.now()}@example.com` }),
  );
  if (!tA) throw new Error('setup failed');
  tenantA = tA.id;

  const tB = await expectOk('create tenant B', () =>
    tenants.createTenant(actor, { displayName: 'Smoke Tenant B', email: `smoke-b-${Date.now()}@example.com` }),
  );
  if (!tB) throw new Error('setup failed');
  tenantB = tB.id;

  console.log('— tenants: scope, invite, delete guard');
  if (stranger) {
    await expectStatus('stranger getTenant → 404', 404, () => tenants.getTenant(stranger, tenantA));
  }
  const invite = await expectOk('invite tenant A to portal', () =>
    tenants.inviteTenantToPortal(actor, tenantA),
  );
  check('invite returns a portal URL', Boolean(invite && (invite as { inviteUrl?: string }).inviteUrl));
  const inviteRow = await prisma.tenantPortalInvite.findFirst({
    where: { tenantId: tenantA, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  check('invite token stored hashed (not plaintext)', Boolean(inviteRow && inviteRow.tokenHash.length >= 32));
  const inviteUrl = (invite as { inviteUrl?: string }).inviteUrl ?? '';
  check('invite URL carries a token', inviteUrl.includes('token='));
  const secondInvite = await expectOk('second invite allowed (invalidates prior)', () =>
    tenants.inviteTenantToPortal(actor, tenantA),
  );
  check('second invite returns a new URL', Boolean(secondInvite && (secondInvite as { inviteUrl?: string }).inviteUrl));
  const outstanding = await prisma.tenantPortalInvite.count({ where: { tenantId: tenantA, usedAt: null } });
  check('only one outstanding invite', outstanding === 1, `count=${outstanding}`);

  console.log('— applications: create, screening, decision');
  const app = await expectOk('create application (tenant A → unit A)', () =>
    applications.createApplication(actor, { propertyId: pid, applicantTenantId: tenantA, unitId }),
  );
  if (!app) throw new Error('setup failed');
  applicationId = app.id;
  check('application starts SUBMITTED', app.status === 'SUBMITTED');
  const tAAfter = await prisma.tenant.findUnique({ where: { id: tenantA } });
  check('applicant moved PROSPECT → APPLICANT', tAAfter?.status === 'APPLICANT');

  await expectStatus('unitId from another property → 400', 400, () =>
    applications.createApplication(actor, {
      propertyId: pid,
      applicantTenantId: tenantB,
      unitId: '00000000-0000-4000-8000-000000000000',
    }),
  );
  if (stranger) {
    await expectStatus('stranger createApplication → 404 (property not in scope)', 404, () =>
      applications.createApplication(stranger, { propertyId: pid, applicantTenantId: tenantB }),
    );
  }

  const screened = await expectOk('mark income verified + SCREENING', () =>
    applications.updateApplication(actor, applicationId, { incomeVerified: true, status: 'SCREENING' }),
  );
  check('screening applied', screened?.status === 'SCREENING' && screened?.incomeVerified === true);

  const decision = await expectOk('approve application', () =>
    applications.decideApplication(actor, applicationId, { decision: 'APPROVED' }),
  );
  check('application APPROVED with decidedAt', decision?.status === 'APPROVED' && Boolean(decision?.decidedAt));
  const tAActive = await prisma.tenant.findUnique({ where: { id: tenantA } });
  check('approve flipped tenant to ACTIVE', tAActive?.status === 'ACTIVE');
  await expectStatus('second decision → 409 (single use)', 409, () =>
    applications.decideApplication(actor, applicationId, { decision: 'REJECTED' }),
  );
  await expectStatus('post-decision update → 409', 409, () =>
    applications.updateApplication(actor, applicationId, { incomeVerified: false }),
  );

  // Tenant B gets a rejected application (for the reject path).
  const appB = await expectOk('create application B', () =>
    applications.createApplication(actor, { propertyId: pid, applicantTenantId: tenantB, unitId: unitId2 }),
  );
  if (appB) {
    const rejected = await expectOk('reject application B', () =>
      applications.decideApplication(actor, appB.id, { decision: 'REJECTED' }),
    );
    check('application B DENIED', rejected?.status === 'DENIED');
  }

  console.log('— leases: draft create, overlap, lifecycle');
  const draft = await expectOk('create pending lease (A, unit A, 2027-01-01 → 2027-12-31)', () =>
    leases.createLease(actor, {
      propertyId: pid,
      leaseRef: `SMOKE-LSE-${Date.now()}`,
      status: 'PENDING_APPROVAL',
      startsAt: '2027-01-01',
      endsAt: '2027-12-31',
      currency: 'KES',
      billingFrequency: 'MONTHLY',
      paymentDueDay: 5,
      depositMonths: 2,
      units: [{ unitId, monthlyRent: 45000 }],
      parties: [{ tenantId: tenantA, relationship: 'PRIMARY' }],
    }),
  );
  if (!draft) throw new Error('setup failed');
  leaseId = draft.id;
  check('lease starts PENDING_APPROVAL', draft.status === 'PENDING_APPROVAL');
  check('lease has one unit row', draft.units.length === 1);
  check('lease has one party row', draft.parties.length === 1);

  await expectStatus('no PRIMARY party → 400', 400, () =>
    leases.createLease(actor, {
      propertyId: pid,
      startsAt: '2028-01-01',
      endsAt: '2028-06-30',
      units: [{ unitId: unitId2, monthlyRent: 50000 }],
      parties: [{ tenantId: tenantB, relationship: 'JOINT' }],
    }),
  );
  // Cross-property: create a real unit on a throwaway property, then try to
  // put it on a lease for `pid` → 400 (unit must belong to the lease property).
  const otherProperty = await prisma.property.create({
    data: {
      portfolioOrganizationId: org.id,
      name: 'SMOKE Other Property',
      category: 'RESIDENTIAL',
      propertyType: 'APARTMENT',
      addressLine1: 'Other Street 1',
      locality: 'Smokeville',
      country: 'KE',
    },
  });
  otherPid = otherProperty.id;
  const otherUnit = await units.createUnit(actor, otherProperty.id, { unitRef: 'SMOKE-OTHER-1', unitType: 'BED_1' });
  otherUnitId = otherUnit.id;
  await expectStatus('cross-property unit → 400', 400, () =>
    leases.createLease(actor, {
      propertyId: pid,
      startsAt: '2028-01-01',
      endsAt: '2028-06-30',
      units: [{ unitId: otherUnit.id, monthlyRent: 1000 }],
      parties: [{ tenantId: tenantA, relationship: 'PRIMARY' }],
    }),
  );
  await expectStatus('endsAt before startsAt → 400', 400, () =>
    leases.createLease(actor, {
      propertyId: pid,
      startsAt: '2028-05-01',
      endsAt: '2028-01-01',
      units: [{ unitId: unitId2, monthlyRent: 50000 }],
      parties: [{ tenantId: tenantB, relationship: 'PRIMARY' }],
    }),
  );
  if (stranger) {
    await expectStatus('stranger createLease → 404 (property not in scope)', 404, () =>
      leases.createLease(stranger, {
        propertyId: pid,
        startsAt: '2027-01-01',
        endsAt: '2027-12-31',
        units: [{ unitId, monthlyRent: 1 }],
        parties: [{ tenantId: tenantA, relationship: 'PRIMARY' }],
      }),
    );
    await expectStatus('stranger getLease → 404', 404, () => leases.getLease(stranger, leaseId));
  }

  // DRAFT does not occupy — an overlapping DRAFT can exist.
  const overlappingDraft = await expectOk('overlapping DRAFT on unit A allowed (not occupying yet)', () =>
    leases.createLease(actor, {
      propertyId: pid,
      startsAt: '2027-06-01',
      endsAt: '2027-08-31',
      units: [{ unitId, monthlyRent: 46000 }],
      parties: [{ tenantId: tenantB, relationship: 'PRIMARY' }],
    }),
  );
  check('overlapping draft created', Boolean(overlappingDraft));

  // Approve lease A → SCHEDULED (start in future) + unit A OCCUPIED.
  const approved = await expectOk('approve lease A (future start → SCHEDULED)', () =>
    leases.approveLease(actor, leaseId, { signedAt: '2026-12-01' }),
  );
  check('lease A SCHEDULED', approved?.status === 'SCHEDULED');
  check('signedAt recorded', Boolean(approved?.signedAt));
  // Occupancy cache is date-aware: a future-dated lease does not occupy TODAY.
  const unitARow = await prisma.unit.findUnique({ where: { id: unitId } });
  check('unit A stays VACANT (lease starts in the future)', unitARow?.status === 'VACANT', `status=${unitARow?.status}`);

  if (overlappingDraft) {
    await expectStatus('overlapping ACTIVE-range create → 409 (unit A occupied)', 409, () =>
      leases.createLease(actor, {
        propertyId: pid,
        startsAt: '2027-03-01',
        endsAt: '2027-09-30',
        units: [{ unitId, monthlyRent: 47000 }],
        parties: [{ tenantId: tenantB, relationship: 'PRIMARY' }],
      }),
    );
    await expectOk('cancel overlapping draft', () => leases.cancelLease(actor, overlappingDraft.id));
  }

  await expectStatus('illegal transition (SCHEDULED → DRAFT via PATCH) → 409', 409, () =>
    leases.updateLease(actor, leaseId, { status: 'DRAFT' }),
  );
  await expectStatus('approve a SCHEDULED lease again → 409', 409, () => leases.approveLease(actor, leaseId));
  await expectStatus('cancel an approved lease → 409 (only draft/pending)', 409, () =>
    leases.cancelLease(actor, leaseId),
  );

  const amended = await expectOk('amend rent + payment day', () =>
    leases.updateLease(actor, leaseId, {
      paymentDueDay: 7,
      units: [{ unitId, monthlyRent: 48000 }],
      parties: [{ tenantId: tenantA, relationship: 'PRIMARY' }],
    }),
  );
  check(
    'amendment applied',
    amended?.paymentDueDay === 7 && Number(amended?.units[0]?.monthlyRent) === 48000,
    `dueDay=${amended?.paymentDueDay} rent=${amended?.units[0]?.monthlyRent}`,
  );

  // Lease B on unit B → ACTIVE (start in past) + unit B OCCUPIED, then terminate.
  const leaseB = await expectOk('create + approve lease B (past start → ACTIVE)', async () => {
    const created = await leases.createLease(actor, {
      propertyId: pid,
      leaseRef: `SMOKE-LSEB-${Date.now()}`,
      status: 'PENDING_APPROVAL',
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
      units: [{ unitId: unitId2, monthlyRent: 60000 }],
      parties: [{ tenantId: tenantB, relationship: 'PRIMARY' }],
    });
    return leases.approveLease(actor, created.id);
  });
  if (leaseB) {
    check('lease B ACTIVE', leaseB.status === 'ACTIVE');
    const unitBRow = await prisma.unit.findUnique({ where: { id: unitId2 } });
    check('unit B cache flipped to OCCUPIED', unitBRow?.status === 'OCCUPIED');

    // Unit detail read + ?unitId register filter (unit detail page).
    const unitBDetail = await expectOk('getUnit returns active occupant', () =>
      units.getUnit(actor, unitId2),
    );
    check(
      'occupant = tenant B on ACTIVE lease',
      unitBDetail?.occupant?.tenantId === tenantB,
      `occupant=${unitBDetail?.occupant?.tenantId}`,
    );
    const byUnit = await expectOk('listLeases filtered by unitId', () =>
      leases.listLeases(actor, { unitId: unitId2 }),
    );
    check(
      'unitId filter returns only lease B',
      byUnit != null && byUnit.length === 1 && byUnit[0]?.id === leaseB.id,
      `count=${byUnit?.length}`,
    );
    if (stranger) {
      await expectStatus('listLeases unitId out of scope → 404', 404, () =>
        leases.listLeases(stranger, { unitId: unitId2 }),
      );
    }
    await expectStatus('listLeases unitId malformed → 400', 400, () =>
      leases.listLeases(actor, { unitId: 'not-a-uuid' }),
    );

    const terminated = await expectOk('terminate lease B', () => leases.terminateLease(actor, leaseB.id));
    check('lease B TERMINATED', terminated?.status === 'TERMINATED');
    const unitBAfter = await prisma.unit.findUnique({ where: { id: unitId2 } });
    check('unit B cache back to VACANT', unitBAfter?.status === 'VACANT');

    await expectOk('close a TERMINATED lease', () => leases.closeLease(actor, leaseB.id));
    const closed = await prisma.lease.findUnique({ where: { id: leaseB.id } });
    check('lease B CLOSED', closed?.status === 'CLOSED');
    await expectStatus('renew a CLOSED lease → 409 (terminal)', 409, () =>
      leases.renewLease(actor, leaseB.id, { startsAt: '2027-01-01', endsAt: '2027-12-31' }),
    );
  }

  console.log('— renewal chain');
  const renewal = await expectOk('renew lease A (SCHEDULED → old ENDING, new PENDING_APPROVAL)', () =>
    leases.renewLease(actor, leaseId, { startsAt: '2028-01-01', endsAt: '2028-12-31' }),
  );
  if (renewal) {
    check('renewal links renewalOfId', renewal.renewalOfId === leaseId);
    check('renewal copies unit rows', renewal.units.length === 1 && renewal.units[0]?.unitId === unitId);
    check('renewal copies party rows', renewal.parties.length === 1 && renewal.parties[0]?.tenantId === tenantA);
    const oldLease = await prisma.lease.findUnique({ where: { id: leaseId } });
    check('old lease moved to ENDING', oldLease?.status === 'ENDING');
    // The renewal is PENDING (does not occupy the range yet) — approve it so
    // the overlap guard covers the 2028 window, then a third lease must 409.
    const renewalApproved = await expectOk('approve renewal (2028 → SCHEDULED)', () =>
      leases.approveLease(actor, renewal.id),
    );
    check('renewal SCHEDULED', renewalApproved?.status === 'SCHEDULED');
    await expectStatus('third lease overlapping renewal window → 409', 409, () =>
      leases.createLease(actor, {
        propertyId: pid,
        startsAt: '2028-06-01',
        endsAt: '2028-09-30',
        units: [{ unitId, monthlyRent: 49000 }],
        parties: [{ tenantId: tenantB, relationship: 'PRIMARY' }],
      }),
    );
  }

  console.log('— property-scoped tenant directory (?propertyId)');
  const tenantC = await expectOk('create tenant C (no lease at this property)', () =>
    tenants.createTenant(actor, {
      displayName: 'Smoke Tenant C',
      email: `smoke-c-${Date.now()}@example.com`,
    }),
  );
  if (tenantC) {
    const scoped = await tenants.listTenants(actor, { propertyId: pid });
    const scopedIds = scoped.map((t) => t.id);
    check(
      'property filter includes a tenant on a lease at that property',
      scopedIds.includes(tenantA),
      `returned=${scopedIds.length}`,
    );
    check('property filter excludes a leaseless tenant', !scopedIds.includes(tenantC.id));
    const linked = await prisma.leaseTenant.findMany({
      where: { lease: { propertyId: pid } },
      select: { tenantId: true },
      distinct: ['tenantId'],
    });
    check(
      'property filter returns exactly the lease-linked tenants',
      linked.length === scopedIds.length && linked.every((r) => scopedIds.includes(r.tenantId)),
      `expected=${linked.length} got=${scopedIds.length}`,
    );
    const elsewhere = await tenants.listTenants(actor, { propertyId: otherPid });
    check(
      'property filter scoped to a property with no leases → empty',
      elsewhere.length === 0,
      `returned=${elsewhere.length}`,
    );
    if (stranger) {
      await expectStatus('stranger listTenants?propertyId → 404 (property not in scope)', 404, () =>
        tenants.listTenants(stranger, { propertyId: pid }),
      );
    }
    await prisma.tenant.delete({ where: { id: tenantC.id } }).catch(() => {});
  }

  console.log('— delete guards');
  await expectStatus('tenant on a lease cannot be deleted → 409', 409, () => tenants.removeTenant(actor, tenantA));
  await expectStatus('tenant on an application cannot be deleted → 409', 409, () => tenants.removeTenant(actor, tenantB));

  const auditCount = await prisma.auditLog.count({
    where: {
      organizationId: org.id,
      resourceType: { in: ['TENANT', 'APPLICATION', 'LEASE'] },
    },
  });
  check('audit rows recorded for the slice', auditCount >= 8, `count=${auditCount}`);
} finally {
  console.log('— cleanup');
  await prisma.auditLog
    .deleteMany({
      where: {
        organizationId: org.id,
        resourceType: { in: ['TENANT', 'APPLICATION', 'LEASE'] },
      },
    })
    .catch(() => {});
  await prisma.rentalApplication.deleteMany({ where: { propertyId: pid } }).catch(() => {});
  await prisma.lease.deleteMany({ where: { propertyId: pid } }).catch(() => {});
  await prisma.tenantPortalInvite
    .deleteMany({ where: { tenantId: { in: [tenantA, tenantB].filter(Boolean) } } })
    .catch(() => {});
  await prisma.tenant
    .deleteMany({ where: { id: { in: [tenantA, tenantB].filter(Boolean) } } })
    .catch(() => {});
  if (unitId) await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
  if (unitId2) await prisma.unit.delete({ where: { id: unitId2 } }).catch(() => {});
  if (otherUnitId) await prisma.unit.delete({ where: { id: otherUnitId } }).catch(() => {});
  if (pid) await prisma.property.delete({ where: { id: pid } }).catch(() => {});
  if (otherPid) await prisma.property.delete({ where: { id: otherPid } }).catch(() => {});
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}
