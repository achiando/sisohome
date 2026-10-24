/**
 * People-plan smoke — Slice 6 agreement templates + type-name e-sign (§5):
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-agreement-sign.ts
 *
 * Covers: the six built-in templates (2 tenant / 2 manager / 2 maintainer)
 * rendering with live entity data, preview scope + category guards and HTML
 * escaping, the type-name match rule, the signed evidence (PropertyDocument
 * + DocumentVersion + audit `sign` meta with sha256), the preserved legacy
 * no-body approve path (no evidence row), portfolio-only approval and
 * re-approve races. Prints one line per case; exits 1 on any failure.
 */

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';
import * as tenants from '@/lib/domain/tenant';
import * as leases from '@/lib/domain/lease';
import * as agreements from '@/lib/domain/agreement';
import * as ownership from '@/lib/domain/ownership';
import * as sign from '@/lib/domain/agreement-sign';
import { AGREEMENT_TEMPLATES, templatesForCategory } from '@/lib/domain/agreement-constants';
import {
  type LeaseTemplateContext,
  type ManagementTemplateContext,
  renderLeaseTemplate,
  renderManagementTemplate,
  sha256Hex,
} from '@/lib/domain/agreement-templates';

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
const signerLabel = user.displayName?.trim() || user.email;

const stamp = Date.now();

const managerOrg = await prisma.organization.create({
  data: { name: 'SMOKE Sign PM', slug: `smoke-sign-pm-${stamp}`, kind: 'PROPERTY_MANAGEMENT', status: 'ACTIVE' },
});
const maintOrg = await prisma.organization.create({
  data: { name: 'SMOKE Sign Maint', slug: `smoke-sign-mt-${stamp}`, kind: 'MAINTENANCE_COMPANY', status: 'ACTIVE' },
});
const managerActor = { userId: user.id, organizationId: managerOrg.id };
const maintActor = { userId: user.id, organizationId: maintOrg.id };

let pid = '';
const unitIds: string[] = [];
let tenantA = '';
let partyAId = '';
const leaseIds: string[] = [];
let leaseSign = '';
let leaseBad = '';
let agrMgr = '';
let agrMaint = '';

const XSS = '<script>window.pwned=1</script>';

