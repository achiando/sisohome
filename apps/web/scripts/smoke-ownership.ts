/**
 * Slice 1c service smoke — owner parties, ownerships (XOR + share budget),
 * management agreements (dual entry + approval flips scope arm 2),
 * staff assignments (scope arm 3 on/off), cross-tenant isolation.
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-ownership.ts
 *
 * Prints one line per case; exits 1 on any failure.
 */

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import * as ownership from '@/lib/domain/ownership';
import * as agreements from '@/lib/domain/agreement';
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

// Dedicated PM org — agreements only accept managers of managing kinds.
const managerOrg = await prisma.organization.create({
  data: {
    name: 'SMOKE PM Co',
    slug: `smoke-pm-${Date.now()}`,
    kind: 'PROPERTY_MANAGEMENT',
    status: 'ACTIVE',
  },
});
const managerActor = { userId: user.id, organizationId: managerOrg.id };

let pid = '';
let unitId = '';
let partyAId = '';
let partyBId = '';

try {
  console.log('— setup: property, unit, owner parties');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Ownership Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 9',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property) throw new Error('setup failed');
  pid = property.id;

  const unit = await expectOk('create unit', () =>
    units.createUnit(actor, pid, { unitRef: 'SMOKE-1', unitType: 'BED_1' }),
  );
  if (!unit) throw new Error('setup failed');
  unitId = unit.id;

  const partyA = await expectOk('create party A (company)', () =>
    ownership.createOwnerParty(actor, { partyType: 'COMPANY', name: 'SMOKE Owners Ltd', email: 'owners@smoke.test' }),
  );
  const partyB = await expectOk('create party B (person)', () =>
    ownership.createOwnerParty(actor, { partyType: 'PERSON', name: 'SMOKE Jane Wanjiku' }),
  );
  if (!partyA || !partyB) throw new Error('setup failed');
  partyAId = partyA.id;
  partyBId = partyB.id;

  console.log('— owner parties');
  await expectOk('update party B phone', () => ownership.updateOwnerParty(actor, partyBId, { phone: '+254700000001' }));
  const parties = await expectOk('list parties (own org)', () => ownership.listOwnerParties(actor));
  check(
    'list contains both smoke parties',
    Boolean(parties?.some((p) => p.id === partyAId) && parties?.some((p) => p.id === partyBId)),
  );
  await expectStatus('unknown party → 404', 404, () => ownership.getOwnerParty(actor, '00000000-0000-4000-8000-000000000000'));

  console.log('— ownership: create, XOR, budget');
  const ownA = await expectOk('property-level 60% (party A)', () =>
    ownership.createOwnership(actor, { propertyId: pid }, { ownerPartyId: partyAId, sharePercent: 60, startsAt: '2026-01-01' }),
  );
  await expectOk('property-level 40% (party B)', () =>
    ownership.createOwnership(actor, { propertyId: pid }, { ownerPartyId: partyBId, sharePercent: 40, startsAt: '2026-01-01' }),
  );
  await expectStatus('budget 60+40+5 → 400', 400, () =>
    ownership.createOwnership(actor, { propertyId: pid }, { ownerPartyId: partyAId, sharePercent: 5, startsAt: '2026-02-01' }),
  );
  const unitOwn = await expectOk('unit-level 100% (XOR unit branch)', () =>
    ownership.createOwnership(actor, { unitId }, { ownerPartyId: partyAId, sharePercent: 100, startsAt: '2026-01-01' }),
  );
  check(
    'unit-level row has propertyId null (XOR)',
    unitOwn !== null && unitOwn.propertyId === null && unitOwn.unitId === unitId,
  );
  await expectStatus('neither property nor unit → 400', 400, () =>
    ownership.createOwnership(actor, {}, { ownerPartyId: partyAId, sharePercent: 1 }),
  );
  await expectStatus('unknown property → 404', 404, () =>
    ownership.createOwnership(actor, { propertyId: '00000000-0000-4000-8000-000000000000' }, { ownerPartyId: partyAId, sharePercent: 1 }),
  );

  console.log('— ownership: cross-org party + updates');
  if (stranger) {
    const foreignParty = await strangerCreateParty();
    if (foreignParty) {
      await expectStatus('party from another org → 400', 400, () =>
        ownership.createOwnership(actor, { propertyId: pid }, { ownerPartyId: foreignParty, sharePercent: 1 }),
      );
      await prisma.propertyOwnerParty.delete({ where: { id: foreignParty } }).catch(() => {});
    }
    await expectStatus('update share 60 → 61 (101% total) → 400', 400, () =>
      ownership.updateOwnership(actor, ownA!.id, { sharePercent: 61 }),
    );
  } else {
    await expectStatus('update share 60 → 61 (101% total) → 400', 400, () =>
      ownership.updateOwnership(actor, ownA!.id, { sharePercent: 61 }),
    );
  }
  await expectOk('update share 60 → 50 + title', () =>
    ownership.updateOwnership(actor, ownA!.id, { sharePercent: 50, titleNumber: 'NAI/2026/SMOKE' }),
  );
  await expectStatus('endsAt before startsAt → 400', 400, () =>
    ownership.updateOwnership(actor, ownA!.id, { endsAt: '2025-06-01' }),
  );
  await expectStatus('delete party A while referenced → 409', 409, () => ownership.deleteOwnerParty(actor, partyAId));
  if (stranger) {
    await expectStatus('stranger get party A → 404', 404, () => ownership.getOwnerParty(stranger!, partyAId));
    const strangerParties = await ownership.listOwnerParties(stranger);
    check(
      'stranger party list isolated from ours',
      !strangerParties.some((p) => p.id === partyAId),
    );
  }

  console.log('— staff: arm 3 opens and closes scope');
  if (stranger) {
    await expectStatus('stranger ownerships pre-staff → 404', 404, () => ownership.listPropertyOwnerships(stranger, pid));
    await expectStatus('stranger parties-for-property pre-staff → 404', 404, () =>
      ownership.listOwnerParties(stranger, { propertyId: pid }),
    );
  }
  const staff = await expectOk('assign staff (arm 3 from startsAt)', () =>
    agreements.createStaff(actor, pid, { userId: user.id, title: 'SMOKE caretaker' }),
  );
  await expectStatus('duplicate active assignment → 409', 409, () =>
    agreements.createStaff(actor, pid, { userId: user.id }),
  );
  if (stranger && staff) {
    const visible = await expectOk('staff sees assignments', () => agreements.listStaff(stranger, pid));
    check('staff list contains assignment', Boolean(visible?.some((s) => s.id === staff.id)));
    const scoped = await expectOk('staff ownerships via arm 3', () => ownership.listPropertyOwnerships(stranger, pid));
    check('arm 3 opens ownership list', Array.isArray(scoped));
    const partiesForProp = await expectOk('staff reads portfolio party directory', () =>
      ownership.listOwnerParties(stranger, { propertyId: pid }),
    );
    check(
      'cross-org party read (scope-gated)',
      Boolean(partiesForProp?.some((p) => p.id === partyAId)),
    );
    await expectStatus('staff (non-portfolio) create ownership → 403', 403, () =>
      ownership.createOwnership(stranger, { propertyId: pid }, { ownerPartyId: partyAId, sharePercent: 1 }),
    );
    await expectStatus('staff (non-portfolio) update ownership → 403', 403, () =>
      ownership.updateOwnership(stranger, ownA!.id, { sharePercent: 40 }),
    );
    await expectStatus('staff (non-portfolio) delete ownership → 403', 403, () =>
      ownership.deleteOwnership(stranger, ownA!.id),
    );
    await expectStatus('staff get party A still → 404 (flat org)', 404, () =>
      ownership.getOwnerParty(stranger, partyAId),
    );
  }
  await expectOk('revoke staff (isActive = false)', () => agreements.revokeStaff(actor, staff!.id));
  if (stranger) {
    await expectStatus('post-revoke ownerships → 404 (scope closed)', 404, () =>
      ownership.listPropertyOwnerships(stranger, pid),
    );
    await expectStatus('post-revoke parties-for-property → 404', 404, () =>
      ownership.listOwnerParties(stranger, { propertyId: pid }),
    );
  }

  console.log('— agreements: dual entry');
  await expectStatus('create without owner party → 400', 400, () =>
    agreements.createAgreement(actor, { propertyId: pid, managementOrganizationId: managerOrg.id }),
  );
  const ownerAgreement = await expectOk('owner proposes (manager = PM org) → DRAFT', () =>
    agreements.createAgreement(actor, {
      propertyId: pid,
      managementOrganizationId: managerOrg.id,
      ownerPartyId: partyAId,
      startsAt: new Date().toISOString().slice(0, 10),
      scope: { notes: 'SMOKE: rent collection' },
    }),
  );
  check('created as DRAFT', ownerAgreement?.status === 'DRAFT', ownerAgreement?.status);
  if (stranger) {
    const foreignParty = await strangerCreateParty();
    if (foreignParty) {
      await expectStatus('agreement naming a foreign party → 400', 400, () =>
        agreements.createAgreement(actor, {
          propertyId: pid,
          managementOrganizationId: managerOrg.id,
          ownerPartyId: foreignParty,
        }),
      );
      await prisma.propertyOwnerParty.delete({ where: { id: foreignParty } }).catch(() => {});
    }
    await expectStatus('unknown property (nested scope) → 404', 404, () =>
      agreements.createAgreement(stranger, { propertyId: '00000000-0000-4000-8000-000000000000' }, { requirePropertyScope: true }),
    );
  }
  const pmProposal = await expectOk('PM self-proposal → DRAFT in owner inbox', () =>
    agreements.createAgreement(managerActor, {
      propertyId: pid,
      managementOrganizationId: managerOrg.id,
      ownerPartyId: partyAId,
      startsAt: new Date().toISOString().slice(0, 10),
    }),
  );
  check('PM proposal filed in portfolio org', pmProposal?.organizationId === org.id);
  await expectStatus('PM proposes third-party manager → 400', 400, () =>
    agreements.createAgreement(managerActor, {
      propertyId: pid,
      managementOrganizationId: org.id,
      ownerPartyId: partyAId,
    }),
  );
  await expectStatus('endsAt ≤ startsAt → 400', 400, () =>
    agreements.createAgreement(actor, {
      propertyId: pid,
      managementOrganizationId: managerOrg.id,
      ownerPartyId: partyAId,
      startsAt: '2026-06-01',
      endsAt: '2026-05-01',
    }),
  );

  console.log('— agreements: scope arm 2 (before/after approval)');
  await expectStatus('manager pre-approve ownerships → 404', 404, () =>
    ownership.listPropertyOwnerships(managerActor, pid),
  );
  await expectStatus('manager pre-approve parties-for-property → 404', 404, () =>
    ownership.listOwnerParties(managerActor, { propertyId: pid }),
  );

  console.log('— agreements: visibility + approval');
  if (stranger && ownerAgreement) {
    await expectStatus('unrelated org get agreement → 404', 404, () =>
      agreements.getAgreement(stranger, ownerAgreement.id),
    );
    const seen = await agreements.listAgreements(stranger);
    check(
      'unrelated org agreement list excludes ours',
      !seen.some((a) => a.id === ownerAgreement.id),
    );
  }
  const seenByManager = await expectOk('manager sees owner-side row', () =>
    agreements.listAgreements(managerActor, { propertyId: pid }),
  );
  check(
    'manager row flag actorIsPortfolioSide = false',
    seenByManager?.find((a) => a.id === ownerAgreement!.id)?.actorIsPortfolioSide === false,
  );
  await expectStatus('manager approve (not portfolio side) → 403', 403, () =>
    agreements.approveAgreement(managerActor, ownerAgreement!.id),
  );
  if (stranger) {
    await expectStatus('unrelated org approve → 404', 404, () =>
      agreements.approveAgreement(stranger, ownerAgreement!.id),
    );
  }
  const approved = await expectOk('owner approves → ACTIVE', () =>
    agreements.approveAgreement(actor, ownerAgreement!.id),
  );
  check('status is ACTIVE', approved?.status === 'ACTIVE', approved?.status);
  await expectStatus('second approval → 409', 409, () => agreements.approveAgreement(actor, ownerAgreement!.id));

  const mgrScoped = await expectOk('manager ownerships via arm 2 (post-approve)', () =>
    ownership.listPropertyOwnerships(managerActor, pid),
  );
  check('arm 2 opens ownership list', Array.isArray(mgrScoped));
  const mgrParties = await expectOk('manager party-directory read (scope-gated)', () =>
    ownership.listOwnerParties(managerActor, { propertyId: pid }),
  );
  check('manager sees portfolio parties', Boolean(mgrParties?.some((p) => p.id === partyAId)));
  await expectStatus('manager create ownership still → 403', 403, () =>
    ownership.createOwnership(managerActor, { propertyId: pid }, { ownerPartyId: partyAId, sharePercent: 1 }),
  );

  console.log('— agreements: update + end');
  await expectStatus('manager edit ACTIVE → 403', 403, () =>
    agreements.updateAgreement(managerActor, ownerAgreement!.id, { endsAt: '2027-12-31' }),
  );
  await expectOk('owner edits ACTIVE dates', () =>
    agreements.updateAgreement(actor, ownerAgreement!.id, { endsAt: '2027-12-31' }),
  );
  if (pmProposal) {
    await expectOk('PM edits own DRAFT pre-approval', () =>
      agreements.updateAgreement(managerActor, pmProposal.id, { scope: { notes: 'SMOKE: PM edit' } }),
    );
  }
  const ended = await expectOk('manager ends ACTIVE (symmetric)', () =>
    agreements.endAgreement(managerActor, ownerAgreement!.id),
  );
  check('status is ENDED', ended?.status === 'ENDED', ended?.status);
  await expectStatus('edit closed row → 409', 409, () =>
    agreements.updateAgreement(actor, ownerAgreement!.id, { endsAt: '2028-01-01' }),
  );
  await expectStatus('end closed row → 409', 409, () => agreements.endAgreement(actor, ownerAgreement!.id));
  const endedList = await expectOk('list filtered by status ENDED', () =>
    agreements.listAgreements(actor, { status: 'ENDED' }),
  );
  check('ENDED list contains the row', Boolean(endedList?.some((a) => a.id === ownerAgreement!.id)));
  await expectStatus('manager ownerships post-end → 404 (scope closed)', 404, () =>
    ownership.listPropertyOwnerships(managerActor, pid),
  );

  console.log('— manager directory');
  const candidates = await agreements.listManagementOrgCandidates(actor);
  check('directory includes PM org', candidates.some((o) => o.id === managerOrg.id));
  check('directory excludes own org', !candidates.some((o) => o.id === org.id));
  check(
    'directory only managing kinds',
    candidates.every((o) => o.kind === 'PROPERTY_MANAGEMENT' || o.kind === 'MAINTENANCE_COMPANY'),
    candidates.map((o) => o.kind).join(','),
  );
} finally {
  console.log('— cleanup');
  await prisma.auditLog
    .deleteMany({
      where: {
        OR: [{ organizationId: org.id }, { organizationId: managerOrg.id }],
        resourceType: { in: ['OWNER_PARTY', 'OWNERSHIP', 'AGREEMENT', 'STAFF_ASSIGNMENT', 'UNIT'] },
      },
    })
    .catch(() => {});
  if (pid) {
    await prisma.propertyOwnership.deleteMany({ where: { propertyId: pid } }).catch(() => {});
    await prisma.propertyStaffAssignment.deleteMany({ where: { propertyId: pid } }).catch(() => {});
    await prisma.propertyManagementAgreement.deleteMany({ where: { propertyId: pid } }).catch(() => {});
  }
  await prisma.propertyOwnerParty
    .deleteMany({ where: { organizationId: org.id, name: { startsWith: 'SMOKE' } } })
    .catch(() => {});
  await prisma.propertyOwnerParty
    .deleteMany({ where: { organizationId: otherOrg?.id ?? '', name: { startsWith: 'SMOKE' } } })
    .catch(() => {});
  if (unitId) await prisma.unit.deleteMany({ where: { id: unitId } }).catch(() => {});
  if (pid) await prisma.property.delete({ where: { id: pid } }).catch(() => {});
  await prisma.organization.delete({ where: { id: managerOrg.id } }).catch(() => {});
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

/** A party in the stranger org — used for cross-org 400 assertions. */
async function strangerCreateParty(): Promise<string | null> {
  if (!stranger) return null;
  try {
    const p = await ownership.createOwnerParty(stranger, {
      partyType: 'PERSON',
      name: `SMOKE Foreign ${Date.now()}`,
    });
    return p.id;
  } catch {
    return null;
  }
}
