/**
 * Phase 3 service smoke — landlord-attention calendar (plan-roadmap §Phase 3):
 * mixed events across all six kinds, date-range filtering, per-class list-key
 * gating, and MM/stranger scoping.
 *
 *   cd apps/web && npx tsx scripts/smoke-calendar.ts
 *
 * Prints one line per case; throws (exit 1) on any failure.
 */

import { prisma, authorizationService } from '@/lib/auth';
import { seedOrgKindRoles } from '@workspace/database';
import { ensureOtherOrg } from './lib/ensure-other-org';
import { RouteError } from '@/lib/api-route';
import * as calendar from '@/lib/domain/calendar';

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function check(label: string, cond: boolean) {
  if (cond) {
    ok(label);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
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

function must<T>(v: T | null, what: string): T {
  if (v === null) throw new Error(`setup failed: ${what}`);
  return v;
}

const DAY = 86_400_000;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// ── actors ───────────────────────────────────────────────────────────────────
const org = await prisma.organization.findFirstOrThrow();
const otherOrg = await ensureOtherOrg(org.id);
const user = await prisma.user.findFirstOrThrow();
const actor = { userId: user.id, organizationId: org.id };

/** Idempotent (member, role) attach: template roles + owner assignment. */
async function attachOwnerRole(organizationId: string, userId: string, kind: 'LANDLORD' | 'MAINTENANCE_COMPANY') {
  await seedOrgKindRoles(prisma as never, organizationId, kind);
  const role = await prisma.role.findFirstOrThrow({ where: { organizationId, slug: 'owner' } });
  const member = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: {},
    create: { organizationId, userId, status: 'ACTIVE' },
  });
  await prisma.organizationMemberRole.createMany({
    data: [{ organizationMemberId: member.id, roleId: role.id }],
    skipDuplicates: true,
  });
}

// Stranger (main user × persistent cross-org fixture) — full owner perms so a
// clean result proves SCOPING, not missing permissions.
await attachOwnerRole(otherOrg.id, user.id, 'LANDLORD');
const strangerActor = { userId: user.id, organizationId: otherOrg.id };

// MM org with an ACTIVE agreement on the test property (propertyScopeWhere arm 2).
const mmUser = await prisma.user.create({
  data: { email: `smoke-cal-mm-${Date.now()}@smoke.test`, displayName: 'SMOKE Cal MM' },
});
const mmOrg = await prisma.organization.create({
  data: {
    name: 'SMOKE Cal MM Co',
    slug: `smoke-cal-mm-${Date.now()}`,
    kind: 'MAINTENANCE_COMPANY',
    status: 'ACTIVE',
  },
});
await attachOwnerRole(mmOrg.id, mmUser.id, 'MAINTENANCE_COMPANY');
const mmActor = { userId: mmUser.id, organizationId: mmOrg.id };

// Bystander MM org — full perms, zero scope: must see nothing.
const bystanderOrg = await prisma.organization.create({
  data: {
    name: 'SMOKE Cal Bystander Co',
    slug: `smoke-cal-bystander-${Date.now()}`,
    kind: 'MAINTENANCE_COMPANY',
    status: 'ACTIVE',
  },
});
await attachOwnerRole(bystanderOrg.id, mmUser.id, 'MAINTENANCE_COMPANY');
const bystanderActor = { userId: mmUser.id, organizationId: bystanderOrg.id };

