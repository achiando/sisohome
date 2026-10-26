/**
 * Slice 8 smoke — finances completion (plan-slice-8-finances §7):
 * balance fix (allocation + adjustments), manual charge + invoice minting,
 * dues register, adjustment lifecycle, rent roll, receipts, lease balances
 * and the overdue unit summary.
 *
 *   cd apps/web && ../../packages/database/node_modules/.bin/tsx scripts/smoke-finances.ts
 *
 * Prints one line per case; exits 1 on any failure.
 */

import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import * as charges from '@/lib/domain/charge';
import * as dues from '@/lib/domain/dues';
import * as adjustments from '@/lib/domain/adjustment';
import * as rentRoll from '@/lib/domain/rent-roll';
import * as receipts from '@/lib/domain/receipt';
import * as payments from '@/lib/domain/payment';
import * as leases from '@/lib/domain/lease';
import * as units from '@/lib/domain/unit';
import * as portal from '@/lib/domain/portal';
import * as billing from '@/lib/domain/billing-notice';
import * as ledgerAccounts from '@/lib/domain/ledger-account';
import { unitChargeSummary } from '@/lib/domain/monthly';

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

function isoDays(delta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

const INV_RE = /^INV-\d{4}-\d{4}$/;
const RE_RE = /^RE-\d{4}-\d{4}$/;

const org = await prisma.organization.findFirstOrThrow();
const otherOrg = await prisma.organization.findFirst({ where: { id: { not: org.id } } });
const user = await prisma.user.findFirstOrThrow();

const actor = { userId: user.id, organizationId: org.id };
const stranger = otherOrg ? { userId: user.id, organizationId: otherOrg.id } : null;

const cleanupCharges: string[] = [];
const cleanupPayments: string[] = [];
const cleanupAdjustments: string[] = [];
let pid = '';
let p2id = '';
let unitA = '';
let unitB = '';
let unitX = '';
let tenant1 = '';
let tenant2 = '';
let leaseId = '';

try {
  console.log('— setup: properties, units, tenants, ACTIVE lease');
  const property = await expectOk('create test property', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Finances Property',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 60',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property) throw new Error('setup failed');
  pid = property.id;

  const property2 = await expectOk('create second property (cross-property 400)', () =>
    prisma.property.create({
      data: {
        portfolioOrganizationId: org.id,
        name: 'SMOKE Finances Property 2',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        addressLine1: 'Smoke Street 61',
        locality: 'Smokeville',
        country: 'KE',
      },
    }),
  );
  if (!property2) throw new Error('setup failed');
  p2id = property2.id;

  const a = await expectOk('create unit A', () =>
    units.createUnit(actor, pid, { unitRef: 'SMOKE-FIN-A', unitType: 'BED_1', defaultRent: 25000 }),
  );
  const b = await expectOk('create unit B (vacant)', () =>
    units.createUnit(actor, pid, { unitRef: 'SMOKE-FIN-B', unitType: 'BED_1', defaultRent: 20000 }),
  );
  const x = await expectOk('create unit X on property 2', () =>
    units.createUnit(actor, p2id, { unitRef: 'SMOKE-FIN-X', unitType: 'BED_1', defaultRent: 10000 }),
  );
  if (!a || !b || !x) throw new Error('setup failed');
  unitA = a.id;
  unitB = b.id;
  unitX = x.id;

  const t1 = await expectOk('create tenant 1', () =>
    prisma.tenant.create({
      data: { organizationId: org.id, displayName: 'SMOKE Fin Tenant 1', tenantRef: `SMOKE-FIN1-${Date.now()}` },
    }),
  );
  const t2 = await expectOk('create tenant 2', () =>
    prisma.tenant.create({
      data: { organizationId: org.id, displayName: 'SMOKE Fin Tenant 2', tenantRef: `SMOKE-FIN2-${Date.now()}` },
    }),
  );
  if (!t1 || !t2) throw new Error('setup failed');
  tenant1 = t1.id;
  tenant2 = t2.id;

  await expectOk('ensurePropertyAccounts (RENT + UTILITIES)', () =>
    ledgerAccounts.ensurePropertyAccounts(actor, pid),
  );

  const lease = await expectOk('create + approve lease (past start → ACTIVE)', async () => {
    const created = await leases.createLease(actor, {
      propertyId: pid,
      leaseRef: `SMOKE-FIN-${Date.now()}`,
      status: 'PENDING_APPROVAL',
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
      units: [{ unitId: unitA, monthlyRent: 25000 }],
      parties: [{ tenantId: tenant1, relationship: 'PRIMARY' }],
    });
    return leases.approveLease(actor, created.id);
  });
  if (!lease) throw new Error('setup failed');
  leaseId = lease.id;
  check('lease is ACTIVE', lease.status === 'ACTIVE', lease.status);

  console.log('— manual charge: created, posted, invoice minted, audited');
  const chargeA = await expectOk('create manual charge (unit A, past due)', () =>
    charges.createManualCharge(actor, {
      propertyId: pid,
      unitId: unitA,
      tenantId: tenant1,
      leaseId,
      chargeType: 'RENT',
      title: 'Smoke rent charge',
      amount: 20000,
      dueDate: isoDays(-45),
    }),
  );
  if (!chargeA) throw new Error('setup failed');
  cleanupCharges.push(chargeA.id);
  check('manual charge has invoice number', INV_RE.test(chargeA.invoiceNumber ?? ''), chargeA.invoiceNumber ?? 'null');
  check('manual charge posted', chargeA.postedAt != null);
  check('manual charge balance 20000', chargeA.balance === '20000.00', chargeA.balance);
  const auditCount = await prisma.auditLog.count({
    where: { resourceId: chargeA.id, action: 'charge.create' },
  });
  check('charge.create audit row', auditCount >= 1, String(auditCount));

  console.log('— manual charge validation: cross-property, stranger, bad input');
  await expectStatus('cross-property unit → 400', 400, () =>
    charges.createManualCharge(actor, {
      propertyId: pid,
      unitId: unitX,
      chargeType: 'GARBAGE',
      amount: 100,
      dueDate: isoDays(1),
    }),
  );
  if (stranger) {
    await expectStatus('stranger property → 404', 404, () =>
      charges.createManualCharge(stranger, {
        propertyId: pid,
        unitId: unitA,
        chargeType: 'GARBAGE',
        amount: 100,
        dueDate: isoDays(1),
      }),
    );
  }
  await expectStatus('bad chargeType → 400', 400, () =>
    charges.createManualCharge(actor, {
      propertyId: pid,
      unitId: unitA,
      chargeType: 'BITCOIN',
      amount: 100,
      dueDate: isoDays(1),
    }),
  );
  await expectStatus('negative amount → 400', 400, () =>
    charges.createManualCharge(actor, {
      propertyId: pid,
      unitId: unitA,
      chargeType: 'GARBAGE',
      amount: -5,
      dueDate: isoDays(1),
    }),
  );

  console.log('— invoice: html, lazy mint for legacy charge, idempotent, stranger 404');
  const inv1 = await expectOk('invoiceCharge for minted charge', () =>
    charges.invoiceCharge(actor, chargeA.id),
  );
  if (inv1) {
    check('invoice number matches charge', inv1.invoiceNumber === chargeA.invoiceNumber, inv1.invoiceNumber);
    check('invoice html includes number', inv1.html.includes(inv1.invoiceNumber));
    check('invoice html includes balance', /Balance/i.test(inv1.html));
    const inv2 = await expectOk('second invoice fetch', () => charges.invoiceCharge(actor, chargeA.id));
    if (inv2) check('invoice number stable across fetches', inv2.invoiceNumber === inv1.invoiceNumber);
  }
  if (stranger) {
    await expectStatus('stranger invoice → 404', 404, () => charges.invoiceCharge(stranger, chargeA.id));
  }

  const legacy = await prisma.charge.create({
    data: {
      organizationId: org.id,
      propertyId: pid,
      unitId: unitA,
      tenantId: tenant1,
      chargeType: 'GARBAGE',
      title: 'Smoke legacy charge',
      amount: 3000,
      currency: 'KES',
      dueDate: new Date(`${isoDays(10)}T00:00:00.000Z`),
      postedAt: new Date(),
    },
  });
  cleanupCharges.push(legacy.id);
  check('legacy charge has no invoice number', legacy.invoiceNumber === null);
  const legacyInv = await expectOk('lazy mint for legacy charge', () => charges.invoiceCharge(actor, legacy.id));
  if (legacyInv) {
    check('legacy invoice number minted', INV_RE.test(legacyInv.invoiceNumber), legacyInv.invoiceNumber);
    const legacyInv2 = await expectOk('legacy second fetch', () => charges.invoiceCharge(actor, legacy.id));
    if (legacyInv2) check('legacy number stable', legacyInv2.invoiceNumber === legacyInv.invoiceNumber);
  }

  console.log('— payment allocation: balance = amount − allocated');
  const payment = await expectOk('record payment (8000)', () =>
    payments.createPayment(actor, {
      propertyId: pid,
      unitId: unitA,
      tenantId: tenant1,
      amount: 8000,
      method: 'MPESA',
      reference: 'SMOKE-FIN-1',
      accountType: 'RENT',
    }),
  );
  if (!payment) throw new Error('setup failed');
  cleanupPayments.push(payment.id);
  await expectOk('allocate 8000 to charge A', () =>
    prisma.paymentAllocation.create({
      data: { organizationId: org.id, paymentId: payment.id, chargeId: chargeA.id, amount: 8000 },
    }),
  );
  let chargeList = await expectOk('listCharges after allocation', () =>
    charges.listCharges(actor, { propertyId: pid }),
  );
  let rowA = chargeList?.find((c) => c.id === chargeA.id);
  check('charge A balance 12000 after allocation', rowA?.balance === '12000.00', rowA?.balance ?? 'missing');
  check('charge A allocatedTotal 8000', rowA?.allocatedTotal === '8000.00', rowA?.allocatedTotal ?? 'missing');
  check('charge A overdue flag (past due, open)', rowA?.overdue === true);
  check('charge A overdueDays ≈ 45', (rowA?.overdueDays ?? 0) >= 44 && (rowA?.overdueDays ?? 0) <= 46, String(rowA?.overdueDays));

  console.log('— adjustments: PENDING inert → APPROVED drops balance → 409 on re-decide');
  const adjApproved = await expectOk('create WAIVER 2000 (PENDING)', () =>
    adjustments.createAdjustment(actor, {
      chargeId: chargeA.id,
      type: 'WAIVER',
      amount: 2000,
      reason: 'Smoke partial waiver',
    }),
  );
  if (!adjApproved) throw new Error('setup failed');
  cleanupAdjustments.push(adjApproved.id);
  check('adjustment starts PENDING', adjApproved.status === 'PENDING', adjApproved.status);

  chargeList = await expectOk('listCharges after PENDING adjustment', () =>
    charges.listCharges(actor, { propertyId: pid }),
  );
  rowA = chargeList?.find((c) => c.id === chargeA.id);
  check('PENDING adjustment does not move balance', rowA?.balance === '12000.00', rowA?.balance ?? 'missing');
  check('PENDING not in adjustedTotal', rowA?.adjustedTotal === '0.00', rowA?.adjustedTotal ?? 'missing');

  const beforeBal = await charges.propertyBalances([{ id: pid, currency: 'KES' }]);
  const beforeAmount = Number(beforeBal.get(pid)?.amount ?? 0);

  await expectOk('approve adjustment', () => adjustments.decideAdjustment(actor, adjApproved.id, 'APPROVED'));

  const afterBal = await charges.propertyBalances([{ id: pid, currency: 'KES' }]);
  const afterAmount = Number(afterBal.get(pid)?.amount ?? 0);
  check(
    'propertyBalances drops by 2000 on approval',
    Math.abs(afterAmount - (beforeAmount - 2000)) < 0.01,
    `${beforeAmount} → ${afterAmount}`,
  );

  chargeList = await expectOk('listCharges after approval', () =>
    charges.listCharges(actor, { propertyId: pid }),
  );
  rowA = chargeList?.find((c) => c.id === chargeA.id);
  check('APPROVED adjustment drops balance to 10000', rowA?.balance === '10000.00', rowA?.balance ?? 'missing');
  check('adjustedTotal shows 2000', rowA?.adjustedTotal === '2000.00', rowA?.adjustedTotal ?? 'missing');

  await expectStatus('double approve → 409', 409, () =>
    adjustments.decideAdjustment(actor, adjApproved.id, 'APPROVED'),
  );

  const adjPending = await expectOk('create CREDIT 500 (stays PENDING)', () =>
    adjustments.createAdjustment(actor, {
      chargeId: chargeA.id,
      type: 'CREDIT',
      amount: 500,
      reason: 'Smoke pending credit',
    }),
  );
  if (adjPending) cleanupAdjustments.push(adjPending.id);
  chargeList = await expectOk('listCharges with PENDING credit', () =>
    charges.listCharges(actor, { propertyId: pid }),
  );
  rowA = chargeList?.find((c) => c.id === chargeA.id);
  check('second PENDING leaves balance at 10000', rowA?.balance === '10000.00', rowA?.balance ?? 'missing');

  await expectStatus('amount > open balance → 400', 400, () =>
    adjustments.createAdjustment(actor, {
      chargeId: chargeA.id,
      type: 'CREDIT',
      amount: 999999,
      reason: 'Smoke too large',
    }),
  );
  await expectStatus('missing reason → 400', 400, () =>
    adjustments.createAdjustment(actor, {
      chargeId: chargeA.id,
      type: 'CREDIT',
      amount: 100,
      reason: '',
    }),
  );

  const adjRejected = await expectOk('create WRITE_OFF 100 on legacy charge', () =>
    adjustments.createAdjustment(actor, {
      chargeId: legacy.id,
      type: 'WRITE_OFF',
      amount: 100,
      reason: 'Smoke rejected write-off',
    }),
  );
  if (adjRejected) {
    cleanupAdjustments.push(adjRejected.id);
    await expectOk('reject adjustment', () => adjustments.decideAdjustment(actor, adjRejected.id, 'REJECTED'));
    const list2 = await expectOk('listCharges after rejection', () => charges.listCharges(actor, { propertyId: pid }));
    const rowLegacy = list2?.find((c) => c.id === legacy.id);
    check('REJECTED adjustment is inert (balance 3000)', rowLegacy?.balance === '3000.00', rowLegacy?.balance ?? 'missing');
    check('REJECTED not in adjustedTotal', rowLegacy?.adjustedTotal === '0.00', rowLegacy?.adjustedTotal ?? 'missing');
  }

  if (stranger) {
    await expectStatus('stranger create adjustment → 404', 404, () =>
      adjustments.createAdjustment(stranger, {
        chargeId: chargeA.id,
        type: 'CREDIT',
        amount: 100,
        reason: 'Smoke stranger',
      }),
    );
    if (adjPending) {
      await expectStatus('stranger decide adjustment → 404', 404, () =>
        adjustments.decideAdjustment(stranger, adjPending.id, 'APPROVED'),
      );
    }
  }

  console.log('— second tenant charge (future due) for dues + rent roll');
  const chargeB2 = await expectOk('create manual charge (tenant 2, future due)', () =>
    charges.createManualCharge(actor, {
      propertyId: pid,
      unitId: unitA,
      tenantId: tenant2,
      chargeType: 'GARBAGE',
      title: 'Smoke waste charge',
      amount: 500,
      dueDate: isoDays(10),
    }),
  );
  if (chargeB2) cleanupCharges.push(chargeB2.id);

  console.log('— dues: totals, aging bucket, overdueOnly, scope 404');
  const duesResult = await expectOk('tenantDues', () => dues.tenantDues(actor, { propertyId: pid }));
  if (duesResult) {
    check('dues outstanding 13500', duesResult.totals.outstanding === '13500.00', duesResult.totals.outstanding);
    check('dues overdue 10000', duesResult.totals.overdue === '10000.00', duesResult.totals.overdue);
    check('dues overdueCount 1', duesResult.totals.overdueCount === 1, String(duesResult.totals.overdueCount));
    check('dues dueThisMonth 0', duesResult.totals.dueThisMonth === '0.00', duesResult.totals.dueThisMonth);
    check('dues pendingAdjustments ≥ 1', duesResult.totals.pendingAdjustments >= 1, String(duesResult.totals.pendingAdjustments));
    check('dues has 2 tenant rows', duesResult.rows.length === 2, String(duesResult.rows.length));
    const row1 = duesResult.rows.find((r) => r.tenantId === tenant1);
    const row2 = duesResult.rows.find((r) => r.tenantId === tenant2);
    check('tenant 1 open 13000', row1?.open === '13000.00', row1?.open ?? 'missing');
    check('tenant 1 overdue 10000', row1?.overdue === '10000.00', row1?.overdue ?? 'missing');
    check('tenant 1 bucket 31-60', row1?.bucket === '31-60', row1?.bucket ?? 'missing');
    check('tenant 1 ageDays ≈ 45', (row1?.ageDays ?? 0) >= 44 && (row1?.ageDays ?? 0) <= 46, String(row1?.ageDays));
    check('tenant 2 open 500, not overdue', row2?.open === '500.00' && row2?.overdue === '0.00', `${row2?.open}/${row2?.overdue}`);

    const overdueOnly = await expectOk('tenantDues overdueOnly', () =>
      dues.tenantDues(actor, { propertyId: pid, overdueOnly: true }),
    );
    if (overdueOnly) {
      check('overdueOnly drops settled-only tenants', overdueOnly.rows.length === 1, String(overdueOnly.rows.length));
      check('overdueOnly keeps tenant 1', overdueOnly.rows[0]?.tenantId === tenant1);
    }
  }
  if (stranger) {
    await expectStatus('stranger dues → 404', 404, () => dues.tenantDues(stranger, { propertyId: pid }));
  }

  console.log('— in-app overdue reminder (audit-backed, no email)');
  const remind1 = await expectOk('remindTenant (overdue tenant 1)', () =>
    dues.remindTenant(actor, { tenantId: tenant1 }),
  );
  if (remind1) {
    check('reminder snapshot has overdue > 0', Number(remind1.overdue) > 0.009, remind1.overdue);
    check('reminder covers >= 1 charge', remind1.overdueCount >= 1, String(remind1.overdueCount));
    const afterRemind = await expectOk('tenantDues after remind', () => dues.tenantDues(actor, { tenantId: tenant1 }));
    const r1 = afterRemind?.rows.find((r) => r.tenantId === tenant1);
    check('lastRemindedAt populated on dues row', Boolean(r1?.lastRemindedAt), r1?.lastRemindedAt ?? 'null');
  }
  await expectStatus('remind tenant 2 (not overdue) → 400', 400, () =>
    dues.remindTenant(actor, { tenantId: tenant2 }),
  );
  await expectStatus('remind without tenantId → 400', 400, () => dues.remindTenant(actor, {}));
  if (stranger) {
    await expectStatus('stranger remind → 404', 404, () => dues.remindTenant(stranger, { tenantId: tenant1 }));
  }

  console.log('— portal statement subtracts approved adjustments');
  const portalActor = { userId: 'smoke-portal-statement', tenantId: tenant1, organizationId: org.id };
  const stmt = await expectOk('getPortalStatement (tenant 1)', () => portal.getPortalStatement(portalActor));
  if (stmt) {
    check('statement includes approved adjustment (2000)', stmt.totals.adjusted.toString() === '2000', stmt.totals.adjusted.toString());
    const balance = stmt.totals.charges.minus(stmt.totals.paid).minus(stmt.totals.adjusted);
    check('statement balance = charges − paid − adjusted', stmt.totals.balance.equals(balance), stmt.totals.balance.toString());
    const stmtChargeA = stmt.charges.find((c) => c.id === chargeA.id);
    const orgList = await expectOk('org listCharges for cross-check', () => charges.listCharges(actor, { propertyId: pid }));
    const orgChargeA = orgList?.find((c) => c.id === chargeA.id);
    check(
      'portal outstanding = org balance (charge A)',
      Boolean(stmtChargeA) && Boolean(orgChargeA) && stmtChargeA!.outstanding.equals(Number(orgChargeA!.balance)),
      `portal=${stmtChargeA?.outstanding.toString()} org=${orgChargeA?.balance}`,
    );
    check('charge A outstanding reflects 2000 waiver', stmtChargeA ? Number(stmtChargeA.outstanding) === 10000 : false, stmtChargeA?.outstanding.toString() ?? 'missing');
  }

  console.log('— billing notice: email + portal NOTICE document (zero schema change)');
  const outboxDir = path.join(process.cwd(), '.email-outbox');
  const outboxCount = () => (fs.existsSync(outboxDir) ? fs.readdirSync(outboxDir).length : 0);

  const noEmail = await expectOk('sendBillingNotice (tenant has no email yet)', () =>
    billing.sendBillingNotice(actor, { unitIds: [unitA] }),
  );
  if (noEmail) {
    check('no-email unit skipped, nothing sent', noEmail.emailed === 0 && noEmail.skipped.some((s) => s.reason === 'no-email'), JSON.stringify(noEmail));
  }

  await prisma.tenant.update({ where: { id: tenant1 }, data: { email: `smoke-billing-${Date.now()}@example.test` } });
  const mailBefore = outboxCount();
  const notice1 = await expectOk('sendBillingNotice (unit A → email + portal doc)', () =>
    billing.sendBillingNotice(actor, { unitIds: [unitA] }),
  );
  if (notice1) {
    check('emailed 1, filed 1, no skips', notice1.emailed === 1 && notice1.filed === 1 && notice1.skipped.length === 0, JSON.stringify(notice1));
    check('outbox received the email', outboxCount() === mailBefore + 1, `${mailBefore} → ${outboxCount()}`);
    const doc = await prisma.propertyDocument.findFirst({
      where: { entityType: 'TENANT', entityId: tenant1, kind: 'NOTICE' },
      select: { id: true, caption: true, storageKey: true },
    });
    check('NOTICE document filed (TENANT + generated storageKey)', Boolean(doc) && doc!.storageKey.startsWith('generated/billing/'), doc ? `${doc.storageKey} · ${doc.caption}` : 'missing');
    const portalDocs = await expectOk('getPortalDocuments', () => portal.getPortalDocuments(portalActor));
    check('notice appears in tenant portal documents', Boolean(doc) && Boolean(portalDocs?.some((d) => d.id === doc!.id)), String(portalDocs?.length));
    const auditRow = await prisma.auditLog.findFirst({ where: { action: 'tenant.billing-notice', resourceId: tenant1 } });
    check('billing-notice audit row', Boolean(auditRow));
  }

  const bulk = await expectOk('sendBillingNotice bulk (A + vacant B + unknown id)', () =>
    billing.sendBillingNotice(actor, { unitIds: [unitA, unitB, 'smoke-missing-unit'] }),
  );
  if (bulk) {
    check('bulk: 1 emailed, 2 skipped', bulk.emailed === 1 && bulk.skipped.length === 2, JSON.stringify(bulk));
    const reasons = bulk.skipped.map((s) => s.reason).sort().join(',');
    check('skip reasons = not-found,vacant', reasons === 'not-found,vacant', reasons);
  }
  await expectStatus('sendBillingNotice all-unknown → 404', 404, () =>
    billing.sendBillingNotice(actor, { unitIds: ['smoke-missing-unit'] }),
  );
  if (stranger) {
    await expectStatus('stranger sendBillingNotice → 404', 404, () => billing.sendBillingNotice(stranger, { unitIds: [unitA] }));
  }

  console.log('— rent roll: occupancy, overdue state, building subtotals');
  const rr = await expectOk('rentRoll', () => rentRoll.rentRoll(actor, pid));
  if (rr) {
    check('rent roll 2 units, 1 occupied, 1 vacant', rr.totals.units === 2 && rr.totals.occupied === 1 && rr.totals.vacant === 1, JSON.stringify(rr.totals));
    check('rent roll monthlyRent 25000', Number(rr.totals.monthlyRent) === 25000, rr.totals.monthlyRent);
    check('rent roll open 13500', Number(rr.totals.openBalance) === 13500, rr.totals.openBalance);
    check('rent roll overdue 10000', Number(rr.totals.overdueBalance) === 10000, rr.totals.overdueBalance);
    const bldgRent = rr.buildings.reduce((s, b) => s + Number(b.monthlyRent), 0);
    const bldgOpen = rr.buildings.reduce((s, b) => s + Number(b.openBalance), 0);
    const bldgOverdue = rr.buildings.reduce((s, b) => s + Number(b.overdueBalance), 0);
    const bldgUnits = rr.buildings.reduce((s, b) => s + b.units, 0);
    check(
      'building subtotals sum to totals',
      bldgRent === Number(rr.totals.monthlyRent) &&
        bldgOpen === Number(rr.totals.openBalance) &&
        bldgOverdue === Number(rr.totals.overdueBalance) &&
        bldgUnits === rr.totals.units,
      JSON.stringify({ bldgRent, bldgOpen, bldgOverdue, bldgUnits }),
    );
    const rowAUnit = rr.rows.find((r) => r.unitId === unitA);
    const rowBUnit = rr.rows.find((r) => r.unitId === unitB);
    check('unit A OCCUPIED + OVERDUE', rowAUnit?.occupancy === 'OCCUPIED' && rowAUnit?.state === 'OVERDUE', `${rowAUnit?.occupancy}/${rowAUnit?.state}`);
    check('unit A tenant from lease', rowAUnit?.tenantName === 'SMOKE Fin Tenant 1', rowAUnit?.tenantName ?? 'missing');
    check('unit A rent 25000', Number(rowAUnit?.monthlyRent) === 25000, rowAUnit?.monthlyRent ?? 'missing');
    check('unit B VACANT state', rowBUnit?.occupancy === 'VACANT' && rowBUnit?.state === 'VACANT', `${rowBUnit?.occupancy}/${rowBUnit?.state}`);
  }
  if (stranger) {
    await expectStatus('stranger rent roll → 404', 404, () => rentRoll.rentRoll(stranger, pid));
  }

  console.log('— lease balances: open + overdue per lease');
  const lb = await charges.leaseBalances(actor, [leaseId]);
  const leaseBal = lb.get(leaseId);
  check('lease open 10000', leaseBal?.open === '10000.00', leaseBal?.open ?? 'missing');
  check('lease overdue 10000', leaseBal?.overdue === '10000.00', leaseBal?.overdue ?? 'missing');
  check('lease balance currency KES', leaseBal?.currency === 'KES', leaseBal?.currency ?? 'missing');

  console.log('— unit summary: overdue counts only past-due open charges');
  const summary = await unitChargeSummary(actor, [unitA, unitB]);
  const sumA = summary.get(unitA);
  check('unit A pending 13500', sumA?.pending === '13500.00', sumA?.pending ?? 'missing');
  check('unit A paid 8000', sumA?.paid === '8000.00', sumA?.paid ?? 'missing');
  check('unit A overdue 10000', sumA?.overdue === '10000.00', sumA?.overdue ?? 'missing');
  check('unit A overdueDays ≈ 45', (sumA?.overdueDays ?? 0) >= 44 && (sumA?.overdueDays ?? 0) <= 46, String(sumA?.overdueDays));
  check('unit B has no summary', summary.get(unitB) === undefined);

  console.log('— receipts: issue, register context, html, scope 404');
  const payment2 = await expectOk('record second payment (5000)', () =>
    payments.createPayment(actor, {
      propertyId: pid,
      unitId: unitA,
      tenantId: tenant1,
      amount: 5000,
      method: 'MPESA',
      reference: 'SMOKE-FIN-2',
      accountType: 'RENT',
    }),
  );
  if (!payment2) throw new Error('setup failed');
  cleanupPayments.push(payment2.id);
  const receipt = await expectOk('issueReceipt', () => receipts.issueReceipt(actor, payment2.id));
  if (receipt) {
    check('receipt number minted', RE_RE.test(receipt.receiptNumber ?? ''), receipt.receiptNumber ?? 'null');
    const register = await expectOk('listReceipts register', () => receipts.listReceipts(actor, { propertyId: pid }));
    const regRow = register?.find((r) => r.paymentId === payment2.id);
    check('register includes receipt with payment context', Boolean(regRow?.payment?.id), regRow ? 'no payment' : 'missing');
    check('register row currency KES', regRow?.currency === 'KES', regRow?.currency ?? 'missing');
    if (regRow) {
      const html = receipts.renderReceiptHtml(regRow);
      check('receipt html includes number', html.includes(regRow.receiptNumber ?? '@@'));
      check('receipt html mentions currency', html.includes('KES'));
    }
    if (stranger) {
      await expectStatus('stranger getReceipt → 404', 404, () => receipts.getReceipt(stranger, receipt.id));
      await expectStatus('stranger listReceipts scope → 404', 404, () =>
        receipts.listReceipts(stranger, { propertyId: pid }),
      );
    }
  }
} finally {
  console.log('— cleanup');
  for (const id of cleanupAdjustments) {
    await prisma.financialAdjustment.deleteMany({ where: { id } });
  }
  await prisma.propertyDocument.deleteMany({
    where: { entityType: 'TENANT', entityId: tenant1, kind: 'NOTICE' },
  });
  await prisma.auditLog.deleteMany({
    where: {
      action: { in: ['tenant.remind', 'tenant.billing-notice'] },
      resourceId: { in: [tenant1, tenant2].filter(Boolean) },
    },
  });
  await prisma.receipt.deleteMany({ where: { paymentId: { in: cleanupPayments } } });
  await prisma.paymentAllocation.deleteMany({
    where: { OR: [{ paymentId: { in: cleanupPayments } }, { chargeId: { in: cleanupCharges } }] },
  });
  await prisma.payment.deleteMany({ where: { id: { in: cleanupPayments } } });
  await prisma.charge.deleteMany({ where: { id: { in: cleanupCharges } } });
  if (leaseId) await prisma.lease.deleteMany({ where: { id: leaseId } });
  if (tenant1) await prisma.tenant.deleteMany({ where: { id: tenant1 } });
  if (tenant2) await prisma.tenant.deleteMany({ where: { id: tenant2 } });
  if (unitA) await prisma.unit.deleteMany({ where: { id: unitA } });
  if (unitB) await prisma.unit.deleteMany({ where: { id: unitB } });
  if (unitX) await prisma.unit.deleteMany({ where: { id: unitX } });
  if (p2id) {
    await prisma.ledgerAccount.deleteMany({ where: { propertyId: p2id } });
    await prisma.property.deleteMany({ where: { id: p2id } });
  }
  if (pid) {
    await prisma.ledgerAccount.deleteMany({ where: { propertyId: pid } });
    await prisma.property.deleteMany({ where: { id: pid } });
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
