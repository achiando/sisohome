/**
 * People-plan smoke — Slice 5 public intake links (people plan §5):
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-intake.ts
 *
 * Covers: issue (payload + URL + audit), resolve context, tampered/expired
 * tokens, input validation, the happy submit (party in the ISSUING org,
 * application in the PORTFOLIO org, encrypted idNumber at rest, APPLICANT
 * flip), 409 on a second pre-decision application, tenant reuse (email
 * case-insensitive + phone) without PII mutation, scope guards (stranger
 * issue → 404, archived property → 410), unit-binding validation and the
 * deleted-unit fallback to a property-level application.
 *
 * Prints one line per case; exits 1 on any failure.
 */

import type { PropertyStatus } from '@workspace/database';

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';
import { issueIntakeLink, resolveIntake, submitIntake } from '@/lib/domain/intake';
import { issueIntakeToken, verifyIntakeToken } from '@/lib/intake-token';

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

const stamp = Date.now();
const smokeEmail = `smoke-intake-${stamp}@example.com`;
const smokePhone = '+254712345001';

let pid = '';
let pid2 = '';
let pid3 = '';
let unitId = '';
let unitBId = '';
let originalStatus: PropertyStatus = 'DRAFT';

try {
  console.log('— setup: properties + units');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Intake Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 90',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property) throw new Error('setup failed');
  pid = property.id;
  originalStatus = property.status;

  const unit = await expectOk('create vacant unit', () =>
    units.createUnit(actor, pid, {
      unitRef: 'SMOKE-INTAKE-A',
      unitType: 'BED_1',
      defaultRent: 25000,
      depositDefault: 2,
    }),
  );
  if (!unit) throw new Error('setup failed');
  unitId = unit.id;

  const property2 = await expectOk('create reuse property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Intake Reuse Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 91',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property2) throw new Error('setup failed');
  pid2 = property2.id;

  const property3 = await expectOk('create fallback property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Intake Fallback Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 92',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property3) throw new Error('setup failed');
  pid3 = property3.id;

  const unitB = await expectOk('create unit for delete-fallback', () =>
    units.createUnit(actor, pid3, { unitRef: 'SMOKE-INTAKE-B', unitType: 'BED_2', defaultRent: 30000 }),
  );
  if (!unitB) throw new Error('setup failed');
  unitBId = unitB.id;

  console.log('— issue');
  const issued = await expectOk('issue link (30d, unit-bound)', () =>
    issueIntakeLink(actor, pid, { unitId, expiresInDays: 30 }),
  );
  if (!issued) throw new Error('issue failed');

  const verified = verifyIntakeToken(issued.token);
  check('token verifies', verified.ok);
  if (verified.ok) {
    check('payload scopes property', verified.payload.p === pid, verified.payload.p);
    check('payload binds unit', verified.payload.u === unitId, verified.payload.u ?? 'none');
    check('payload issuing org', verified.payload.o === org.id, verified.payload.o);
    check('payload issuer user', verified.payload.by === user.id, verified.payload.by ?? 'none');
  }
  check('url points at /i/', issued.url.includes('/i/v1.'), issued.url);
  const expectedExpiry = Date.now() + 30 * 86_400_000;
  check(
    'expiry ≈ now + 30d',
    Math.abs(Date.parse(issued.expiresAt) - expectedExpiry) < 5 * 60_000,
    issued.expiresAt,
  );
  const issueAudit = await prisma.auditLog.findFirst({
    where: { action: 'property.intake_link', resourceId: pid },
    select: { id: true },
  });
  check('issue audited', Boolean(issueAudit));

  const defaulted = await expectOk('issue link (default TTL)', () => issueIntakeLink(actor, pid, {}));
  check('default TTL is 30d', defaulted?.ttlDays === 30, String(defaulted?.ttlDays));

  await expectStatus('issue expiresInDays 0 → 400', 400, () =>
    issueIntakeLink(actor, pid, { expiresInDays: 0 }),
  );
  await expectStatus('issue unknown unitId → 400', 400, () =>
    issueIntakeLink(actor, pid, { unitId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }),
  );
  if (stranger) {
    await expectStatus('issue by stranger org → 404', 404, () => issueIntakeLink(stranger, pid, {}));
  } else {
    console.log('  - skip stranger issue (no second org)');
  }

  console.log('— resolve');
  const context = await expectOk('resolve context', () => resolveIntake(issued.token));
  if (context) {
    check('context property name', context.property.name === 'SMOKE Intake Property', context.property.name);
    check('context locality', context.property.locality === 'Smokeville', context.property.locality);
    check('context unit present', Boolean(context.unit?.label), context.unit?.label ?? 'null');
    check('context unit rent', context.unit?.rent === 25000, String(context.unit?.rent));
    check('context expiry matches token', context.expiresAt === new Date(verified.ok ? verified.payload.x * 1000 : 0).toISOString());
  }

  console.log('— invalid / expired tokens');
  const last = issued.token.endsWith('A') ? 'B' : 'A';
  const tamperedSig = issued.token.slice(0, -1) + last;
  check('tampered signature rejected', verifyIntakeToken(tamperedSig).ok === false);
  await expectStatus('resolve tampered signature → 404', 404, () => resolveIntake(tamperedSig));

  const parts = issued.token.split('.');
  const body = Buffer.from(parts[1]!, 'base64url');
  body[0] = body[0]! ^ 0x01;
  const tamperedBody = `v1.${body.toString('base64url')}.${parts[2]}`;
  check('tampered payload rejected', verifyIntakeToken(tamperedBody).ok === false);
  await expectStatus('resolve tampered payload → 404', 404, () => resolveIntake(tamperedBody));

  await expectStatus('resolve empty token → 404', 404, () => resolveIntake(undefined));

  const expiredToken = issueIntakeToken({
    propertyId: pid,
    organizationId: org.id,
    issuedByUserId: user.id,
    ttlSeconds: -60,
  });
  const expiredCheck = verifyIntakeToken(expiredToken);
  check(
    'expired token reads expired',
    expiredCheck.ok === false && expiredCheck.reason === 'expired',
  );
  await expectStatus('resolve expired → 410', 410, () => resolveIntake(expiredToken));
  await expectStatus('submit expired → 410', 410, () => submitIntake(expiredToken, {}));

  console.log('— validation');
  await expectStatus('submit {} → 400', 400, () => submitIntake(issued.token, {}));
  await expectStatus('submit missing phone → 400', 400, () =>
    submitIntake(issued.token, { displayName: 'X Y' }),
  );
  await expectStatus('submit bad email → 400', 400, () =>
    submitIntake(issued.token, { displayName: 'X Y', phone: smokePhone, email: 'not-an-email' }),
  );

  console.log('— happy submit');
  const submitted = await expectOk('submit applicant', () =>
    submitIntake(issued.token, {
      displayName: 'SMOKE Intake Applicant',
      phone: smokePhone,
      email: smokeEmail,
      idType: 'NATIONAL_ID',
      idNumber: '12345678',
    }),
  );
  let tenantId = '';
  if (submitted) {
    const application = await prisma.rentalApplication.findUnique({
      where: { id: submitted.applicationId },
    });
    check('application SUBMITTED', application?.status === 'SUBMITTED', application?.status ?? 'missing');
    check(
      'application under portfolio org',
      application?.organizationId === org.id,
      application?.organizationId ?? 'missing',
    );
    check('application on property', application?.propertyId === pid);
    check('application bound to unit', application?.unitId === unitId, application?.unitId ?? 'null');
    tenantId = application?.applicantTenantId ?? '';

    const tenant = tenantId ? await prisma.tenant.findUnique({ where: { id: tenantId } }) : null;
    check('tenant exists', Boolean(tenant));
    check('tenant under ISSUING org', tenant?.organizationId === org.id, tenant?.organizationId ?? '');
    check('tenant flipped to APPLICANT', tenant?.status === 'APPLICANT', tenant?.status ?? '');
    check('tenant name created', tenant?.displayName === 'SMOKE Intake Applicant', tenant?.displayName ?? '');
    check(
      'idNumber encrypted at rest',
      typeof tenant?.idNumber === 'string' && tenant.idNumber.startsWith('v1.') && tenant.idNumber !== '12345678',
      tenant?.idNumber ?? 'null',
    );
    const submitAudit = await prisma.auditLog.findFirst({
      where: { action: 'application.intake_submit', resourceId: submitted.applicationId },
      select: { id: true },
    });
    check('submit audited', Boolean(submitAudit));
  }

  console.log('— duplicate pre-decision → 409');
  await expectStatus('second submit same property → 409', 409, () =>
    submitIntake(issued.token, {
      displayName: 'SMOKE Intake Applicant',
      phone: smokePhone,
      email: smokeEmail,
    }),
  );
  const dupCount = await prisma.tenant.count({
    where: { organizationId: org.id, email: { equals: smokeEmail, mode: 'insensitive' } },
  });
  check('no duplicate party on 409', dupCount === 1, String(dupCount));

  console.log('— reuse on another property (case-insensitive email)');
  const link2 = await expectOk('issue link for reuse property', () => issueIntakeLink(actor, pid2, {}));
  if (link2 && tenantId) {
    const reused = await expectOk('submit same email (uppercased) → reuse', () =>
      submitIntake(link2.token, {
        displayName: 'SMOKE Impostor Name',
        phone: '+254712345999',
        email: smokeEmail.toUpperCase(),
      }),
    );
    if (reused) {
      const app2 = await prisma.rentalApplication.findUnique({ where: { id: reused.applicationId } });
      check('reused party (same applicant)', app2?.applicantTenantId === tenantId, app2?.applicantTenantId ?? '');
      const tenantAfter = await prisma.tenant.findUnique({ where: { id: tenantId } });
      check(
        'public input did NOT mutate PII',
        tenantAfter?.displayName === 'SMOKE Intake Applicant',
        tenantAfter?.displayName ?? '',
      );
      check('second application SUBMITTED', app2?.status === 'SUBMITTED', app2?.status ?? '');

      console.log('— withdraw → phone-based reuse');
      await prisma.rentalApplication.update({
        where: { id: reused.applicationId },
        data: { status: 'WITHDRAWN' },
      });
      const phoneReuse = await expectOk('submit new email, same phone → reuse', () =>
        submitIntake(link2.token, {
          displayName: 'SMOKE Phone Person',
          phone: smokePhone,
          email: `smoke-phone-${stamp}@example.com`,
        }),
      );
      if (phoneReuse) {
        const app3 = await prisma.rentalApplication.findUnique({ where: { id: phoneReuse.applicationId } });
        check('phone reuse hits same party', app3?.applicantTenantId === tenantId, app3?.applicantTenantId ?? '');
        const tenantFinal = await prisma.tenant.findUnique({ where: { id: tenantId } });
        check(
          'phone reuse also leaves PII alone',
          tenantFinal?.displayName === 'SMOKE Intake Applicant',
          tenantFinal?.displayName ?? '',
        );
      }
    }
  }

  console.log('— archived property → 410 (scope re-check)');
  await prisma.property.update({ where: { id: pid }, data: { status: 'ARCHIVED' } });
  await expectStatus('resolve archived → 410', 410, () => resolveIntake(issued.token));
  await prisma.property.update({ where: { id: pid }, data: { status: originalStatus } });
  await expectOk('resolve restored again', () => resolveIntake(issued.token));

  console.log('— deleted unit → property-level fallback');
  const link3 = await expectOk('issue link bound to unit B', () =>
    issueIntakeLink(actor, pid3, { unitId: unitBId }),
  );
  if (link3) {
    await prisma.unit.deleteMany({ where: { id: unitBId } });
    unitBId = '';
    const fallback = await expectOk('submit after unit deletion → property-level app', () =>
      submitIntake(link3.token, {
        displayName: 'SMOKE Fallback Applicant',
        phone: '+254712345002',
        email: `smoke-fallback-${stamp}@example.com`,
      }),
    );
    if (fallback) {
      const app4 = await prisma.rentalApplication.findUnique({ where: { id: fallback.applicationId } });
      check('fallback app has no unit', app4?.unitId === null, app4?.unitId ?? 'not-null');
    }
  }
} finally {
  console.log('— cleanup');
  const pids = [pid, pid2, pid3].filter(Boolean);
  const apps = pids.length
    ? await prisma.rentalApplication.findMany({
        where: { propertyId: { in: pids } },
        select: { id: true, applicantTenantId: true },
      })
    : [];
  const tids = [...new Set(apps.map((a) => a.applicantTenantId))];
  if (apps.length) await prisma.rentalApplication.deleteMany({ where: { id: { in: apps.map((a) => a.id) } } });
  if (tids.length) await prisma.tenant.deleteMany({ where: { id: { in: tids } } });
  if (unitId) await prisma.unit.deleteMany({ where: { id: unitId } });
  if (unitBId) await prisma.unit.deleteMany({ where: { id: unitBId } });
  for (const p of [pid, pid2, pid3].filter(Boolean)) {
    await prisma.property.deleteMany({ where: { id: p } });
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