// Limited role in the main org: lease/WO/schedule + unit keys, NO
// viewing.list / inspection.list — proves per-class permission gating.
const limitedUser = await prisma.user.create({
  data: { email: `smoke-cal-limited-${Date.now()}@smoke.test`, displayName: 'SMOKE Cal Limited' },
});
await prisma.organizationMember.create({
  data: { organizationId: org.id, userId: limitedUser.id, status: 'ACTIVE' },
});
const limitedRole = await prisma.role.create({
  data: {
    organizationId: org.id,
    name: 'SMOKE Cal Limited',
    slug: `smoke-cal-limited-${Date.now()}`,
  },
});
const limitedKeys = [
  'property.read',
  'property.list',
  'unit.read',
  'unit.list',
  'lease.list',
  'work_order.list',
  'schedule.list',
];
const limitedPerms = await prisma.permission.findMany({ where: { key: { in: limitedKeys } } });
await prisma.rolePermission.createMany({
  data: limitedPerms.map((p) => ({ roleId: limitedRole.id, permissionId: p.id })),
  skipDuplicates: true,
});
const limitedMember = await prisma.organizationMember.findUniqueOrThrow({
  where: { organizationId_userId: { organizationId: org.id, userId: limitedUser.id } },
});
await prisma.organizationMemberRole.createMany({
  data: [{ organizationMemberId: limitedMember.id, roleId: limitedRole.id }],
  skipDuplicates: true,
});
const limitedActor = { userId: limitedUser.id, organizationId: org.id };

// ── fixtures (both cleaned up in finally) ────────────────────────────────────
let pid = '';
let pid2 = '';
let ownerPartyId = '';
let agreementId = '';
let viewingId = '';
let farViewingId = '';
let p2ViewingId = '';
let leaseId = '';
let woId = '';
let farWoId = '';
let inspId = '';
let schedId = '';