try {
  console.log('— template constants');
  check('six templates total', AGREEMENT_TEMPLATES.length === 6, String(AGREEMENT_TEMPLATES.length));
  check('two tenant templates', templatesForCategory('TENANT').length === 2);
  check('two manager templates', templatesForCategory('MANAGER').length === 2);
  check('two maintainer templates', templatesForCategory('MAINTAINER').length === 2);
  check('ids unique', new Set(AGREEMENT_TEMPLATES.map((t) => t.id)).size === 6);

  console.log('— pure renders (fabricated contexts)');
  const leaseCtx: LeaseTemplateContext = {
    reference: 'SMK-001',
    tenureType: 'LEASE',
    property: { name: 'Render House', address: '1 Render Way', locality: 'Nairobi' },
    units: ['Unit 1'],
    unitRents: [{ label: 'Unit 1', rent: '45000' }],
    tenants: ['Render Tenant'],
    ownerName: 'Render Landlord',
    startsAt: new Date('2026-01-01'),
    endsAt: new Date('2026-12-31'),
    currency: 'KES',
    billingFrequency: 'MONTHLY',
    depositMonths: '2',
    noticeDays: 30,
    autoRenew: false,
    terms: null,
  };
  const mgmtCtx: ManagementTemplateContext = {
    reference: 'SMK-P01',
    property: { name: 'Render House', address: '1 Render Way', locality: 'Nairobi' },
    ownerName: 'Render Owner',
    managerName: 'Render Manager',
    startsAt: new Date('2026-01-01'),
    endsAt: null,
    scopeNotes: 'Schedule A: 8% of collected rent',
  };
  const sig = { signerLabel, signedAt: new Date('2026-10-24') };

  const rendered: Record<string, string> = {};
  for (const t of AGREEMENT_TEMPLATES) {
    const html = await expectOk(`render ${t.id}`, () =>
      t.category === 'TENANT'
        ? Promise.resolve(renderLeaseTemplate(t.id, leaseCtx, sig))
        : Promise.resolve(renderManagementTemplate(t.id, mgmtCtx, sig)),
    );
    if (html) rendered[t.id] = html;
  }
  check('all six rendered', Object.keys(rendered).length === 6);
  check('residential shows formatted rent', rendered['tenant-residential']?.includes('45,000') ?? false);
  check('residential shows signature date', rendered['tenant-residential']?.includes('Signed on 2026-10-24') ?? false);
  check('licence shows no-security-of-tenure clause', rendered['tenant-licence']?.includes('security of tenure') ?? false);
  check('full-service shows schedule notes', rendered['manager-full-service']?.includes('Schedule A') ?? false);
  check('retainer shows preventive maintenance', rendered['maintainer-retainer']?.includes('preventive maintenance') ?? false);
  check('adhoc shows work-order call-off', rendered['maintainer-adhoc']?.includes('work order') ?? false);
  check('sha256 is 64 hex chars', /^[0-9a-f]{64}$/.test(sha256Hex('x')));
  await expectStatus('lease render rejects manager template → 400', 400, () =>
    Promise.resolve(renderLeaseTemplate('manager-full-service', leaseCtx, sig)),
  );
  await expectStatus('management render rejects unknown template → 400', 400, () =>
    Promise.resolve(renderManagementTemplate('nope', mgmtCtx, sig)),
  );

  console.log('— setup: property, units, tenant, owner party');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Sign Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Sign Street 6',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property) throw new Error('setup failed');
  pid = property.id;

  for (const ref of ['SIGN-A', 'SIGN-B', 'SIGN-C', 'SIGN-D', 'SIGN-E']) {
    const u = await expectOk(`create unit ${ref}`, () =>
      units.createUnit(actor, pid, { unitRef: `SMOKE-${ref}`, unitType: 'BED_1' }),
    );
    if (!u) throw new Error('setup failed');
    unitIds.push(u.id);
  }

  const tA = await expectOk('create tenant', () =>
    tenants.createTenant(actor, { displayName: 'Smoke Sign Tenant', email: `smoke-sign-${stamp}@example.com` }),
  );
  if (!tA) throw new Error('setup failed');
  tenantA = tA.id;

  const partyA = await expectOk('create owner party', () =>
    ownership.createOwnerParty(actor, { partyType: 'PERSON', name: 'SMOKE Sign Owner' }),
  );
  if (!partyA) throw new Error('setup failed');
  partyAId = partyA.id;

  const baseLease = {
    propertyId: pid,
    status: 'PENDING_APPROVAL' as const,
    startsAt: '2026-01-01',
    endsAt: '2026-12-31',
    currency: 'KES',
    billingFrequency: 'MONTHLY',
    depositMonths: 2,
    noticeDays: 30,
    parties: [{ tenantId: tenantA, relationship: 'PRIMARY' as const }],
  };

  console.log('— lease previews');
  const l1 = await expectOk('create lease (unit A, will be signed)', () =>
    leases.createLease(actor, {
      ...baseLease,
      leaseRef: `SMOKE-SIGN-1-${stamp}`,
      terms: `Special clause ${XSS}`,
      units: [{ unitId: unitIds[0]!, monthlyRent: 45000 }],
    }),
  );
  if (!l1) throw new Error('setup failed');
  leaseSign = l1.id;
  leaseIds.push(l1.id);

  const preview = await expectOk('default preview → residential', () =>
    sign.previewLeaseAgreement(actor, leaseSign),
  );
  check('default template is residential', preview?.templateId === 'tenant-residential', preview?.templateId);
  check('tenant category list (2)', preview?.templates.length === 2);
  check('signerLabel = account label', preview?.signerLabel === signerLabel, preview?.signerLabel);
  check('preview shows property name', preview?.html.includes('SMOKE Sign Property') ?? false);
  check('preview shows tenant name', preview?.html.includes('Smoke Sign Tenant') ?? false);
  check('preview shows rent', preview?.html.includes('45,000') ?? false);
  check('preview shows owner org name', preview?.html.includes(org.name) ?? false);
  check('preview escapes terms HTML', preview?.html.includes('&lt;script&gt;') ?? false);
  check('preview has no raw script tag', !(preview?.html.includes(XSS) ?? true));

  const licPreview = await expectOk('explicit licence preview', () =>
    sign.previewLeaseAgreement(actor, leaseSign, 'tenant-licence'),
  );
  check('licence template echoed', licPreview?.templateId === 'tenant-licence');
  check('licence preview shows licence text', licPreview?.html.includes('security of tenure') ?? false);

  await expectStatus('preview unknown template → 400', 400, () =>
    sign.previewLeaseAgreement(actor, leaseSign, 'nope'),
  );
  await expectStatus('preview wrong category → 400', 400, () =>
    sign.previewLeaseAgreement(actor, leaseSign, 'manager-full-service'),
  );
  await expectStatus('stranger lease preview → 404', 404, () =>
    sign.previewLeaseAgreement(managerActor, leaseSign),
  );

  console.log('— lease approve: validation guards (single pending lease)');
  const l2 = await expectOk('create lease (unit B, negatives)', () =>
    leases.createLease(actor, {
      ...baseLease,
      leaseRef: `SMOKE-SIGN-2-${stamp}`,
      units: [{ unitId: unitIds[1]!, monthlyRent: 40000 }],
    }),
  );
  if (!l2) throw new Error('setup failed');
  leaseBad = l2.id;
  leaseIds.push(l2.id);

  await expectStatus('typedName mismatch → 400', 400, () =>
    leases.approveLease(actor, leaseBad, { template: 'tenant-residential', typedName: 'Not The User' }),
  );
  await expectStatus('template without typedName → 400', 400, () =>
    leases.approveLease(actor, leaseBad, { template: 'tenant-residential' }),
  );
  await expectStatus('typedName without template → 400', 400, () =>
    leases.approveLease(actor, leaseBad, { typedName: signerLabel }),
  );
  await expectStatus('wrong-category template → 400', 400, () =>
    leases.approveLease(actor, leaseBad, { template: 'maintainer-retainer', typedName: signerLabel }),
  );
  await expectStatus('unknown template → 400', 400, () =>
    leases.approveLease(actor, leaseBad, { template: 'nope', typedName: signerLabel }),
  );
  const badStill = await prisma.lease.findUnique({ where: { id: leaseBad }, select: { status: true } });
  check('failed signs leave lease pending', badStill?.status === 'PENDING_APPROVAL', badStill?.status);
  const badDocs = await prisma.propertyDocument.count({ where: { entityId: leaseBad } });
  check('failed signs create no document', badDocs === 0, `docs=${badDocs}`);
  if (org) {
    await expectStatus('stranger approve lease → 404', 404, () =>
      leases.approveLease(managerActor, leaseBad, { template: 'tenant-residential', typedName: signerLabel }),
    );
  }

  console.log('— lease approve: happy sign (case/space-tolerant typed name)');
  const l3 = await expectOk('sign & approve lease', () =>
    leases.approveLease(actor, leaseSign, {
      signedAt: '2026-10-24',
      template: 'tenant-residential',
      typedName: `   ${signerLabel.toUpperCase()}   `,
    }),
  );
  check('lease approved ACTIVE', l3?.status === 'ACTIVE', l3?.status);
  check('lease signedAt recorded', Boolean(l3?.signedAt));
  const signDoc = await prisma.propertyDocument.findFirst({
    where: { entityType: 'LEASE', entityId: leaseSign },
    include: { versions: true },
  });
  check('evidence document created', Boolean(signDoc));
  check('document kind TENANCY_AGREEMENT', signDoc?.kind === 'TENANCY_AGREEMENT');
  check('document org = portfolio org', signDoc?.organizationId === org.id);
  check('document mimeType text/html', signDoc?.mimeType === 'text/html');
  check('document fileName .html', signDoc?.fileName.endsWith('.html') ?? false);
  check('document storageKey generated pointer', signDoc?.storageKey.startsWith('generated/agreements/lease/') ?? false);
  check('caption carries signer + sha prefix', (signDoc?.caption ?? '').includes(`Signed by ${signerLabel}`) && (signDoc?.caption ?? '').includes('sha256'));
  check('baseline DocumentVersion v1', signDoc?.versions.length === 1 && signDoc.versions[0]?.version === 1);
  const approveAudit = await prisma.auditLog.findFirst({
    where: { action: 'lease.approve', resourceId: leaseSign },
    orderBy: { createdAt: 'desc' },
  });
  const meta = (approveAudit?.metadata ?? {}) as Record<string, unknown>;
  const signMeta = (meta.sign ?? {}) as Record<string, unknown>;
  check('audit carries sign meta', Boolean(meta.sign));
  check('audit template = tenant-residential', signMeta.template === 'tenant-residential', String(signMeta.template));
  check('audit typedName recorded', Boolean(signMeta.typedName));
  check('audit sha256 = 64 hex', /^[0-9a-f]{64}$/.test(String(signMeta.sha256)));
  check('audit documentId matches evidence row', signMeta.documentId === signDoc?.id);
  check('audit signerLabel matches', signMeta.signerLabel === signerLabel);
  await expectStatus('re-approve → 409', 409, () =>
    leases.approveLease(actor, leaseSign, { template: 'tenant-residential', typedName: signerLabel }),
  );
  const signDocCount = await prisma.propertyDocument.count({ where: { entityId: leaseSign } });
  check('still exactly one evidence document', signDocCount === 1, `docs=${signDocCount}`);

  console.log('— lease approve: legacy path preserved (no sign)');
  const l4 = await expectOk('create lease (unit C, legacy)', () =>
    leases.createLease(actor, {
      ...baseLease,
      leaseRef: `SMOKE-SIGN-4-${stamp}`,
      units: [{ unitId: unitIds[2]!, monthlyRent: 41000 }],
    }),
  );
  if (!l4) throw new Error('setup failed');
  leaseIds.push(l4.id);
  const legacy = await expectOk('legacy approve (signedAt only)', () =>
    leases.approveLease(actor, l4.id, { signedAt: '2026-10-01' }),
  );
  check('legacy approve still works', legacy?.status === 'ACTIVE', legacy?.status);
  const legacyDocs = await prisma.propertyDocument.count({ where: { entityId: l4.id } });
  check('legacy approve creates no document', legacyDocs === 0, `docs=${legacyDocs}`);
  const legacyAudit = await prisma.auditLog.findFirst({
    where: { action: 'lease.approve', resourceId: l4.id },
  });
  check('legacy audit has no sign meta', !((legacyAudit?.metadata ?? {}) as Record<string, unknown>).sign);

  console.log('— licence tenure default preview');
  const l5 = await expectOk('create licence lease (unit E)', () =>
    leases.createLease(actor, {
      ...baseLease,
      leaseRef: `SMOKE-SIGN-5-${stamp}`,
      tenureType: 'LICENSE',
      units: [{ unitId: unitIds[4]!, monthlyRent: 20000 }],
    }),
  );
  if (!l5) throw new Error('setup failed');
  leaseIds.push(l5.id);
  const licDefault = await expectOk('licence lease default preview', () =>
    sign.previewLeaseAgreement(actor, l5.id),
  );
  check('licence tenure defaults to licence template', licDefault?.templateId === 'tenant-licence', licDefault?.templateId);

  console.log('— agreement previews: category by managing org kind');
  const agr1 = await expectOk('owner proposes manager agreement', () =>
    agreements.createAgreement(actor, {
      propertyId: pid,
      managementOrganizationId: managerOrg.id,
      ownerPartyId: partyAId,
      startsAt: '2026-01-01',
      scope: { notes: 'SMOKE: full service, 8%' },
    }),
  );
  if (!agr1) throw new Error('setup failed');
  agrMgr = agr1.id;

  const mgrPreview = await expectOk('manager agreement preview', () =>
    sign.previewManagementAgreement(actor, agrMgr),
  );
  check('manager preview defaults to manager templates', mgrPreview?.templates.every((t) => t.id.startsWith('manager-')) ?? false);
  check('manager preview list = 2', mgrPreview?.templates.length === 2);
  check('manager preview shows manager org', mgrPreview?.html.includes('SMOKE Sign PM') ?? false);
  check('manager preview shows scope notes', mgrPreview?.html.includes('SMOKE: full service') ?? false);
  const mgrFull = await expectOk('explicit full-service preview', () =>
    sign.previewManagementAgreement(actor, agrMgr, 'manager-full-service'),
  );
  check('full-service shows services section', mgrFull?.html.includes('Scope of services') ?? false);
  const mgrLetting = await expectOk('explicit letting-only preview', () =>
    sign.previewManagementAgreement(actor, agrMgr, 'manager-letting-only'),
  );
  check('letting-only shows owner-retained ops', mgrLetting?.html.includes('day-to-day operations') ?? false);
  await expectStatus('maintainer template on manager agreement → 400', 400, () =>
    sign.previewManagementAgreement(actor, agrMgr, 'maintainer-retainer'),
  );
  await expectStatus('stranger agreement preview → 404', 404, () =>
    sign.previewManagementAgreement(maintActor, agrMgr),
  );
  const mgrSidePreview = await expectOk('manager-side preview (either-side read)', () =>
    sign.previewManagementAgreement(managerActor, agrMgr),
  );
  check('either side may preview', Boolean(mgrSidePreview?.html));

  const agr2 = await expectOk('owner proposes maintainer agreement', () =>
    agreements.createAgreement(actor, {
      propertyId: pid,
      managementOrganizationId: maintOrg.id,
      ownerPartyId: partyAId,
      startsAt: '2026-01-01',
      scope: { notes: 'SMOKE: quarterly service, call-out rates' },
    }),
  );
  if (!agr2) throw new Error('setup failed');
  agrMaint = agr2.id;
  const mtPreview = await expectOk('maintainer agreement preview', () =>
    sign.previewManagementAgreement(actor, agrMaint),
  );
  check('maintainer preview defaults to maintainer templates', mtPreview?.templates.every((t) => t.id.startsWith('maintainer-')) ?? false);
  check('maintainer preview list = 2', mtPreview?.templates.length === 2);
  await expectStatus('manager template on maintainer agreement → 400', 400, () =>
    sign.previewManagementAgreement(actor, agrMaint, 'manager-full-service'),
  );

  console.log('— agreement approve: guards');
  await expectStatus('typedName mismatch → 400 (stays DRAFT)', 400, () =>
    agreements.approveAgreement(actor, agrMgr, { template: 'manager-full-service', typedName: 'Wrong Person' }),
  );
  await expectStatus('wrong-category template → 400 (stays DRAFT)', 400, () =>
    agreements.approveAgreement(actor, agrMgr, { template: 'maintainer-retainer', typedName: signerLabel }),
  );
  const draftStill = await prisma.propertyManagementAgreement.findUnique({
    where: { id: agrMgr },
    select: { status: true },
  });
  check('failed signs leave agreement DRAFT', draftStill?.status === 'DRAFT', draftStill?.status);
  await expectStatus('manager-side approve → 403', 403, () =>
    agreements.approveAgreement(managerActor, agrMgr, {
      template: 'manager-full-service',
      typedName: signerLabel,
    }),
  );

  console.log('— agreement approve: happy signs');
  const approvedMgr = await expectOk('sign & approve manager agreement', () =>
    agreements.approveAgreement(actor, agrMgr, {
      template: 'manager-full-service',
      typedName: signerLabel,
    }),
  );
  check('manager agreement ACTIVE', approvedMgr?.status === 'ACTIVE', approvedMgr?.status);
  const agrDoc = await prisma.propertyDocument.findFirst({
    where: { entityType: 'AGREEMENT', entityId: agrMgr },
    include: { versions: true },
  });
  check('manager evidence document created', Boolean(agrDoc));
  check('document kind CONTRACT', agrDoc?.kind === 'CONTRACT');
  check('document storageKey management pointer', agrDoc?.storageKey.startsWith('generated/agreements/management/') ?? false);
  check('manager doc baseline version', agrDoc?.versions.length === 1);
  const agrAudit = await prisma.auditLog.findFirst({
    where: { action: 'agreement.approve', resourceId: agrMgr },
    orderBy: { createdAt: 'desc' },
  });
  const agrMeta = ((agrAudit?.metadata ?? {}) as Record<string, unknown>).sign as Record<string, unknown> | undefined;
  check('agreement audit carries sign meta', Boolean(agrMeta));
  check('agreement audit template matches', agrMeta?.template === 'manager-full-service', String(agrMeta?.template));
  await expectStatus('re-approve → 409', 409, () =>
    agreements.approveAgreement(actor, agrMgr, { template: 'manager-full-service', typedName: signerLabel }),
  );

  const approvedMt = await expectOk('sign & approve maintainer agreement', () =>
    agreements.approveAgreement(actor, agrMaint, { template: 'maintainer-retainer', typedName: signerLabel }),
  );
  check('maintainer agreement ACTIVE', approvedMt?.status === 'ACTIVE', approvedMt?.status);
  const mtDoc = await prisma.propertyDocument.findFirst({ where: { entityType: 'AGREEMENT', entityId: agrMaint } });
  check('maintainer evidence document created', Boolean(mtDoc));

  console.log('— agreement approve: legacy path preserved (no sign)');
  const agr3 = await expectOk('owner proposes second manager agreement', () =>
    agreements.createAgreement(actor, {
      propertyId: pid,
      managementOrganizationId: managerOrg.id,
      ownerPartyId: partyAId,
      startsAt: '2026-02-01',
      scope: { notes: 'SMOKE: legacy approve' },
    }),
  );
  if (!agr3) throw new Error('setup failed');
  const legacyAgr = await expectOk('legacy agreement approve (no body)', () =>
    agreements.approveAgreement(actor, agr3.id),
  );
  check('legacy agreement approve works', legacyAgr?.status === 'ACTIVE', legacyAgr?.status);
  const legacyAgrDocs = await prisma.propertyDocument.count({ where: { entityId: agr3.id } });
  check('legacy approve creates no agreement document', legacyAgrDocs === 0, `docs=${legacyAgrDocs}`);
} catch (err) {
  failed += 1;
  console.log(`  ✗ fatal — ${err instanceof Error ? err.message : err}`);
} finally {
  console.log('— cleanup');
  await prisma.auditLog
    .deleteMany({
      where: {
        OR: [{ organizationId: org.id }, { organizationId: managerOrg.id }, { organizationId: maintOrg.id }],
        resourceType: { in: ['LEASE', 'AGREEMENT', 'DOCUMENT', 'OWNER_PARTY', 'UNIT', 'PROPERTY'] },
      },
    })
    .catch(() => {});
  if (pid) {
    await prisma.propertyManagementAgreement.deleteMany({ where: { propertyId: pid } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { propertyId: pid } }).catch(() => {});
    await prisma.propertyDocument.deleteMany({ where: { propertyId: pid } }).catch(() => {});
    await prisma.propertyOwnerParty
      .deleteMany({ where: { organizationId: org.id, name: { startsWith: 'SMOKE Sign' } } })
      .catch(() => {});
    await prisma.unit.deleteMany({ where: { id: { in: unitIds } } }).catch(() => {});
    await prisma.property.delete({ where: { id: pid } }).catch(() => {});
  }
  if (tenantA) await prisma.tenant.delete({ where: { id: tenantA } }).catch(() => {});
  await prisma.organization.delete({ where: { id: managerOrg.id } }).catch(() => {});
  await prisma.organization.delete({ where: { id: maintOrg.id } }).catch(() => {});
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}
