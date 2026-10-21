/**
 * Slice 1b service smoke — buildings, units, bulk generator, flat unit
 * types, scoping + cross-tenant isolation.
 *
 *   cd apps/web && npx tsx scripts/smoke-units.ts
 *
 * Prints one line per case; throws (exit 1) on any failure.
 */

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
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

console.log('— property setup');
const property = await expectOk('create test property', () =>
  prisma.property.create({
    data: {
      portfolioOrganizationId: org.id,
      name: 'SMOKE Units Property',
      category: 'RESIDENTIAL',
      propertyType: 'APARTMENT',
      addressLine1: 'Smoke Street 1',
      locality: 'Smokeville',
      country: 'KE',
      // Property-wide rows — unit/building amenity writes must strip these.
      amenities: ['Parking', 'Security'],
    },
  }),
);
if (!property) throw new Error('setup failed');
const pid = property.id;

try {
  console.log('— buildings');
  const blkA = await expectOk('create BLK-A', () =>
    units.createBuilding(actor, pid, { code: 'BLK-A', name: 'Block A', floors: 2 }),
  );
  await expectStatus('duplicate BLK-A code', 409, () =>
    units.createBuilding(actor, pid, { code: 'BLK-A' }),
  );
  const buildings = await expectOk('list buildings', () => units.listBuildings(actor, pid));
  if (buildings && buildings.length !== 1) {
    failed += 1;
    console.log(`  ✗ expected 1 building, got ${buildings.length}`);
  }
  const blkB = await expectOk('create BLK-B', () => units.createBuilding(actor, pid, { code: 'BLK-B' }));
  if (blkB) {
    await expectStatus('patch BLK-B → existing BLK-A code', 409, () =>
      units.updateBuilding(actor, blkB.id, { code: 'BLK-A' }),
    );
  }

  console.log('— units');
  const u101 = await expectOk('create unit 101 (label defaults to ref)', () =>
    units.createUnit(actor, pid, {
      unitRef: '101',
      unitType: 'BED_1',
      buildingId: blkA?.id,
      defaultRent: 25000,
      bedrooms: 1,
    }),
  );
  if (u101 && u101.label !== '101') {
    failed += 1;
    console.log(`  ✗ label should default to unitRef, got "${u101.label}"`);
  }
  await expectStatus('duplicate unitRef on property', 409, () =>
    units.createUnit(actor, pid, { unitRef: '101', unitType: 'BED_1' }),
  );
  await expectStatus('buildingId from another property', 400, async () => {
    const otherProp = await prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Other',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'x',
        locality: 'x',
        country: 'KE',
      },
    });
    const foreignBuilding = await prisma.building.create({
      data: { organizationId: org.id, propertyId: otherProp.id, code: 'F' },
    });
    try {
      await units.createUnit(actor, pid, { unitRef: 'X-1', unitType: 'BED_1', buildingId: foreignBuilding.id });
    } finally {
      await prisma.property.delete({ where: { id: otherProp.id } });
    }
  });

  console.log('— bulk generator');
  const bulk1 = await expectOk('bulk A-101..A-104 skip 103 (creates 3)', () =>
    units.bulkCreateUnits(actor, pid, {
      prefix: 'A-',
      from: 101,
      to: 104,
      skip: [103],
      buildingId: blkA?.id ?? null,
      defaults: { unitType: 'BED_2', defaultRent: 35000 },
    }),
  );
  if (bulk1 && bulk1.created !== 3) {
    failed += 1;
    console.log(`  ✗ expected 3 created, got ${bulk1.created}`);
  }
  await expectStatus('bulk conflict with existing refs', 409, () =>
    units.bulkCreateUnits(actor, pid, { prefix: 'A-', from: 101, to: 102, defaults: { unitType: 'BED_2' } }),
  );
  await expectStatus('bulk range > 500', 400, () =>
    units.bulkCreateUnits(actor, pid, { from: 1, to: 501, defaults: { unitType: 'BED_2' } }),
  );

  console.log('— listing + derived occupancy');
  const list = await expectOk('list units (expect 4, all vacant)', () =>
    units.listUnits(actor, pid),
  );
  if (list) {
    if (list.length !== 4) {
      failed += 1;
      console.log(`  ✗ expected 4 units, got ${list.length}`);
    } else if (list.some((u) => u.occupancy !== 'VACANT')) {
      failed += 1;
      console.log('  ✗ all units should read VACANT (no leases)');
    } else {
      ok('4 units, occupancy = VACANT');
    }
    const filtered = await units.listUnits(actor, pid, { buildingId: 'none' });
    if (filtered.length !== 0) {
      failed += 1;
      console.log(`  ✗ buildingId=none should match 0, got ${filtered.length}`);
    } else {
      ok('buildingId=none filter matches only unbuilt units (0)');
    }
  }

  console.log('— status gate + updates');
  const first = list?.[0];
  if (first) {
    await expectStatus('hand-set OCCUPIED rejected', 400, () =>
      units.updateUnit(actor, first.id, { status: 'OCCUPIED' }),
    );
    await expectOk('hand-set MAINTENANCE allowed', () =>
      units.updateUnit(actor, first.id, { status: 'MAINTENANCE' }),
    );
    const after = await units.getUnit(actor, first.id);
    if (after && after.occupancy !== 'MAINTENANCE') {
      failed += 1;
      console.log(`  ✗ expected MAINTENANCE occupancy, got ${after.occupancy}`);
    } else if (after) {
      ok('occupancy reflects MAINTENANCE');
    }
    await expectOk('rename unitRef', () => units.updateUnit(actor, first.id, { unitRef: '101-B' }));
    await expectStatus('rename into taken ref', 409, () =>
      units.updateUnit(actor, list![1]!.id, { unitRef: '101-B' }),
    );
  }

  console.log('— delete guards');
  if (blkA) {
    await expectStatus('delete building with units', 409, () => units.deleteBuilding(actor, blkA.id));
  }
  if (first) {
    await expectOk('delete unit without leases', () => units.deleteUnit(actor, first.id));
  }

  console.log('— flat unit types (org catalog)');
  const ut = await expectOk('create unit type "SMOKE 2Bed"', () =>
    units.createUnitType(actor, { name: 'SMOKE 2Bed', bedrooms: 2, baseRent: 35000 }),
  );
  await expectStatus('duplicate unit type name', 409, () =>
    units.createUnitType(actor, { name: 'SMOKE 2Bed' }),
  );
  if (ut) await expectOk('delete unit type', () => units.deleteUnitType(actor, ut.id));

  console.log('— utility accounts + amenities vs property');
  // u101 is deleted in the delete-guards section — pick any surviving unit.
  const meterTarget = await prisma.unit.findFirst({
    where: { propertyId: pid },
    orderBy: { unitRef: 'asc' },
  });
  if (meterTarget) {
    const withMeters = await expectOk('set meter/account fields + mixed amenities', () =>
      units.updateUnit(actor, meterTarget.id, {
        accountNumber: 'WC-111',
        waterMeterNumber: 'WM-111',
        electricityMeterNumber: 'EM-111',
        // 'parking'/'Security' are property-wide (incl. case variants) → stripped.
        amenities: ['parking', 'Security', 'Balcony', 'GYM'],
      }),
    );
    const fresh = withMeters ?? (await prisma.unit.findUnique({ where: { id: meterTarget.id } }));
    if (!fresh || fresh.accountNumber !== 'WC-111' || fresh.waterMeterNumber !== 'WM-111' || fresh.electricityMeterNumber !== 'EM-111') {
      failed += 1;
      console.log('  ✗ meter/account fields did not persist');
    } else {
      ok('meter/account fields persisted');
    }
    const a = fresh?.amenities ?? [];
    if (a.includes('parking') || a.includes('Security') || !a.includes('Balcony') || !a.includes('GYM')) {
      failed += 1;
      console.log(`  ✗ amenity strip wrong, got [${a.join(', ')}]`);
    } else {
      ok('unit amenities stripped vs property (case-insensitive)');
    }
  }
  if (blkA) {
    const bFresh = await expectOk('set building meters + mixed amenities', () =>
      units.updateBuilding(actor, blkA.id, {
        code: blkA.code,
        accountNumber: 'BLD-AC-1',
        waterMeterNumber: 'BLD-WM-1',
        electricityMeterNumber: 'BLD-EM-1',
        amenities: ['parking', 'Rooftop terrace'],
      }),
    );
    const ba = bFresh?.amenities ?? [];
    if (bFresh?.accountNumber !== 'BLD-AC-1' || ba.includes('parking') || !ba.includes('Rooftop terrace')) {
      failed += 1;
      console.log(`  ✗ building strip/persist wrong, account=${bFresh?.accountNumber} amenities=[${ba.join(', ')}]`);
    } else {
      ok('building amenities stripped vs property + meters persisted');
    }
  }

  console.log('— spreadsheet import (partial success)');
  const imp = await expectOk('import 3 rows → 1 created, 2 failed', () =>
    units.importUnits(actor, pid, [
      {
        unitRef: 'IMP-1',
        unitType: 'BED_1',
        buildingId: blkA?.id,
        accountNumber: 'AC-1',
        waterMeterNumber: 'WM-9',
        electricityMeterNumber: 'EM-9',
        defaultRent: 18000,
        amenities: ['Parking', 'Garden'],
      },
      { unitRef: 'IMP-1', unitType: 'BED_1' }, // duplicate ref within the file
      { unitRef: 'IMP-2', unitType: 'NOT_A_KIND' }, // invalid kind
    ]),
  );
  if (imp) {
    if (imp.success !== 1 || imp.failed !== 2 || !imp.errors[1] || !imp.errors[2] || imp.errors[0]) {
      failed += 1;
      console.log(`  ✗ unexpected import counts/errors: ${JSON.stringify(imp)}`);
    } else {
      ok('import partial success with per-row errors');
    }
  }
  const imported = await prisma.unit.findFirst({ where: { propertyId: pid, unitRef: 'IMP-1' } });
  if (!imported || imported.accountNumber !== 'AC-1' || imported.electricityMeterNumber !== 'EM-9') {
    failed += 1;
    console.log('  ✗ imported unit missing meter/account fields');
  } else if (imported.amenities.includes('Parking') || !imported.amenities.includes('Garden')) {
    failed += 1;
    console.log(`  ✗ imported amenities not stripped: [${imported.amenities.join(', ')}]`);
  } else {
    ok('imported unit persisted fields + stripped property amenities');
  }
  const impBad = await expectOk('import row with unknown building → per-row error', () =>
    units.importUnits(actor, pid, [
      { unitRef: 'IMP-3', unitType: 'BED_1', buildingId: 'does-not-exist' },
    ]),
  );
  if (impBad && (impBad.success !== 0 || impBad.failed !== 1 || !impBad.errors[0])) {
    failed += 1;
    console.log(`  ✗ unknown building should fail its row: ${JSON.stringify(impBad)}`);
  } else if (impBad) {
    ok('unknown building id → row error, no crash');
  }
  await expectStatus('import over row cap → 400', 400, () =>
    units.importUnits(actor, pid, Array.from({ length: 501 }, (_, i) => ({ unitRef: `CAP-${i}`, unitType: 'BED_1' }))),
  );
  if (stranger) {
    await expectStatus('stranger import → 404', 404, () =>
      units.importUnits(stranger, pid, [{ unitRef: 'H-1', unitType: 'BED_1' }]),
    );
  }

  console.log('— cross-tenant isolation');
  if (stranger) {
    // Out-of-scope property → 404 (never 403/empty — probing must learn nothing).
    await expectStatus('stranger list units → 404', 404, () => units.listUnits(stranger, pid));
    await expectStatus('stranger create building → 404', 404, () =>
      units.createBuilding(stranger, pid, { code: 'HACK' }),
    );
    const anyUnit = await prisma.unit.findFirst({ where: { propertyId: pid } });
    if (anyUnit) {
      await expectStatus('stranger update unit → 404', 404, () =>
        units.updateUnit(stranger, anyUnit.id, { label: 'hacked' }),
      );
      await expectStatus('stranger delete unit → 404', 404, () =>
        units.deleteUnit(stranger, anyUnit.id),
      );
    }
    const types = await units.listUnitTypes(stranger);
    if (types.some((t) => t.name === 'SMOKE 2Bed')) {
      failed += 1;
      console.log('  ✗ stranger saw foreign unit type');
    } else {
      ok('stranger unit-type list isolated');
    }
  } else {
    console.log('  (only one org in DB — skipped cross-org checks)');
  }
} finally {
  console.log('— cleanup');
  await prisma.auditLog.deleteMany({
    where: { organizationId: org.id, resourceId: pid },
  }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { organizationId: org.id, resourceType: 'UNIT' } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { organizationId: org.id, resourceType: 'BUILDING' } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { organizationId: org.id, resourceType: 'UNIT_TYPE' } }).catch(() => {});
  await prisma.unit.deleteMany({ where: { propertyId: pid } });
  await prisma.building.deleteMany({ where: { propertyId: pid } });
  await prisma.property.delete({ where: { id: pid } }).catch(() => {});
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}
