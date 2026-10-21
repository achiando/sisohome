/**
 * Slice 3 service smoke — maintenance (plan-slice-3 §6): the MM cross-org
 * story + lifecycle/guard coverage.
 *
 *   cd apps/web && npx tsx scripts/smoke-maintenance.ts
 *
 * Prints one line per case; throws (exit 1) on any failure.
 */

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { propertyScopeWhere } from '@/lib/domain/property-scope';
import * as maintenance from '@/lib/domain/maintenance';
import * as workOrders from '@/lib/domain/work-order';
import { computeNextDue } from '@/lib/domain/maintenance-constants';

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

// ── actors ───────────────────────────────────────────────────────────────────
const org = await prisma.organization.findFirstOrThrow();
const otherOrg = await prisma.organization.findFirst({ where: { id: { not: org.id } } });
const user = await prisma.user.findFirstOrThrow();

const actor = { userId: user.id, organizationId: org.id };
const stranger = otherOrg ? { userId: user.id, organizationId: otherOrg.id } : null;

// Landlord-side own-org member (for same-org assignment + inspection/schedule assignee).
const orgMember = await prisma.organizationMember.findFirstOrThrow({
  where: { organizationId: org.id, status: 'ACTIVE' },
  orderBy: { createdAt: 'asc' },
});

// MM org (the cross-org assignee) — fresh org + member user.
const mmUser = await prisma.user.create({
  data: { email: `smoke-mm-${Date.now()}@smoke.test`, displayName: 'SMOKE MM Tech' },
});
const mmOrg = await prisma.organization.create({
  data: {
    name: 'SMOKE MM Co',
    slug: `smoke-mm-${Date.now()}`,
    kind: 'MAINTENANCE_COMPANY',
    status: 'ACTIVE',
  },
});
await prisma.organizationMember.create({
  data: { organizationId: mmOrg.id, userId: mmUser.id, status: 'ACTIVE' },
});
const mmActor = { userId: mmUser.id, organizationId: mmOrg.id };

// Second MM org — no agreement, no assignment: must see NOTHING anywhere.
const bystanderOrg = await prisma.organization.create({
  data: {
    name: 'SMOKE Bystander Co',
    slug: `smoke-bystander-${Date.now()}`,
    kind: 'MAINTENANCE_COMPANY',
    status: 'ACTIVE',
  },
});
const bystanderActor = { userId: mmUser.id, organizationId: bystanderOrg.id };

let pid = '';
let pid2 = '';
let unitId = '';

