/**
 * Roadmap Phase 4 service smoke — documents library (plan-roadmap §Phase 4):
 * org-wide listing over own-org + in-scope property rows, entity-type filter,
 * client-side kind/search filters, entity hrefs, MM/stranger scoping, and the
 * untouched container-mode contract.
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-documents-library.ts
 *
 * Prints one line per case; exits 1 on any failure.
 */

import { prisma } from '@/lib/auth';
import { seedOrgKindRoles } from '@workspace/database';
import { ensureOtherOrg } from './lib/ensure-other-org';
import { RouteError } from '@/lib/api-route';
import * as documents from '@/lib/domain/documents';
import {
  documentEntityHref,
  filterLibraryDocuments,
  type LibraryDocRow,
} from '@/lib/domain/document-library';

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

function must<T>(v: T | null, what: string): T {
  if (v === null) throw new Error(`setup failed: ${what}`);
  return v;
}

const DAY = 86_400_000;
const now = Date.now();

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

// MM org with an ACTIVE agreement on P1 (propertyScopeWhere arm 2).
const mmUser = await prisma.user.create({
  data: { email: `smoke-lib-mm-${Date.now()}@smoke.test`, displayName: 'SMOKE Lib MM' },
});
const mmOrg = await prisma.organization.create({
  data: {
    name: 'SMOKE Lib MM Co',
    slug: `smoke-lib-mm-${Date.now()}`,
    kind: 'MAINTENANCE_COMPANY',
    status: 'ACTIVE',
  },
});
await attachOwnerRole(mmOrg.id, mmUser.id, 'MAINTENANCE_COMPANY');
const mmActor = { userId: mmUser.id, organizationId: mmOrg.id };

// ── fixtures (all cleaned up in finally) ─────────────────────────────────────
let pid = '';
let pid2 = '';
let strangerPid = '';
let uid = '';
let ownerPartyId = '';
let agreementId = '';
let leaseId = '';
let woId = '';
let tenantId = '';
const docIds: string[] = [];
let strangerDocId = '';

const rowById = (rows: LibraryDocRow[], id: string) => rows.find((r) => r.id === id);

