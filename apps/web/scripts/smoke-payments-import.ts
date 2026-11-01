/**
 * Roadmap Phase 1 smoke — M-Pesa message import (payment-source abstraction):
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-payments-import.ts
 *
 * Covers: parse quality → matching (matched / ambiguous / unmatched) →
 * preview with zero writes → commit allocation + balance drop → receipt-code
 * dedupe on re-import → cross-org isolation → validation errors → audit row.
 *
 * Prints one line per case; exits 1 on any failure.
 */

import { prisma } from '@/lib/auth';
import { ensureOtherOrg } from './lib/ensure-other-org';
import { RouteError } from '@/lib/api-route';
import * as paymentImport from '@/lib/domain/payment-import';
import * as ledgerAccounts from '@/lib/domain/ledger-account';
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
const otherOrg = await ensureOtherOrg(org.id);
const user = await prisma.user.findFirstOrThrow();

const actor = { userId: user.id, organizationId: org.id };
const stranger = otherOrg ? { userId: user.id, organizationId: otherOrg.id } : null;

// Unique-per-run receipt codes + phone so a crashed prior run can't false-positive dedupe.
const tag = Date.now().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, 'A').slice(-7).padStart(7, 'A');
const C1 = `SM${tag}01`;
const C2 = `SM${tag}02`;
const C3 = `SM${tag}03`;
const C4 = `SM${tag}04`;
const tail = Date.now().toString().slice(-6).padStart(6, '1');
const phoneLocal = `0722${tail}`;
const phoneMsisdn = `254722${tail}`;
// Per-run unit ref: a half-cleaned prior run must never shadow this run's unit.
const UNIT_REF = `SMK-${tag}`;

const paste = [
  `${C1} Confirmed. Ksh15,000.00 received from ${phoneMsisdn} SMOKE IMPORT TENANT. New M-PESA balance is Ksh4,000.00. Transaction cost, Ksh0.00.`,
  `${C2} Confirmed. Ksh10,000.00 paid to SMOKE LANDLORD LTD for account ${UNIT_REF} on 20/10/26 at 9:00 AM. New M-PESA balance is Ksh1,000.00. Transaction cost, Ksh0.00.`,
  `${C3} Confirmed. Ksh50,000.00 paid to SMOKE LANDLORD LTD for account ${UNIT_REF} on 21/10/26 at 11:00 AM. New M-PESA balance is Ksh0.00. Transaction cost, Ksh0.00.`,
  `${C4} Confirmed. Ksh5,000.00 paid to SMOKE LANDLORD LTD for account NOPE-999 on 22/10/26 at 11:00 AM. New M-PESA balance is Ksh0.00. Transaction cost, Ksh0.00.`,
].join('\n');

let pid = '';
let unitId = '';
let tenantId = '';
let leaseId = '';
let chargeId = '';
const batchIds: string[] = [];