try {
  console.log('— setup: properties, units, mixed fixtures');
  const property = must(
    await expectOk('create property P1', () =>
      prisma.property.create({
        data: {
          portfolioOrganizationId: org.id,
          name: 'SMOKE Cal Property',
          category: 'RESIDENTIAL',
          propertyType: 'APARTMENT',
          addressLine1: 'Smoke Cal Street 1',
          locality: 'Smokeville',
          country: 'KE',
        },
      }),
    ),
    'property',
  );
  pid = property.id;

  const property2 = must(
    await expectOk('create property P2 (out of MM scope)', () =>
      prisma.property.create({
        data: {
          portfolioOrganizationId: org.id,
          name: 'SMOKE Cal Other Property',
          category: 'RESIDENTIAL',
          propertyType: 'APARTMENT',
          addressLine1: 'Smoke Cal Street 2',
          locality: 'Smokeville',
          country: 'KE',
        },
      }),
    ),
    'property2',
  );
  pid2 = property2.id;

  const u1 = must(
    await expectOk('create vacant unit U1', () =>
      prisma.unit.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          unitRef: 'SMOKE-CAL-U1',
          label: 'CAL-1',
          unitType: 'BED_1',
        },
      }),
    ),
    'u1',
  );
  const u2 = must(
    await expectOk('create occupied unit U2 (leased)', () =>
      prisma.unit.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          unitRef: 'SMOKE-CAL-U2',
          label: 'CAL-2',
          unitType: 'BED_1',
          status: 'OCCUPIED',
        },
      }),
    ),
    'u2',
  );
  const u3 = must(
    await expectOk('create vacant unit U3 on P2', () =>
      prisma.unit.create({
        data: {
          organizationId: org.id,
          propertyId: pid2,
          unitRef: 'SMOKE-CAL-U3',
          label: 'CAL-3',
          unitType: 'BED_1',
        },
      }),
    ),
    'u3',
  );

  const v1At = new Date(now + 2 * DAY);
  const viewing = must(
    await expectOk('create in-range viewing on P1', () =>
      prisma.propertyViewing.create({
        data: { organizationId: org.id, propertyId: pid, scheduledAt: v1At, status: 'SCHEDULED' },
      }),
    ),
    'viewing',
  );
  viewingId = viewing.id;

  const farViewing = must(
    await expectOk('create far-future viewing', () =>
      prisma.propertyViewing.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          scheduledAt: new Date(now + 200 * DAY),
          status: 'SCHEDULED',
        },
      }),
    ),
    'farViewing',
  );
  farViewingId = farViewing.id;

  const p2Viewing = must(
    await expectOk('create in-range viewing on P2', () =>
      prisma.propertyViewing.create({
        data: {
          organizationId: org.id,
          propertyId: pid2,
          scheduledAt: new Date(now + 3 * DAY),
          status: 'SCHEDULED',
        },
      }),
    ),
    'p2Viewing',
  );
  p2ViewingId = p2Viewing.id;

  const lease = must(
    await expectOk('create ACTIVE lease ending in range', () =>
      prisma.lease.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          status: 'ACTIVE',
          startsAt: new Date(now - 60 * DAY),
          endsAt: new Date(now + 10 * DAY),
          paymentDueDay: 1,
        },
      }),
    ),
    'lease',
  );
  leaseId = lease.id;
  await expectOk('link lease unit U2', () =>
    prisma.leaseUnit.create({
      data: { organizationId: org.id, leaseId: lease.id, unitId: u2.id, monthlyRent: 50000 },
    }),
  );

  const wo = must(
    await expectOk('create scheduled work order', () =>
      prisma.workOrder.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          title: 'SMOKE CAL leaking pipe',
          status: 'SCHEDULED',
          scheduledFor: new Date(now + 4 * DAY),
        },
      }),
    ),
    'wo',
  );
  woId = wo.id;

  const farWo = must(
    await expectOk('create far-future work order', () =>
      prisma.workOrder.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          title: 'SMOKE CAL far job',
          status: 'SCHEDULED',
          scheduledFor: new Date(now + 200 * DAY),
        },
      }),
    ),
    'farWo',
  );
  farWoId = farWo.id;

  const insp = must(
    await expectOk('create scheduled inspection', () =>
      prisma.inspection.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          inspectorUserId: user.id,
          kind: 'ROUTINE',
          status: 'SCHEDULED',
          scheduledFor: new Date(now + 5 * DAY),
        },
      }),
    ),
    'insp',
  );
  inspId = insp.id;

  const sched = must(
    await expectOk('create recurring schedule due in range', () =>
      prisma.recurringSchedule.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          title: 'SMOKE CAL gutter check',
          frequency: 'MONTHLY',
          startDate: new Date(now - 30 * DAY),
          nextDueAt: new Date(now + 6 * DAY),
          isActive: true,
        },
      }),
    ),
    'sched',
  );
  schedId = sched.id;

  const ownerParty = must(
    await expectOk('create owner party for agreement', () =>
      prisma.propertyOwnerParty.create({
        data: { organizationId: org.id, partyType: 'PERSON', name: 'SMOKE Cal Owner' },
      }),
    ),
    'ownerParty',
  );
  ownerPartyId = ownerParty.id;
  const agreement = must(
    await expectOk('create ACTIVE MM agreement on P1', () =>
      prisma.propertyManagementAgreement.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          managementOrganizationId: mmOrg.id,
          ownerPartyId: ownerParty.id,
          status: 'ACTIVE',
          startsAt: new Date(now - 30 * DAY),
        },
      }),
    ),
    'agreement',
  );
  agreementId = agreement.id;

  // ── mixed events render ────────────────────────────────────────────────────
  console.log('— mixed events (landlord session)');
  const landlordPerms = await authorizationService.getUserPermissions(user.id, org.id);
  check('landlord session holds lease.list (seeded roles)', landlordPerms.includes('lease.list' as never));

  const from = iso(now - 3 * DAY);
  const to = iso(now + 15 * DAY);
  const cal = must(
    await expectOk('calendar: current range', () => calendar.getCalendarEvents(actor, { from, to })),
    'cal',
  );
  const find = (kind: calendar.CalendarEventKind, id: string) =>
    cal.events.find((e) => e.kind === kind && e.id === id);

  check('viewing event present', Boolean(find('VIEWING', viewingId)));
  check('lease-end event present', Boolean(find('LEASE_END', leaseId)));
  check('work-order event present', Boolean(find('WORK_ORDER', woId)));
  check('inspection event present', Boolean(find('INSPECTION', inspId)));
  check('recurring event present', Boolean(find('RECURRING', schedId)));
  check('vacant marker present (today)', Boolean(find('VACANT_UNIT', u1.id)));
  check('vacant panel lists U1', cal.vacantUnits.some((u) => u.id === u1.id));
  check('vacant panel lists P2 unit U3 (landlord scope)', cal.vacantUnits.some((u) => u.id === u3.id));
  check(
    'events sorted by date',
    cal.events.every((e, i, a) => i === 0 || a[i - 1]!.date <= e.date),
  );
  const v1Event = find('VIEWING', viewingId);
  check('viewing date = UTC day of stored instant', v1Event?.date === v1At.toISOString().slice(0, 10));
  check('viewing href click-through', v1Event?.href === `/sales/viewings/${viewingId}/edit`);
  const leaseEvent = find('LEASE_END', leaseId);
  check('lease-end title carries unit ref', (leaseEvent?.title ?? '').includes('SMOKE-CAL-U2'));
  check('lease-end href click-through', leaseEvent?.href === `/leasing/leases/${leaseId}`);

  // ── date-range filter ──────────────────────────────────────────────────────
  console.log('— date-range filter');
  check('far viewing outside current range', !find('VIEWING', farViewingId));
  check('far work order outside current range', !find('WORK_ORDER', farWoId));

  const fromFar = iso(now + 195 * DAY);
  const toFar = iso(now + 205 * DAY);
  const calFar = must(
    await expectOk('calendar: far range', () => calendar.getCalendarEvents(actor, { from: fromFar, to: toFar })),
    'calFar',
  );
  check('far viewing inside far range', calFar.events.some((e) => e.kind === 'VIEWING' && e.id === farViewingId));
  check('far work order inside far range', calFar.events.some((e) => e.kind === 'WORK_ORDER' && e.id === farWoId));
  check('near lease-end absent in far range', !calFar.events.some((e) => e.kind === 'LEASE_END' && e.id === leaseId));

  const fromTomorrow = iso(now + DAY);
  const toLater = iso(now + 15 * DAY);
  const calTomorrow = must(
    await expectOk('calendar: tomorrow-onward range', () =>
      calendar.getCalendarEvents(actor, { from: fromTomorrow, to: toLater }),
    ),
    'calTomorrow',
  );
  check(
    'vacant markers absent when today out of range',
    !calTomorrow.events.some((e) => e.kind === 'VACANT_UNIT'),
  );
  check('vacant panel still current in future range', calTomorrow.vacantUnits.some((u) => u.id === u1.id));
  check('lease-end still present in future range', calTomorrow.events.some((e) => e.id === leaseId));

  // ── invalid ranges → 400 ───────────────────────────────────────────────────
  console.log('— invalid input');
  await expectStatus('bad from format → 400', 400, () =>
    calendar.getCalendarEvents(actor, { from: '05-11-2026', to }),
  );
  await expectStatus('from without to → 400', 400, () => calendar.getCalendarEvents(actor, { from }));
  await expectStatus('from after to → 400', 400, () =>
    calendar.getCalendarEvents(actor, { from: to, to: from }),
  );
  await expectStatus('impossible calendar date → 400', 400, () =>
    calendar.getCalendarEvents(actor, { from: '2026-02-30', to: '2026-03-01' }),
  );
  await expectStatus('range wider than 366 days → 400', 400, () =>
    calendar.getCalendarEvents(actor, { from: '2024-01-01', to: '2025-12-31' }),
  );

  // ── per-class permission gating ────────────────────────────────────────────
  console.log('— per-class list-key gating (limited role)');
  const calLimited = must(
    await expectOk('calendar: limited session', () => calendar.getCalendarEvents(limitedActor, { from, to })),
    'calLimited',
  );
  check('limited sees lease ends (lease.list)', calLimited.events.some((e) => e.kind === 'LEASE_END' && e.id === leaseId));
  check('limited sees work orders (work_order.list)', calLimited.events.some((e) => e.kind === 'WORK_ORDER' && e.id === woId));
  check('limited sees recurring dues (schedule.list)', calLimited.events.some((e) => e.kind === 'RECURRING' && e.id === schedId));
  check('limited does NOT see viewings (no viewing.list)', !calLimited.events.some((e) => e.kind === 'VIEWING'));
  check('limited does NOT see inspections (no inspection.list)', !calLimited.events.some((e) => e.kind === 'INSPECTION'));
  check('limited vacant panel (unit.list)', calLimited.vacantUnits.some((u) => u.id === u1.id));

  // ── MM scoping (agreement arm) ─────────────────────────────────────────────
  console.log('— MM scoping (agreement property only)');
  const calMM = must(
    await expectOk('calendar: MM session', () => calendar.getCalendarEvents(mmActor, { from, to })),
    'calMM',
  );
  check(
    'MM sees agreed-property work order',
    calMM.events.some((e) => e.kind === 'WORK_ORDER' && e.id === woId && e.propertyId === pid),
  );
  check('MM sees agreed-property lease end', calMM.events.some((e) => e.kind === 'LEASE_END' && e.id === leaseId));
  check('MM events only on agreed property', calMM.events.every((e) => e.propertyId === pid));
  check('MM vacant units only on agreed property', calMM.vacantUnits.every((u) => u.propertyId === pid));
  check('MM misses P2 viewing', !calMM.events.some((e) => e.id === p2ViewingId));

  // ── bystander + stranger (permission-full, scope-zero) ─────────────────────
  console.log('— bystander/stranger scoping');
  const calBystander = must(
    await expectOk('calendar: bystander session', () => calendar.getCalendarEvents(bystanderActor, { from, to })),
    'calBystander',
  );
  check('bystander sees no events', calBystander.events.length === 0);
  check('bystander sees no vacant units', calBystander.vacantUnits.length === 0);

  const calStranger = must(
    await expectOk('calendar: stranger session', () => calendar.getCalendarEvents(strangerActor, { from, to })),
    'calStranger',
  );
  const fixtures = [viewingId, leaseId, woId, inspId, schedId, p2ViewingId];
  check(
    'stranger sees none of the smoke fixtures',
    fixtures.every((id) => !calStranger.events.some((e) => e.id === id)),
  );
} finally {
  console.log('— cleanup');
  // FK-safe order: agreement → owner party → viewings/lease/WO/inspections/
  // schedules → units → properties → limited role rows → MM org/user rows.
  if (agreementId) await prisma.propertyManagementAgreement.deleteMany({ where: { id: agreementId } });
  if (ownerPartyId) await prisma.propertyOwnerParty.deleteMany({ where: { id: ownerPartyId } });
  const pids = [pid, pid2].filter(Boolean);
  await prisma.propertyViewing.deleteMany({ where: { propertyId: { in: pids } } });
  await prisma.lease.deleteMany({ where: { propertyId: { in: pids } } });
  await prisma.workOrder.deleteMany({ where: { propertyId: { in: pids } } });
  await prisma.inspection.deleteMany({ where: { propertyId: { in: pids } } });
  await prisma.recurringSchedule.deleteMany({ where: { propertyId: { in: pids } } });
  await prisma.unit.deleteMany({ where: { propertyId: { in: pids } } });
  if (pid) await prisma.property.delete({ where: { id: pid } }).catch(() => undefined);
  if (pid2) await prisma.property.delete({ where: { id: pid2 } }).catch(() => undefined);
  await prisma.organizationMemberRole.deleteMany({ where: { roleId: limitedRole.id } });
  await prisma.role.deleteMany({ where: { id: limitedRole.id } });
  await prisma.organizationMemberRole.deleteMany({
    where: { organizationMember: { organizationId: { in: [mmOrg.id, bystanderOrg.id] } } },
  });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [mmOrg.id, bystanderOrg.id] } } });
  await prisma.role.deleteMany({ where: { organizationId: { in: [mmOrg.id, bystanderOrg.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [mmOrg.id, bystanderOrg.id] } } });
  await prisma.user.delete({ where: { id: mmUser.id } }).catch(() => undefined);
  await prisma.user.delete({ where: { id: limitedUser.id } }).catch(() => undefined);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} calendar smoke case(s) failed`);