try {
  console.log('— setup: properties + units');
  const property = must(
    await expectOk('create test property', () =>
      prisma.property.create({
        data: {
          portfolioOrganizationId: org.id,
          name: 'SMOKE Maintenance Property',
          category: 'RESIDENTIAL',
          propertyType: 'APARTMENT',
          addressLine1: 'Smoke Street 3',
          locality: 'Smokeville',
          country: 'KE',
        },
      }),
    ),
    'property',
  );
  pid = property.id;

  const unit = must(
    await expectOk('create unit', () =>
      prisma.unit.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          unitRef: 'SMOKE-3A',
          label: '3A',
          unitType: 'BED_1',
        },
      }),
    ),
    'unit',
  );
  unitId = unit.id;

  const property2 = must(
    await expectOk('create second property (cross-property guards)', () =>
      prisma.property.create({
        data: {
          portfolioOrganizationId: org.id,
          name: 'SMOKE Other Property',
          category: 'RESIDENTIAL',
          propertyType: 'APARTMENT',
          addressLine1: 'Smoke Street 4',
          locality: 'Smokeville',
          country: 'KE',
        },
      }),
    ),
    'property2',
  );
  pid2 = property2.id;

  // ── tickets ────────────────────────────────────────────────────────────────
  console.log('— tickets');
  const ticket = must(
    await expectOk('create ticket', () =>
      maintenance.createTicket(actor, {
        propertyId: pid,
        unitId,
        title: 'SMOKE leaking kitchen tap',
        description: 'Steady drip under the sink.',
        category: 'PLUMBING',
        priority: 'HIGH',
      }),
    ),
    'ticket',
  );
  check('ticket starts OPEN', ticket.status === 'OPEN');
  await expectStatus('create ticket without title → 400', 400, () =>
    maintenance.createTicket(actor, { propertyId: pid, title: '   ' }),
  );
  await expectStatus('create ticket on unknown property → 404', 404, () =>
    maintenance.createTicket(actor, { propertyId: '00000000-0000-4000-8000-000000000000', title: 'x' }),
  );

  const p2Ticket = must(
    await expectOk('create ticket on second property', () =>
      maintenance.createTicket(actor, { propertyId: pid2, title: 'SMOKE other-property issue' }),
    ),
    'p2Ticket',
  );
  const p2Unit = must(
    await expectOk('create unit on second property', () =>
      prisma.unit.create({
        data: {
          organizationId: org.id,
          propertyId: pid2,
          unitRef: 'SMOKE-4A',
          label: '4A',
          unitType: 'BED_1',
        },
      }),
    ),
    'p2Unit',
  );
  await expectStatus("unitId from another property → 400", 400, () =>
    maintenance.createTicket(actor, { propertyId: pid, title: 'x', unitId: p2Unit.id }),
  );

  await expectStatus('illegal ticket transition OPEN → CLOSED → 409', 409, () =>
    maintenance.transitionTicket(actor, ticket.id, { to: 'CLOSED' }),
  );
  const tUpdated = must(
    await expectOk('update ticket title', () =>
      maintenance.updateTicket(actor, ticket.id, { title: 'SMOKE leaking tap (updated)' }),
    ),
    'tUpdated',
  );
  check('title updated', tUpdated.title === 'SMOKE leaking tap (updated)');
  await expectStatus('update with no fields → 400', 400, () =>
    maintenance.updateTicket(actor, ticket.id, {}),
  );

  const tickets = await expectOk('list tickets (landlord)', () => maintenance.listTickets(actor));
  check('landlord ticket list contains smoke ticket', Boolean(tickets?.some((t) => t.id === ticket.id)));

  if (stranger) {
    await expectStatus('stranger get ticket → 404', 404, () => maintenance.getTicket(stranger, ticket.id));
    await expectStatus('stranger transition ticket → 404', 404, () =>
      maintenance.transitionTicket(stranger, ticket.id, { to: 'IN_PROGRESS' }),
    );
  }

  console.log('— MM scope BEFORE any assignment (plan §6 step 2)');
  check(
    'MM sees 0 properties',
    (await prisma.property.count({ where: propertyScopeWhere(mmActor) })) === 0,
  );
  check('MM ticket list empty', (await maintenance.listTickets(mmActor)).length === 0);
  check('MM work-order list empty', (await workOrders.listWorkOrders(mmActor)).length === 0);
  check('bystander MM sees 0 properties', (await prisma.property.count({ where: propertyScopeWhere(bystanderActor) })) === 0);

  // ── work orders ────────────────────────────────────────────────────────────
  console.log('— work orders');
  const wo = must(
    await expectOk('create work order linked to ticket', () =>
      workOrders.createWorkOrder(actor, {
        propertyId: pid,
        unitId,
        ticketId: ticket.id,
        title: 'SMOKE replace mixer tap',
        priority: 'HIGH',
        estimatedCost: '15000.50',
        currency: 'kes',
      }),
    ),
    'wo',
  );
  check('work order starts PENDING', wo.status === 'PENDING');
  check('money stored numerically', Number(wo.estimatedCost) === 15000.5);
  check('currency upper-cased', wo.currency === 'KES');
  await expectStatus('work order without title → 400', 400, () =>
    workOrders.createWorkOrder(actor, { propertyId: pid, title: 'x'.repeat(0) }),
  );
  await expectStatus('ticketId from another property → 400', 400, () =>
    workOrders.createWorkOrder(actor, { propertyId: pid, title: 'SMOKE bad link', ticketId: p2Ticket.id }),
  );
  await expectStatus('unknown work order → 404', 404, () =>
    workOrders.getWorkOrder(actor, '00000000-0000-4000-8000-000000000000'),
  );
  await expectStatus('MM get work order before assignment → 404', 404, () =>
    workOrders.getWorkOrder(mmActor, wo.id),
  );
  await expectStatus('illegal WO transition PENDING → COMPLETED → 409', 409, () =>
    workOrders.transitionWorkOrder(actor, wo.id, { to: 'COMPLETED' }),
  );

  await expectStatus('assignee not a member of target org → 400', 400, () =>
    workOrders.assignWorkOrder(actor, wo.id, {
      assigneeUserId: user.id,
      assigneeOrganizationId: mmOrg.id,
    }),
  );

  console.log('— authorize (side effect: ticket flips to IN_PROGRESS)');
  const woAuth = must(
    await expectOk('authorize work order', () =>
      workOrders.transitionWorkOrder(actor, wo.id, { to: 'AUTHORIZED' }),
    ),
    'woAuth',
  );
  check('WO AUTHORIZED + stamped', woAuth.status === 'AUTHORIZED' && woAuth.authorizedAt !== null);
  const ticketAfterAuth = await prisma.maintenanceTicket.findUniqueOrThrow({ where: { id: ticket.id } });
  check('ticket auto-flipped OPEN → IN_PROGRESS', ticketAfterAuth.status === 'IN_PROGRESS');

  console.log('— cross-org assignment (the MM hook)');
  const assignment = must(
    await expectOk('assign to MM org (no agreement)', () =>
      workOrders.assignWorkOrder(actor, wo.id, {
        assigneeUserId: mmUser.id,
        assigneeOrganizationId: mmOrg.id,
      }),
    ),
    'assignment',
  );
  check('assignment ASSIGNED', assignment.status === 'ASSIGNED');
  check('assigneeOrganizationId set (cross-org)', assignment.assigneeOrganizationId === mmOrg.id);
  await expectStatus('duplicate active assignment → 409', 409, () =>
    workOrders.assignWorkOrder(actor, wo.id, {
      assigneeUserId: mmUser.id,
      assigneeOrganizationId: mmOrg.id,
    }),
  );

  const candidates = must(
    await expectOk('assign-dialog candidates (landlord)', () => workOrders.listAssigneeCandidates(actor)),
    'candidates',
  );
  check('candidates include MM org after assignment', candidates.organizations.some((o) => o.id === mmOrg.id));
  const mmCandidates = must(
    await expectOk('assign-dialog candidates (MM org, other side)', () =>
      workOrders.listAssigneeCandidates(mmActor, org.id),
    ),
    'mmCandidates',
  );
  check('MM side lists landlord org', mmCandidates.organizations.some((o) => o.id === org.id));
  check(
    'org-scoped query returns members OF that org (assign target)',
    mmCandidates.members.some((m) => m.userId === orgMember.userId),
  );
  const mmOwn = await expectOk('MM candidates (no org → own members)', () =>
    workOrders.listAssigneeCandidates(mmActor),
  );
  check('MM side lists its own members (own-org default)', mmOwn?.members.some((m) => m.userId === mmUser.id) === true);
  await expectStatus('candidates for unrelated org → 404', 404, () =>
    workOrders.listAssigneeCandidates(actor, bystanderOrg.id),
  );

  console.log('— MM scope AFTER assignment (plan §6 step 4: arm 4)');
  check('MM sees 1 property', (await prisma.property.count({ where: propertyScopeWhere(mmActor) })) === 1);
  const mmTickets = await expectOk('MM ticket list (via parent scope)', () => maintenance.listTickets(mmActor));
  check('MM sees the ticket', Boolean(mmTickets?.some((t) => t.id === ticket.id)));
  const mmWos = await expectOk('MM work-order list', () => workOrders.listWorkOrders(mmActor));
  check('MM sees the work order', Boolean(mmWos?.some((w) => w.id === wo.id)));
  const mmWosMine = await expectOk("MM ?scope=mine", () => workOrders.listWorkOrders(mmActor, { scope: 'mine' }));
  check('scope=mine returns exactly the assigned WO', mmWosMine?.length === 1 && mmWosMine[0]?.id === wo.id);
  check(
    'bystander MM still sees nothing',
    (await prisma.property.count({ where: propertyScopeWhere(bystanderActor) })) === 0 &&
      (await maintenance.listTickets(bystanderActor)).length === 0 &&
      (await workOrders.listWorkOrders(bystanderActor)).length === 0,
  );

  const woDetailNoContacts = must(
    await expectOk('MM get work order (masked)', () => workOrders.getWorkOrder(mmActor, wo.id)),
    'woDetailNoContacts',
  );
  const maskedUser = woDetailNoContacts.assignments[0]?.assigneeUser as { email?: string } | undefined;
  check('assignee contact masked without user.read', !maskedUser || maskedUser.email === undefined);
  const woDetailContacts = must(
    await expectOk('get work order with contact mask off', () =>
      workOrders.getWorkOrder(mmActor, wo.id, { includeAssigneeContacts: true }),
    ),
    'woDetailContacts',
  );
  const exposedUser = woDetailContacts.assignments[0]?.assigneeUser as { email?: string } | undefined;
  check('assignee contact exposed with user.read', exposedUser?.email !== undefined);

  console.log('— MM drives the job: SCHEDULED → IN_PROGRESS → COMPLETED');
  await expectOk('MM transition → SCHEDULED', () =>
    workOrders.transitionWorkOrder(mmActor, wo.id, { to: 'SCHEDULED' }),
  );
  await expectOk('MM transition → IN_PROGRESS', () =>
    workOrders.transitionWorkOrder(mmActor, wo.id, { to: 'IN_PROGRESS' }),
  );
  const woDone = must(
    await expectOk('MM transition → COMPLETED', () =>
      workOrders.transitionWorkOrder(mmActor, wo.id, { to: 'COMPLETED', finalCost: '14200' }),
    ),
    'woDone',
  );
  check('WO completed + stamped', woDone.status === 'COMPLETED' && woDone.completedAt !== null);
  check('final cost recorded', Number(woDone.finalCost) === 14200);
  const assignmentDone = await prisma.workOrderAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  check('assignment auto-COMPLETED with the WO', assignmentDone.status === 'COMPLETED');
  await expectStatus('completed WO cannot be edited → 409', 409, () =>
    workOrders.updateWorkOrder(actor, wo.id, { title: 'nope' }),
  );
  await expectStatus('completed WO cannot be assigned → 409', 409, () =>
    workOrders.assignWorkOrder(actor, wo.id, { assigneeUserId: mmUser.id, assigneeOrganizationId: mmOrg.id }),
  );
  await expectStatus('completed WO cannot transition → 409', 409, () =>
    workOrders.transitionWorkOrder(actor, wo.id, { to: 'IN_PROGRESS' }),
  );

  console.log('— same-org assignment + assignment status arms');
  const wo2 = must(
    await expectOk('create standalone work order', () =>
      workOrders.createWorkOrder(actor, { propertyId: pid, title: 'SMOKE gutter clean', priority: 'LOW' }),
    ),
    'wo2',
  );
  const ownAssignment = must(
    await expectOk('same-org assignment (assigneeOrganizationId null)', () =>
      workOrders.assignWorkOrder(actor, wo2.id, { assigneeUserId: orgMember.userId }),
    ),
    'ownAssignment',
  );
  check('same-org assigneeOrganizationId is null', ownAssignment.assigneeOrganizationId === null);
  await expectStatus('unrelated org PATCH assignment → 404', 404, () =>
    workOrders.updateAssignment(mmActor, ownAssignment.id, { status: 'DECLINED' }),
  );
  const declined = must(
    await expectOk('assignment → DECLINED', () =>
      workOrders.updateAssignment(actor, ownAssignment.id, { status: 'DECLINED' }),
    ),
    'declined',
  );
  check('declined stamped', declined.status === 'DECLINED');
  await expectStatus('DECLINED is terminal → 409', 409, () =>
    workOrders.updateAssignment(actor, ownAssignment.id, { status: 'COMPLETED' }),
  );
  await expectStatus('assignment bad status → 400', 400, () =>
    workOrders.updateAssignment(actor, ownAssignment.id, { status: 'ASSIGNED' }),
  );
  const ownReassign = must(
    await expectOk('re-assign same user after decline', () =>
      workOrders.assignWorkOrder(actor, wo2.id, { assigneeUserId: orgMember.userId }),
    ),
    'ownReassign',
  );
  const ownCompleted = must(
    await expectOk('assignee person completes own assignment', () =>
      workOrders.updateAssignment({ userId: ownReassign.assigneeUserId, organizationId: org.id }, ownReassign.id, {
        status: 'COMPLETED',
      }),
    ),
    'ownCompleted',
  );
  check('person-arm completion stamped', ownCompleted.status === 'COMPLETED' && ownCompleted.completedAt !== null);

  // ── inspections ────────────────────────────────────────────────────────────
  console.log('— inspections');
  const inspection = must(
    await expectOk('create inspection (linked to WO)', () =>
      maintenance.createInspection(actor, {
        propertyId: pid,
        unitId,
        workOrderId: wo2.id,
        kind: 'ROUTINE',
        scheduledFor: '2026-11-01',
        inspectorUserId: orgMember.userId,
      }),
    ),
    'inspection',
  );
  check('inspection starts SCHEDULED', inspection.status === 'SCHEDULED');
  await expectStatus('inspector must be member of your/portfolio org → 400', 400, () =>
    maintenance.createInspection(actor, { propertyId: pid, inspectorUserId: mmUser.id }),
  );
  await expectStatus('unknown workOrderId → 404', 404, () =>
    maintenance.createInspection(actor, { propertyId: pid, workOrderId: '00000000-0000-4000-8000-000000000000' }),
  );
  await expectStatus('bad inspection kind → 400', 400, () =>
    maintenance.createInspection(actor, { propertyId: pid, kind: 'SOMETHING' }),
  );
  await expectStatus('illegal completion SCHEDULED → PASSED → 409', 409, () =>
    maintenance.completeInspection(actor, inspection.id, { to: 'PASSED' }),
  );
  await expectStatus('PATCH status PASSED → 400 (use /complete)', 400, () =>
    maintenance.updateInspection(actor, inspection.id, { status: 'PASSED' }),
  );
  await expectStatus('PATCH bogus status → 400', 400, () =>
    maintenance.updateInspection(actor, inspection.id, { status: 'DUNNO' }),
  );
  const inspStarted = must(
    await expectOk('PATCH status → IN_PROGRESS (sanctioned step)', () =>
      maintenance.updateInspection(actor, inspection.id, { status: 'IN_PROGRESS' }),
    ),
    'inspStarted',
  );
  check('inspection IN_PROGRESS', inspStarted.status === 'IN_PROGRESS');
  await expectStatus('PATCH IN_PROGRESS → IN_PROGRESS again → 409', 409, () =>
    maintenance.updateInspection(actor, inspection.id, { status: 'IN_PROGRESS' }),
  );
  await expectStatus('FAILED without findings → 400', 400, () =>
    maintenance.completeInspection(actor, inspection.id, { to: 'FAILED' }),
  );
  const inspFailed = must(
    await expectOk('FAILED with findings', () =>
      maintenance.completeInspection(actor, inspection.id, { to: 'FAILED', findings: 'Cracked seal at valve 2.' }),
    ),
    'inspFailed',
  );
  check('FAILED stamped + findings stored', inspFailed.status === 'FAILED' && Boolean(inspFailed.findings));
  await expectStatus('finished inspection cannot be edited → 409', 409, () =>
    maintenance.updateInspection(actor, inspection.id, { kind: 'ROUTINE' }),
  );
  await expectStatus('finished inspection cannot re-complete → 409', 409, () =>
    maintenance.completeInspection(actor, inspection.id, { to: 'PASSED' }),
  );

  const insp2 = must(
    await expectOk('second inspection (PASSED path)', () =>
      maintenance.createInspection(actor, {
        propertyId: pid,
        kind: 'SAFETY',
        scheduledFor: '2026-11-02',
        inspectorUserId: orgMember.userId,
      }),
    ),
    'insp2',
  );
  await expectOk('second inspection → IN_PROGRESS', () =>
    maintenance.updateInspection(actor, insp2.id, { status: 'IN_PROGRESS' }),
  );
  const insp2Passed = must(
    await expectOk('inspection → PASSED (no findings needed)', () =>
      maintenance.completeInspection(actor, insp2.id, { to: 'PASSED' }),
    ),
    'insp2Passed',
  );
  check('PASSED needs no findings', insp2Passed.status === 'PASSED');

  const insp3 = must(
    await expectOk('third inspection (cancel path)', () =>
      maintenance.createInspection(actor, { propertyId: pid, kind: 'MOVE_IN', inspectorUserId: orgMember.userId }),
    ),
    'insp3',
  );
  const insp3Cancelled = must(
    await expectOk('SCHEDULED → CANCELLED via PATCH', () =>
      maintenance.updateInspection(actor, insp3.id, { status: 'CANCELLED' }),
    ),
    'insp3Cancelled',
  );
  check('inspection CANCELLED', insp3Cancelled.status === 'CANCELLED');
  await expectStatus('cancelled inspection cannot be edited → 409', 409, () =>
    maintenance.updateInspection(actor, insp3.id, { kind: 'ROUTINE' }),
  );

  const mmInspections = await expectOk('MM inspection list (arm 4)', () => maintenance.listInspections(mmActor));
  check('MM sees inspections', Boolean(mmInspections?.some((i) => i.id === inspection.id)));
  if (stranger) {
    await expectStatus('stranger get inspection → 404', 404, () => maintenance.getInspection(stranger, inspection.id));
  }

  // ── recurring schedules ────────────────────────────────────────────────────
  console.log('— recurring schedules');
  const startDate = new Date('2026-01-05T00:00:00.000Z');
  const schedule = must(
    await expectOk('create weekly schedule', () =>
      maintenance.createSchedule(actor, {
        propertyId: pid,
        unitId,
        title: 'SMOKE weekly gutter check',
        kind: 'CLEANING',
        frequency: 'WEEKLY',
        startDate: '2026-01-05',
        assigneeUserId: orgMember.userId,
      }),
    ),
    'schedule',
  );
  check('nextDueAt computed from frequency', schedule.nextDueAt?.getTime() === computeNextDue(startDate, 'WEEKLY').getTime());
  await expectStatus('schedule without startDate → 400', 400, () =>
    maintenance.createSchedule(actor, { propertyId: pid, title: 'x', frequency: 'WEEKLY' }),
  );
  await expectStatus('bad frequency → 400', 400, () =>
    maintenance.createSchedule(actor, { propertyId: pid, title: 'x', startDate: '2026-01-05', frequency: 'YEARLY' }),
  );
  await expectStatus('schedule assignee must be member → 400', 400, () =>
    maintenance.createSchedule(actor, {
      propertyId: pid,
      title: 'x',
      startDate: '2026-01-05',
      frequency: 'WEEKLY',
      assigneeUserId: mmUser.id,
    }),
  );

  const scheduleDaily = must(
    await expectOk('frequency edit recomputes nextDueAt', () =>
      maintenance.updateSchedule(actor, schedule.id, { frequency: 'DAILY' }),
    ),
    'scheduleDaily',
  );
  check('nextDueAt recomputed on frequency change', scheduleDaily?.nextDueAt?.getTime() === computeNextDue(startDate, 'DAILY').getTime());

  const deactivated = must(
    await expectOk('schedule → soft delete', () => maintenance.deactivateSchedule(actor, schedule.id)),
    'deactivated',
  );
  check('schedule isActive false', deactivated.isActive === false);
  const deactivatedAgain = await expectOk('deactivate is idempotent', () =>
    maintenance.deactivateSchedule(actor, schedule.id),
  );
  check('second deactivate still false', deactivatedAgain?.isActive === false);
  const inactive = await expectOk('list schedules active=false', () =>
    maintenance.listSchedules(actor, { active: 'false' }),
  );
  check('inactive list contains schedule', Boolean(inactive?.some((s) => s.id === schedule.id)));
  const mmSchedules = await expectOk('MM schedule list (arm 4)', () => maintenance.listSchedules(mmActor));
  check('MM sees schedules', Boolean(mmSchedules?.some((s) => s.id === schedule.id)));
  if (stranger) {
    await expectStatus('stranger get schedule → 404', 404, () => maintenance.getSchedule(stranger, schedule.id));
  }

  console.log('— ticket close-out (after the job)');
  await expectOk('MM resolves ticket', () => maintenance.transitionTicket(mmActor, ticket.id, { to: 'RESOLVED' }));
  const closed = must(
    await expectOk('MM closes ticket', () => maintenance.transitionTicket(mmActor, ticket.id, { to: 'CLOSED' })),
    'closed',
  );
  check('closed stamped', closed.closedAt !== null);
  await expectStatus('closed ticket cannot be edited → 409', 409, () =>
    maintenance.updateTicket(actor, ticket.id, { title: 'nope' }),
  );
  await expectStatus('closed ticket cannot transition → 409', 409, () =>
    maintenance.transitionTicket(actor, ticket.id, { to: 'OPEN' }),
  );
} finally {
  console.log('— cleanup');
  // FK-safe order: inspections → WOs (cascade assignments) → tickets →
  // schedules → units → property → MM org/user rows → property 2.
  await prisma.inspection.deleteMany({ where: { propertyId: { in: [pid, pid2].filter(Boolean) } } });
  await prisma.workOrder.deleteMany({ where: { propertyId: { in: [pid, pid2].filter(Boolean) } } });
  await prisma.maintenanceTicket.deleteMany({ where: { propertyId: { in: [pid, pid2].filter(Boolean) } } });
  await prisma.recurringSchedule.deleteMany({ where: { propertyId: pid } });
  await prisma.unit.deleteMany({ where: { propertyId: { in: [pid, pid2].filter(Boolean) } } });
  if (pid) await prisma.property.delete({ where: { id: pid } }).catch(() => undefined);
  if (pid2) await prisma.property.delete({ where: { id: pid2 } }).catch(() => undefined);
  await prisma.organizationMemberRole.deleteMany({
    where: { organizationMember: { organizationId: { in: [mmOrg.id, bystanderOrg.id] } } },
  });
  await prisma.organizationMember.deleteMany({
    where: { organizationId: { in: [mmOrg.id, bystanderOrg.id] } },
  });
  await prisma.organization.deleteMany({ where: { id: { in: [mmOrg.id, bystanderOrg.id] } } });
  await prisma.user.delete({ where: { id: mmUser.id } }).catch(() => undefined);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} maintenance smoke case(s) failed`);