try {
  console.log('— setup: property + unit + tenant + ACTIVE lease + charge');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Import Property',
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

  const unit = await expectOk('create unit SMOKE-IMP-A', () =>
    units.createUnit(actor, pid, { unitRef: UNIT_REF, unitType: 'BED_1', defaultRent: 30000 }),
  );
  if (!unit) throw new Error('setup failed');
  unitId = unit.id;

  const tenant = await expectOk('create tenant with phone', () =>
    prisma.tenant.create({
      data: {
        organizationId: org.id,
        displayName: 'SMOKE Import Tenant',
        tenantRef: `SMOKE-IMP-${tag}`,
        phone: phoneLocal,
      },
    }),
  );
  if (!tenant) throw new Error('setup failed');
  tenantId = tenant.id;

  const draft = await expectOk('create lease (starts in the past)', () =>
    leases.createLease(actor, {
      propertyId: pid,
      leaseRef: `SMOKE-IMP-${tag}`,
      status: 'PENDING_APPROVAL',
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
      currency: 'KES',
      billingFrequency: 'MONTHLY',
      paymentDueDay: 5,
      units: [{ unitId, monthlyRent: 30000 }],
      parties: [{ tenantId, relationship: 'PRIMARY' }],
    }),
  );
  if (!draft) throw new Error('setup failed');
  leaseId = draft.id;

  const approved = await expectOk('approve lease → ACTIVE (past start)', () =>
    leases.approveLease(actor, leaseId, { signedAt: '2026-01-01' }),
  );
  check('lease is ACTIVE', approved?.status === 'ACTIVE', `status=${approved?.status}`);

  const pair = await expectOk('ensure ledger accounts', () =>
    ledgerAccounts.ensurePropertyAccounts(actor, pid),
  );
  check('ledger pair created', (pair?.length ?? 0) === 2);

  const charge = await expectOk('seed open RENT charge (billing period set)', () =>
    prisma.charge.create({
      data: {
        organizationId: org.id,
        propertyId: pid,
        unitId,
        tenantId,
        leaseId,
        chargeType: 'RENT',
        title: 'Smoke import rent charge',
        amount: 30000,
        currency: 'KES',
        dueDate: new Date('2026-01-05'),
        billingPeriodStart: new Date('2026-01-01'),
        billingPeriodEnd: new Date('2026-01-31'),
        postedAt: new Date(),
      },
    }),
  );
  if (!charge) throw new Error('setup failed');
  chargeId = charge.id;

  console.log('— preview: parse + match quality (zero writes)');
  const batchesBefore = await prisma.paymentImportBatch.count({ where: { organizationId: org.id } });
  const paymentsBefore = await prisma.payment.count({ where: { organizationId: org.id } });

  const preview = await expectOk('preview returns 4 rows', () =>
    paymentImport.previewImport(actor, { source: 'mpesa-sms', rawText: paste }),
  );
  if (!preview) throw new Error('preview failed');

  check('parsed exactly 4 rows', preview.rows.length === 4, `got ${preview.rows.length}`);
  const [r1, r2, r3, r4] = preview.rows;
  check('row1 phone signal → MATCHED @88 preChecked',
    r1?.status === 'MATCHED' && r1?.preChecked === true && r1?.confidence === 88,
    `status=${r1?.status} conf=${r1?.confidence}`);
  check('row1 matched our tenant', r1?.matched?.tenantId === tenantId, String(r1?.matched?.tenantId));
  check('row1 receipt code extracted', r1?.externalId === C1, String(r1?.externalId));
  check('row1 phone normalized', r1?.senderPhone === phoneMsisdn, String(r1?.senderPhone));
  check('row2 account signal → MATCHED @85 preChecked',
    r2?.status === 'MATCHED' && r2?.preChecked === true && r2?.confidence === 85,
    `status=${r2?.status} conf=${r2?.confidence}`);
  check('row2 matched via unit ref', r2?.matched?.tenantId === tenantId && r2?.matched?.unitRef === UNIT_REF);
  check('row2 paidAt parsed', Boolean(r2?.paidAt), String(r2?.paidAt));
  check('row3 amount over balance → AMBIGUOUS not preChecked',
    r3?.status === 'AMBIGUOUS' && r3?.preChecked === false,
    `status=${r3?.status}`);
  check('row4 unknown account → UNMATCHED',
    r4?.status === 'UNMATCHED' && r4?.preChecked === false && r4?.matched === null,
    `status=${r4?.status}`);
  check('summary counts',
    preview.summary.total === 4 && preview.summary.matched === 2 &&
    preview.summary.ambiguous === 1 && preview.summary.unmatched === 1 &&
    preview.summary.duplicate === 0,
    JSON.stringify(preview.summary));

  const batchesAfterPreview = await prisma.paymentImportBatch.count({ where: { organizationId: org.id } });
  const paymentsAfterPreview = await prisma.payment.count({ where: { organizationId: org.id } });
  check('preview wrote nothing (batches)', batchesAfterPreview === batchesBefore);
  check('preview wrote nothing (payments)', paymentsAfterPreview === paymentsBefore);

  console.log('— commit: checked rows allocate, unchecked stay put');
  const commit = await expectOk('commit applies 2 rows', () =>
    paymentImport.commitImport(actor, {
      source: 'mpesa-sms',
      rawText: paste,
      decisions: [
        { index: 0, checked: true }, // tenant from the match (no override)
        { index: 1, checked: true, tenantId, accountType: 'RENT' }, // explicit override
        { index: 2, checked: false },
        { index: 3, checked: false },
      ],
    }),
  );
  if (!commit) throw new Error('commit failed');
  batchIds.push(commit.batchId);

  check('applied=2 failed=0 duplicates=0 skipped=2',
    commit.applied === 2 && commit.failed === 0 && commit.duplicates === 0 && commit.skipped === 2,
    JSON.stringify({ applied: commit.applied, failed: commit.failed, dup: commit.duplicates, skipped: commit.skipped }));

  const batchRow = await prisma.paymentImportBatch.findUnique({ where: { id: commit.batchId } });
  check('batch marked appliedAt', Boolean(batchRow?.appliedAt));

  const imported = await prisma.payment.findMany({
    where: { organizationId: org.id, externalId: { in: [C1, C2] } },
    select: { id: true, externalId: true, source: true, method: true, amount: true },
  });
  check('2 payments with receipt codes', imported.length === 2, `got ${imported.length}`);
  check('payments stamped source=IMPORT + method=MPESA',
    imported.every((p) => p.source === 'IMPORT' && p.method === 'MPESA'));

  const allocSum = await prisma.paymentAllocation.aggregate({
    where: { paymentId: { in: imported.map((p) => p.id) } },
    _sum: { amount: true },
  });
  const allocated = Number(allocSum._sum.amount ?? 0);
  check('allocated 25,000 against the charge', allocated === 25000, `got ${allocated}`);

  const chargeAlloc = await prisma.paymentAllocation.aggregate({
    where: { chargeId },
    _sum: { amount: true },
  });
  check('charge balance dropped 30k → 5k',
    30000 - Number(chargeAlloc._sum.amount ?? 0) === 5000,
    `open=${30000 - Number(chargeAlloc._sum.amount ?? 0)}`);

  const batchRows = await prisma.paymentImportRow.findMany({
    where: { batchId: commit.batchId },
    select: { externalId: true, status: true },
  });
  const statusOf = (code: string) => batchRows.find((r) => r.externalId === code)?.status;
  check('row statuses APPLIED/APPLIED/AMBIGUOUS/UNMATCHED',
    statusOf(C1) === 'APPLIED' && statusOf(C2) === 'APPLIED' &&
    statusOf(C3) === 'AMBIGUOUS' && statusOf(C4) === 'UNMATCHED',
    JSON.stringify(batchRows.map((r) => [r.externalId, r.status])));
  check('unmatched row never got a payment',
    (await prisma.payment.count({ where: { organizationId: org.id, externalId: C4 } })) === 0);

  const auditCount = await prisma.auditLog.count({
    where: { organizationId: org.id, action: 'payment.import', resourceId: commit.batchId },
  });
  check('audit row for payment.import', auditCount >= 1, `count=${auditCount}`);

  console.log('— re-import: receipt codes dedupe');
  const preview2 = await expectOk('second preview', () =>
    paymentImport.previewImport(actor, { source: 'mpesa-sms', rawText: paste }),
  );
  if (!preview2) throw new Error('second preview failed');
  check('applied rows now DUPLICATE',
    preview2.rows[0]?.status === 'DUPLICATE' && preview2.rows[1]?.status === 'DUPLICATE',
    JSON.stringify(preview2.rows.map((r) => r.status)));
  check('duplicate attributed to payment',
    preview2.rows[0]?.duplicateOf === 'payment', String(preview2.rows[0]?.duplicateOf));
  check('never-applied rows not duplicate',
    preview2.rows[2]?.status === 'AMBIGUOUS' && preview2.rows[3]?.status === 'UNMATCHED',
    JSON.stringify(preview2.rows.map((r) => r.status)));
  check('summary duplicate=2', preview2.summary.duplicate === 2, String(preview2.summary.duplicate));

  const commit2 = await expectOk('second commit (re-checked duplicates)', () =>
    paymentImport.commitImport(actor, {
      source: 'mpesa-sms',
      rawText: paste,
      decisions: [
        { index: 0, checked: true },
        { index: 1, checked: true },
      ],
    }),
  );
  if (!commit2) throw new Error('second commit failed');
  batchIds.push(commit2.batchId);
  check('re-commit applies 0, counts 2 duplicates',
    commit2.applied === 0 && commit2.duplicates === 2,
    JSON.stringify({ applied: commit2.applied, dup: commit2.duplicates }));
  check('still exactly 2 payments for C1',
    (await prisma.payment.count({ where: { organizationId: org.id, externalId: { in: [C1, C2] } } })) === 2);

  console.log('— validation errors');
  await expectStatus('preview: empty paste → 400', 400, () =>
    paymentImport.previewImport(actor, { source: 'mpesa-sms', rawText: '   ' }),
  );
  await expectStatus('preview: unknown source → 400', 400, () =>
    paymentImport.previewImport(actor, { source: 'bogus-sms', rawText: paste }),
  );
  await expectStatus('commit: decision index out of range → 400', 400, () =>
    paymentImport.commitImport(actor, {
      source: 'mpesa-sms',
      rawText: paste,
      decisions: [{ index: 99, checked: true }],
    }),
  );
  await expectStatus('commit: decisions not an array → 400', 400, () =>
    paymentImport.commitImport(actor, { source: 'mpesa-sms', rawText: paste, decisions: 'nope' }),
  );

  console.log('— batch history');
  const history = await expectOk('listImports returns batches', () =>
    paymentImport.listImports(actor),
  );
  const b1 = history?.imports.find((i) => i.id === commit!.batchId);
  const b2 = history?.imports.find((i) => i.id === commit2!.batchId);
  check('batch1 history: applied 2 / total 4', b1?.applied === 2 && b1?.total === 4,
    JSON.stringify(b1));
  check('batch2 history: duplicate 2 / total 4', b2?.duplicate === 2 && b2?.total === 4,
    JSON.stringify(b2));

  if (stranger) {
    console.log('— cross-org isolation');
    const previewStranger = await expectOk('stranger preview (own org, no data)', () =>
      paymentImport.previewImport(stranger, { source: 'mpesa-sms', rawText: paste }),
    );
    if (previewStranger) {
      check('stranger sees no duplicates (dedupe is org-scoped)',
        previewStranger.summary.duplicate === 0,
        JSON.stringify(previewStranger.summary));
      check('stranger matches nothing',
        previewStranger.summary.matched === 0 && previewStranger.summary.ambiguous === 0,
        JSON.stringify(previewStranger.summary));
    }
  } else {
    console.log('— cross-org isolation SKIPPED (no second org)');
  }
} finally {
  console.log('— cleanup');
  if (batchIds.length > 0) {
    await prisma.paymentImportRow.deleteMany({ where: { batchId: { in: batchIds } } }).catch(() => {});
    await prisma.paymentImportBatch.deleteMany({ where: { id: { in: batchIds } } }).catch(() => {});
  }
  await prisma.auditLog
    .deleteMany({ where: { organizationId: org.id, action: 'payment.import' } })
    .catch(() => {});
  const payments = await prisma.payment
    .findMany({ where: { organizationId: org.id, externalId: { in: [C1, C2, C3, C4] } }, select: { id: true } })
    .catch(() => []);
  const paymentIds = payments.map((p) => p.id);
  if (paymentIds.length > 0) {
    await prisma.paymentAllocation.deleteMany({ where: { paymentId: { in: paymentIds } } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } }).catch(() => {});
  }
  if (pid) {
    await prisma.paymentAllocation.deleteMany({ where: { charge: { propertyId: pid } } }).catch(() => {});
    await prisma.charge.deleteMany({ where: { propertyId: pid } }).catch(() => {});
    await prisma.ledgerAccount.deleteMany({ where: { propertyId: pid } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { propertyId: pid } }).catch(() => {});
  }
  if (chargeId) await prisma.charge.deleteMany({ where: { id: chargeId } }).catch(() => {});
  if (tenantId) await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  if (unitId) await prisma.unit.deleteMany({ where: { id: unitId } }).catch(() => {});
  if (pid) await prisma.property.deleteMany({ where: { id: pid } }).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