try {
  console.log('— setup: properties, entities, mixed documents');
  const property = must(
    await expectOk('create property P1', () =>
      prisma.property.create({
        data: {
          portfolioOrganizationId: org.id,
          name: 'SMOKE Lib Property',
          category: 'RESIDENTIAL',
          propertyType: 'APARTMENT',
          addressLine1: 'Smoke Lib Street 1',
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
          name: 'SMOKE Lib Other Property',
          category: 'RESIDENTIAL',
          propertyType: 'APARTMENT',
          addressLine1: 'Smoke Lib Street 2',
          locality: 'Smokeville',
          country: 'KE',
        },
      }),
    ),
    'property2',
  );
  pid2 = property2.id;

  const unit = must(
    await expectOk('create unit U1 on P1', () =>
      prisma.unit.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          unitRef: 'SMOKE-LIB-U1',
          label: 'LIB-1',
          unitType: 'BED_1',
        },
      }),
    ),
    'unit',
  );
  uid = unit.id;

  const lease = must(
    await expectOk('create ACTIVE lease on P1', () =>
      prisma.lease.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          status: 'ACTIVE',
          startsAt: new Date(now - 30 * DAY),
          endsAt: new Date(now + 60 * DAY),
          paymentDueDay: 1,
        },
      }),
    ),
    'lease',
  );
  leaseId = lease.id;

  const wo = must(
    await expectOk('create work order on P1', () =>
      prisma.workOrder.create({
        data: {
          organizationId: org.id,
          propertyId: pid,
          title: 'SMOKE LIB fixture job',
          status: 'SCHEDULED',
          scheduledFor: new Date(now + 3 * DAY),
        },
      }),
    ),
    'wo',
  );
  woId = wo.id;

  const tenant = must(
    await expectOk('create tenant', () =>
      prisma.tenant.create({
        data: {
          organizationId: org.id,
          displayName: 'SMOKE Lib Tenant',
          tenantRef: `SMOKE-LIB-T-${Date.now()}`,
        },
      }),
    ),
    'tenant',
  );
  tenantId = tenant.id;

  const ownerParty = must(
    await expectOk('create owner party for agreement', () =>
      prisma.propertyOwnerParty.create({
        data: { organizationId: org.id, partyType: 'PERSON', name: 'SMOKE Lib Owner' },
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

  const deed = must(
    await expectOk('create PROPERTY title deed', () =>
      documents.createDocument(actor, {
        entityType: 'PROPERTY',
        entityId: pid,
        kind: 'TITLE_DEED',
        storageKey: 'smoke-lib/deed.pdf',
        fileName: 'smoke-lib-deed.pdf',
        caption: 'LR 2098/555',
      }),
    ),
    'deed',
  );
  docIds.push(deed.id);

  const unitPhoto = must(
    await expectOk('create UNIT photo', () =>
      documents.createDocument(actor, {
        entityType: 'UNIT',
        entityId: uid,
        kind: 'PHOTO',
        storageKey: 'smoke-lib/unit.jpg',
        fileName: 'smoke-lib-unit.jpg',
        isCover: true,
      }),
    ),
    'unitPhoto',
  );
  docIds.push(unitPhoto.id);

  const leaseDoc = must(
    await expectOk('create LEASE tenancy agreement', () =>
      documents.createDocument(actor, {
        entityType: 'LEASE',
        entityId: leaseId,
        kind: 'TENANCY_AGREEMENT',
        storageKey: 'smoke-lib/lease.html',
        fileName: 'smoke-lib-lease.html',
      }),
    ),
    'leaseDoc',
  );
  docIds.push(leaseDoc.id);

  const woDoc = must(
    await expectOk('create WORK_ORDER contract', () =>
      documents.createDocument(actor, {
        entityType: 'WORK_ORDER',
        entityId: woId,
        kind: 'CONTRACT',
        storageKey: 'smoke-lib/quote.pdf',
        fileName: 'smoke-lib-quote.pdf',
      }),
    ),
    'woDoc',
  );
  docIds.push(woDoc.id);

  const tenantDoc = must(
    await expectOk('create TENANT photo id', () =>
      documents.createDocument(actor, {
        entityType: 'TENANT',
        entityId: tenantId,
        kind: 'PHOTO_ID',
        storageKey: 'smoke-lib/id.jpg',
        fileName: 'smoke-lib-id.jpg',
      }),
    ),
    'tenantDoc',
  );
  docIds.push(tenantDoc.id);

  const p2Doc = must(
    await expectOk('create P2 correspondence', () =>
      documents.createDocument(actor, {
        entityType: 'PROPERTY',
        entityId: pid2,
        kind: 'CORRESPONDENCE',
        storageKey: 'smoke-lib/p2-note.pdf',
        fileName: 'smoke-lib-p2-note.pdf',
      }),
    ),
    'p2Doc',
  );
  docIds.push(p2Doc.id);

  // Stranger's own property + doc (persistent other-org fixture).
  const strangerProperty = must(
    await expectOk('create stranger property', () =>
      prisma.property.create({
        data: {
          portfolioOrganizationId: otherOrg.id,
          name: 'SMOKE Lib Stranger Property',
          category: 'RESIDENTIAL',
          propertyType: 'APARTMENT',
          addressLine1: 'Smoke Lib Stranger Street',
          locality: 'Smokeville',
          country: 'KE',
        },
      }),
    ),
    'strangerProperty',
  );
  strangerPid = strangerProperty.id;
  const strangerDoc = must(
    await expectOk('create stranger document', () =>
      documents.createDocument(strangerActor, {
        entityType: 'PROPERTY',
        entityId: strangerPid,
        kind: 'CORRESPONDENCE',
        storageKey: 'smoke-lib/stranger.pdf',
        fileName: 'smoke-lib-stranger.pdf',
      }),
    ),
    'strangerDoc',
  );
  strangerDocId = strangerDoc.id;

  console.log('— owner library (org-wide listing)');
  const lib = must(await expectOk('listLibraryDocuments(owner)', () => documents.listLibraryDocuments(actor)), 'library');
  check('library has all 6 fixture docs', docIds.every((id) => lib.some((r) => r.id === id)));
  check('library excludes stranger doc', !lib.some((r) => r.id === strangerDocId));
  check('library size sane (<500 take cap)', lib.length < 500, `len=${lib.length}`);
  const deedRow = rowById(lib, deed.id);
  check('PROPERTY doc carries property context', deedRow?.property?.id === pid);
  check('TENANT doc has no property context', rowById(lib, tenantDoc.id)?.property === null);
  const times = lib.map((r) => new Date(r.createdAt).getTime());
  check('sorted createdAt desc', times.every((t, i) => i === 0 || times[i - 1]! >= t));

  console.log('— entity-type filter (server-side)');
  const unitsOnly = must(
    await expectOk('listLibraryDocuments(entityType=UNIT)', () => documents.listLibraryDocuments(actor, { entityType: 'UNIT' })),
    'unitsOnly',
  );
  check('UNIT filter returns the unit photo', unitsOnly.some((r) => r.id === unitPhoto.id));
  check('UNIT filter excludes lease doc', !unitsOnly.some((r) => r.id === leaseDoc.id));
  check('UNIT filter excludes property deed', !unitsOnly.some((r) => r.id === deed.id));
  const leasesOnly = must(
    await expectOk('listLibraryDocuments(entityType=LEASE)', () => documents.listLibraryDocuments(actor, { entityType: 'LEASE' })),
    'leasesOnly',
  );
  check('LEASE filter returns only the lease doc', leasesOnly.length === 1 && leasesOnly[0]?.id === leaseDoc.id, `len=${leasesOnly.length}`);
  await expectStatus('unsupported filter type (BUILDING) → 400', 400, () =>
    documents.listLibraryDocuments(actor, { entityType: 'BUILDING' }),
  );

  console.log('— container-mode contract untouched');
  const container = must(
    await expectOk('container list still works (entityType+entityId)', () =>
      documents.listDocuments(actor, { entityType: 'PROPERTY', entityId: pid }),
    ),
    'container',
  );
  check('container list has the title deed', container.some((d) => d.id === deed.id));
  await expectStatus('container without entityId → 400 (contract kept)', 400, () =>
    documents.listDocuments(actor, { entityType: 'PROPERTY' }),
  );
  await expectStatus('container without entityType → 400', 400, () =>
    documents.listDocuments(actor, { entityId: pid }),
  );
  await expectStatus('container with neither → 400', 400, () => documents.listDocuments(actor, {}));

  console.log('— client filters + search (pure helper)');
  const kindOnly = filterLibraryDocuments(lib, { kind: 'TENANCY_AGREEMENT' });
  check('kind filter returns only the lease doc', kindOnly.length === 1 && kindOnly[0]?.id === leaseDoc.id, `len=${kindOnly.length}`);
  const photos = filterLibraryDocuments(lib, { kind: 'PHOTO' });
  check('kind PHOTO cross-kind isolation', photos.length === 1 && photos[0]?.id === unitPhoto.id, `len=${photos.length}`);
  const byDeed = filterLibraryDocuments(lib, { q: 'DEED' });
  check('search DEED (case-insensitive) → title deed', byDeed.length === 1 && byDeed[0]?.id === deed.id, `len=${byDeed.length}`);
  const byCaption = filterLibraryDocuments(lib, { q: 'LR 2098' });
  check('search caption → title deed', byCaption.length === 1 && byCaption[0]?.id === deed.id, `len=${byCaption.length}`);
  const byProperty = filterLibraryDocuments(lib, { q: 'smoke lib property' });
  check('search property name → P1 docs only', byProperty.length === 4 && !byProperty.some((r) => r.id === p2Doc.id), `len=${byProperty.length}`);
  check('empty filter keeps everything', filterLibraryDocuments(lib, {}).length === lib.length);
  const combined = filterLibraryDocuments(lib, { entityType: 'LEASE', kind: 'PHOTO' });
  check('contradictory filters → empty', combined.length === 0);

  console.log('— entity hrefs (click-through targets)');
  check('PROPERTY href', documentEntityHref(deedRow!) === `/portfolio/${pid}`, documentEntityHref(deedRow!));
  const leaseRow = rowById(lib, leaseDoc.id)!;
  check('LEASE href', documentEntityHref(leaseRow) === `/leasing/leases/${leaseId}`, documentEntityHref(leaseRow));
  const unitRow = rowById(lib, unitPhoto.id)!;
  check('UNIT href', documentEntityHref(unitRow) === `/portfolio/${pid}/units/${uid}`, documentEntityHref(unitRow));
  const woRow = rowById(lib, woDoc.id)!;
  check('WORK_ORDER href', documentEntityHref(woRow) === `/maintenance/work-orders/${woId}`, documentEntityHref(woRow));
  const tenantRow = rowById(lib, tenantDoc.id)!;
  check('TENANT href', documentEntityHref(tenantRow) === `/people/tenants/${tenantId}`, documentEntityHref(tenantRow));
  check('every fixture href is a real path', docIds.every((id) => { const h = documentEntityHref(rowById(lib, id)!); return h.startsWith('/') && h !== '/documents'; }));

  console.log('— MM scoping (agreement property only)');
  const mmLib = must(await expectOk('listLibraryDocuments(MM)', () => documents.listLibraryDocuments(mmActor)), 'mmLib');
  check('MM sees P1 deed', mmLib.some((r) => r.id === deed.id));
  check('MM misses P2 doc', !mmLib.some((r) => r.id === p2Doc.id));
  check('MM misses flat tenant doc (other org, no property)', !mmLib.some((r) => r.id === tenantDoc.id));
  check('MM misses stranger doc', !mmLib.some((r) => r.id === strangerDocId));

  console.log('— stranger scoping');
  const strangerLib = must(
    await expectOk('listLibraryDocuments(stranger)', () => documents.listLibraryDocuments(strangerActor)),
    'strangerLib',
  );
  check('stranger sees own doc', strangerLib.some((r) => r.id === strangerDocId));
  check('stranger sees none of the owner fixtures', docIds.every((id) => !strangerLib.some((r) => r.id === id)));
} finally {
  console.log('— cleanup');
  await prisma.auditLog
    .deleteMany({ where: { resourceType: 'DOCUMENT', resourceId: { in: [...docIds, strangerDocId].filter(Boolean) } } })
    .catch(() => {});
  await prisma.propertyDocument
    .deleteMany({ where: { id: { in: [...docIds, strangerDocId].filter(Boolean) } } })
    .catch(() => {});
  if (agreementId) await prisma.propertyManagementAgreement.delete({ where: { id: agreementId } }).catch(() => {});
  if (ownerPartyId) await prisma.propertyOwnerParty.delete({ where: { id: ownerPartyId } }).catch(() => {});
  if (leaseId) await prisma.lease.delete({ where: { id: leaseId } }).catch(() => {});
  if (woId) await prisma.workOrder.delete({ where: { id: woId } }).catch(() => {});
  if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  if (uid) await prisma.unit.delete({ where: { id: uid } }).catch(() => {});
  if (strangerPid) await prisma.property.delete({ where: { id: strangerPid } }).catch(() => {});
  if (pid) await prisma.property.delete({ where: { id: pid } }).catch(() => {});
  if (pid2) await prisma.property.delete({ where: { id: pid2 } }).catch(() => {});
  await prisma.organization.delete({ where: { id: mmOrg.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: mmUser.id } }).catch(() => {});
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}
