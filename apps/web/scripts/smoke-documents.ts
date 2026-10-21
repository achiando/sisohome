/**
 * Slice 1d service smoke — documents (polymorphic, plan-slice-1 §3.4):
 * entity resolution scoping, cover winner, version chain, cross-tenant 404s,
 * orphan fallback.
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-documents.ts
 *
 * Prints one line per case; exits 1 on any failure.
 */

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import * as ownership from '@/lib/domain/ownership';
import * as agreements from '@/lib/domain/agreement';
import * as units from '@/lib/domain/unit';
import * as documents from '@/lib/domain/documents';

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

const managerOrg = await prisma.organization.create({
  data: {
    name: 'SMOKE DOC PM Co',
    slug: `smoke-doc-pm-${Date.now()}`,
    kind: 'PROPERTY_MANAGEMENT',
    status: 'ACTIVE',
  },
});
const managerActor = { userId: user.id, organizationId: managerOrg.id };

let pid = '';
let unitId = '';
let ownershipId = '';
let agreementId = '';
let partyId = '';

try {
  console.log('— setup: property, unit, party, ownership, agreement');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Documents Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 11',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property) throw new Error('setup failed');
  pid = property.id;

  const unit = await expectOk('create unit', () =>
    units.createUnit(actor, pid, { unitRef: 'SMOKE-DOC-1', unitType: 'BED_1' }),
  );
  if (!unit) throw new Error('setup failed');
  unitId = unit.id;

  const party = await expectOk('create owner party', () =>
    ownership.createOwnerParty(actor, { partyType: 'COMPANY', name: 'SMOKE Doc Owners Ltd' }),
  );
  if (!party) throw new Error('setup failed');
  partyId = party.id;

  const own = await expectOk('create ownership', () =>
    ownership.createOwnership(actor, { propertyId: pid }, { ownerPartyId: partyId, sharePercent: 100, startsAt: '2026-01-01' }),
  );
  if (!own) throw new Error('setup failed');
  ownershipId = own.id;

  const agreement = await expectOk('create agreement (owner side)', () =>
    agreements.createAgreement(actor, {
      propertyId: pid,
      managementOrganizationId: managerOrg.id,
      ownerPartyId: partyId,
    }),
  );
  if (!agreement) throw new Error('setup failed');
  agreementId = agreement.id;

  console.log('— PROPERTY entity: create, validation');
  const photo1 = await expectOk('create PHOTO #1 (cover)', () =>
    documents.createDocument(actor, {
      entityType: 'PROPERTY',
      entityId: pid,
      kind: 'PHOTO',
      storageKey: `properties/${pid}/photo1.jpg`,
      fileName: 'photo1.jpg',
      isCover: true,
      caption: 'Front elevation',
    }),
  );
  check('PHOTO #1 is cover', photo1?.isCover === true);

  const photo2 = await expectOk('create PHOTO #2 (cover)', () =>
    documents.createDocument(actor, {
      entityType: 'PROPERTY',
      entityId: pid,
      kind: 'PHOTO',
      storageKey: `properties/${pid}/photo2.jpg`,
      fileName: 'photo2.jpg',
      isCover: true,
    }),
  );
  check('PHOTO #2 takes cover', photo2?.isCover === true);

  const listed1 = await expectOk('list PROPERTY documents', () =>
    documents.listDocuments(actor, { entityType: 'PROPERTY', entityId: pid }),
  );
  check('list has both photos', (listed1?.length ?? 0) >= 2);
  check(
    'single cover winner (photo1 flipped off)',
    listed1?.find((d) => d.id === photo1!.id)?.isCover === false &&
      listed1?.find((d) => d.id === photo2!.id)?.isCover === true,
  );
  check('cover listed first', listed1?.[0]?.id === photo2!.id);

  await expectStatus('invalid kind → 400', 400, () =>
    documents.createDocument(actor, { entityType: 'PROPERTY', entityId: pid, kind: 'DIAGRAM', storageKey: 'x/y', fileName: 'y' }),
  );
  await expectStatus('missing storageKey → 400', 400, () =>
    documents.createDocument(actor, { entityType: 'PROPERTY', entityId: pid, kind: 'PHOTO', fileName: 'y' }),
  );
  await expectStatus('unsupported entityType (DEAL) → 400', 400, () =>
    documents.createDocument(actor, { entityType: 'DEAL', entityId: pid, kind: 'PHOTO', storageKey: 'x/y', fileName: 'y' }),
  );
  await expectStatus('missing entityId → 400', 400, () =>
    documents.listDocuments(actor, { entityType: 'PROPERTY' }),
  );
  await expectStatus('unknown property entity → 404', 404, () =>
    documents.listDocuments(actor, { entityType: 'PROPERTY', entityId: '00000000-0000-4000-8000-000000000000' }),
  );

  console.log('— cover patch (document.update semantics)');
  const patched = await expectOk('set PHOTO #1 back as cover', () =>
    documents.updateDocument(actor, photo1!.id, { isCover: true }),
  );
  check('patched cover true', patched?.isCover === true);
  const listed2 = await documents.listDocuments(actor, { entityType: 'PROPERTY', entityId: pid }).catch(() => null);
  check('PATCH flipped the previous cover', listed2?.find((d) => d.id === photo2!.id)?.isCover === false);

  const deed = await expectOk('create TITLE_DEED (file)', () =>
    documents.createDocument(actor, {
      entityType: 'PROPERTY',
      entityId: pid,
      kind: 'TITLE_DEED',
      storageKey: `properties/${pid}/title-deed.pdf`,
      fileName: 'title-deed.pdf',
      caption: 'LR 2098/1234',
    }),
  );
  if (!deed) throw new Error('setup failed');
  await expectStatus('isCover on non-photo → 400', 400, () =>
    documents.updateDocument(actor, deed.id, { isCover: true }),
  );
  const cap = await expectOk('patch caption + sortOrder', () =>
    documents.updateDocument(actor, deed.id, { caption: 'LR 2098/1234 rev2', sortOrder: 5 }),
  );
  check('caption updated', cap?.caption === 'LR 2098/1234 rev2');
  check('sortOrder updated', cap?.sortOrder === 5);
  await expectStatus('patch with no fields → 400', 400, () => documents.updateDocument(actor, deed.id, {}));

  console.log('— version chain (append-only)');
  check('baseline version row exists (v1)', (deed.versions?.length ?? 0) === 1);
  const v2 = await expectOk('append version 2', () =>
    documents.createDocumentVersion(actor, deed.id, {
      storageKey: `properties/${pid}/title-deed-v2.pdf`,
      fileName: 'title-deed-v2.pdf',
    }),
  );
  check('parent flips to v2', v2?.version === 2);
  check('latest storage key wins', v2?.storageKey.endsWith('title-deed-v2.pdf') === true);
  check('history keeps both rows', (v2?.versions?.length ?? 0) === 2);
  const v1Row = v2?.versions?.find((v) => v.version === 1);
  check('v1 row untouched', Boolean(v1Row) && v1Row!.fileName === 'title-deed.pdf');
  await expectStatus('append without storageKey → 400', 400, () =>
    documents.createDocumentVersion(actor, deed.id, { fileName: 'x' }),
  );

  console.log('— UNIT / OWNERSHIP / OWNER_PARTY entities');
  const unitDoc = await expectOk('create UNIT document', () =>
    documents.createDocument(actor, {
      entityType: 'UNIT',
      entityId: unitId,
      kind: 'PHOTO',
      storageKey: `properties/${pid}/units/SMOKE-DOC-1.jpg`,
      fileName: 'unit.jpg',
    }),
  );
  check(
    'UNIT doc org = portfolio org, propertyId denormalized',
    unitDoc?.organizationId === org.id && unitDoc?.propertyId === pid,
  );
  const ownDoc = await expectOk('create OWNERSHIP document', () =>
    documents.createDocument(actor, {
      entityType: 'OWNERSHIP',
      entityId: ownershipId,
      kind: 'STAMP_DUTY_RECEIPT',
      storageKey: `properties/${pid}/stamp.pdf`,
      fileName: 'stamp.pdf',
    }),
  );
  check('OWNERSHIP doc org = portfolio org', ownDoc?.organizationId === org.id);
  const partyDoc = await expectOk('create OWNER_PARTY document (flat org)', () =>
    documents.createDocument(actor, {
      entityType: 'OWNER_PARTY',
      entityId: partyId,
      kind: 'PHOTO_ID',
      storageKey: `parties/${partyId}/id.jpg`,
      fileName: 'id.jpg',
    }),
  );
  check('OWNER_PARTY doc org = own org, no propertyId', partyDoc?.organizationId === org.id && partyDoc?.propertyId === null);

  console.log('— AGREEMENT either-side');
  const mgrDoc = await expectOk('manager creates AGREEMENT document', () =>
    documents.createDocument(managerActor, {
      entityType: 'AGREEMENT',
      entityId: agreementId,
      kind: 'CONTRACT',
      storageKey: `properties/${pid}/agreement-signed.pdf`,
      fileName: 'agreement-signed.pdf',
    }),
  );
  check('AGREEMENT doc org = portfolio org (child rule)', mgrDoc?.organizationId === org.id);
  const mgrList = await expectOk('manager lists AGREEMENT documents', () =>
    documents.listDocuments(managerActor, { entityType: 'AGREEMENT', entityId: agreementId }),
  );
  check('either-side read works for manager', (mgrList?.length ?? 0) >= 1);

  console.log('— cross-tenant isolation');
  if (stranger) {
    await expectStatus('stranger lists PROPERTY documents → 404', 404, () =>
      documents.listDocuments(stranger, { entityType: 'PROPERTY', entityId: pid }),
    );
    await expectStatus('stranger creates PROPERTY document → 404', 404, () =>
      documents.createDocument(stranger, {
        entityType: 'PROPERTY',
        entityId: pid,
        kind: 'PHOTO',
        storageKey: 'evil/shot.jpg',
        fileName: 'shot.jpg',
      }),
    );
    await expectStatus('stranger lists UNIT documents → 404', 404, () =>
      documents.listDocuments(stranger, { entityType: 'UNIT', entityId: unitId }),
    );
    await expectStatus('stranger lists OWNERSHIP documents → 404', 404, () =>
      documents.listDocuments(stranger, { entityType: 'OWNERSHIP', entityId: ownershipId }),
    );
    await expectStatus('stranger lists AGREEMENT documents → 404', 404, () =>
      documents.listDocuments(stranger, { entityType: 'AGREEMENT', entityId: agreementId }),
    );
    await expectStatus('stranger lists OWNER_PARTY documents → 404', 404, () =>
      documents.listDocuments(stranger, { entityType: 'OWNER_PARTY', entityId: partyId }),
    );
    await expectStatus('stranger deletes own-org-invisible doc → 404', 404, () =>
      documents.deleteDocument(stranger, photo1!.id),
    );
    // Manager without scope (pre-approval): agreement is either-side, but the
    // property itself is not in manager scope yet → property docs 404.
    await expectStatus('manager (pre-approval) PROPERTY docs → 404', 404, () =>
      documents.listDocuments(managerActor, { entityType: 'PROPERTY', entityId: pid }),
    );
  } else {
    console.log('  ⚠ no second org — stranger cases skipped');
  }

  console.log('— orphan fallback (entity gone, own-org cleanup)');
  const orphan = await expectOk('create OWNERSHIP doc for orphan test', () =>
    documents.createDocument(actor, {
      entityType: 'OWNERSHIP',
      entityId: ownershipId,
      kind: 'CORRESPONDENCE',
      storageKey: `properties/${pid}/orphan-note.pdf`,
      fileName: 'orphan-note.pdf',
    }),
  );
  if (orphan) {
    await prisma.propertyOwnership.delete({ where: { id: ownershipId } }).catch(() => {});
    ownershipId = '';
    // Entity-gone lists 404 (nothing left to scope); cleanup still works by id.
    await expectStatus('list of orphaned entity → 404 (entity gone)', 404, () =>
      documents.listDocuments(actor, { entityType: 'OWNERSHIP', entityId: orphan.entityId }),
    );
    if (stranger) {
      await expectStatus('stranger delete orphan → 404', 404, () => documents.deleteDocument(stranger, orphan.id));
    }
    await expectOk('own-org deletes orphan', () => documents.deleteDocument(actor, orphan.id));
  }

  console.log('— delete + audit');
  const gone = await expectOk('delete TITLE_DEED', () => documents.deleteDocument(actor, deed.id));
  check('delete reports success', gone?.deleted === true);
  const afterDelete = await documents.listDocuments(actor, { entityType: 'PROPERTY', entityId: pid }).catch(() => null);
  check('deleted row gone from list', !afterDelete?.some((d) => d.id === deed.id));
  await expectStatus('delete unknown doc → 404', 404, () =>
    documents.deleteDocument(actor, '00000000-0000-4000-8000-000000000000'),
  );
  await expectStatus('delete unknown doc by id → 404', 404, () =>
    documents.updateDocument(actor, '00000000-0000-4000-8000-000000000000', { caption: 'x' }),
  );
  const auditCount = await prisma.auditLog.count({
    where: { organizationId: org.id, resourceType: 'DOCUMENT', action: 'document.upload' },
  });
  check('audit rows recorded under portfolio org', auditCount >= 4, `count=${auditCount}`);
} finally {
  console.log('— cleanup');
  await prisma.auditLog
    .deleteMany({
      where: {
        OR: [{ organizationId: org.id }, { organizationId: managerOrg.id }],
        resourceType: 'DOCUMENT',
      },
    })
    .catch(() => {});
  await prisma.propertyDocument
    .deleteMany({ where: { OR: [{ propertyId: pid }, { entityId: partyId }] } })
    .catch(() => {});
  if (agreementId) {
    await prisma.propertyManagementAgreement.delete({ where: { id: agreementId } }).catch(() => {});
  }
  await prisma.propertyOwnership.deleteMany({ where: { propertyId: pid } }).catch(() => {});
  await prisma.propertyOwnerParty.delete({ where: { id: partyId } }).catch(() => {});
  if (unitId) await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
  if (pid) await prisma.property.delete({ where: { id: pid } }).catch(() => {});
  await prisma.organization.delete({ where: { id: managerOrg.id } }).catch(() => {});
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}
