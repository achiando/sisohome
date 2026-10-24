/**
 * Slice 4 smoke — field-level PII encryption (crypto-field):
 *
 *   cd apps/web && set -a && source .env && set +a \
 *     && ../../packages/database/node_modules/.bin/tsx scripts/smoke-crypto.ts
 *
 * Cases: envelope roundtrip · plaintext passthrough (lazy) · tampered
 * ciphertext throws · Tenant.idNumber encrypted at rest + decrypted on
 * read · legacy plaintext tenant row readable · re-PATCH idempotent ·
 * owner-party idNumber/homeAddress encrypted + decrypted · stranger 404.
 *
 * Prints one line per case; exits 1 on any failure.
 */

import { prisma } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import {
  decryptField,
  decryptFieldOutput,
  encryptField,
  encryptFieldInput,
  isEncrypted,
} from '@/lib/crypto-field';
import * as tenantDomain from '@/lib/domain/tenant';
import * as ownership from '@/lib/domain/ownership';

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

const org = await prisma.organization.findFirstOrThrow();
const otherOrg = await prisma.organization.findFirst({ where: { id: { not: org.id } } });
const user = await prisma.user.findFirstOrThrow();

const actor = { userId: user.id, organizationId: org.id };
const stranger = otherOrg ? { userId: user.id, organizationId: otherOrg.id } : null;

const cleanupTenantIds: string[] = [];
const cleanupPartyIds: string[] = [];

try {
  console.log('— crypto-field primitives');
  const ct = encryptField('29010101');
  check('encryptField produces v1 envelope', isEncrypted(ct));
  check('decryptField roundtrips', decryptField(ct) === '29010101');
  check('decryptField passes plaintext through (lazy)', decryptField('29010101') === '29010101');
  check('isEncrypted false on plaintext', !isEncrypted('29010101'));
  check('encryptFieldInput(undefined) → undefined', encryptFieldInput(undefined) === undefined);
  check('encryptFieldInput(null) → null', encryptFieldInput(null) === null);
  check("encryptFieldInput('') → null", encryptFieldInput('') === null);
  check('encryptFieldInput is idempotent on ciphertext', encryptFieldInput(ct) === ct);
  check('decryptFieldOutput(null) → null', decryptFieldOutput(null) === null);
  let threw = false;
  try {
    decryptField(`${ct.slice(0, -4)}AAAA`); // corrupt auth tag
  } catch {
    threw = true;
  }
  check('tampered ciphertext throws (fail closed)', threw);

  console.log('— Tenant.idNumber: encrypt at rest, decrypt on read');
  const t = await expectOk('create tenant with idNumber', () =>
    tenantDomain.createTenant(actor, {
      displayName: 'SMOKE Crypto Tenant',
      tenantRef: `SMOKE-CRYPTO-${Date.now()}`,
      idType: 'NATIONAL_ID',
      idNumber: '2901010101',
    }),
  );
  if (!t) throw new Error('setup failed');
  cleanupTenantIds.push(t.id);

  const rawRow = await prisma.tenant.findUniqueOrThrow({ where: { id: t.id } });
  check('idNumber ciphertext at rest', isEncrypted(rawRow.idNumber ?? ''));
  check('create response returns plaintext', t.idNumber === '2901010101');

  const profile = await expectOk('getTenant returns plaintext', () => tenantDomain.getTenant(actor, t.id));
  if (profile) check('getTenant decrypted idNumber', profile.idNumber === '2901010101');

  const updated = await expectOk('update idNumber', () =>
    tenantDomain.updateTenant(actor, t.id, { idNumber: '2902020202' }),
  );
  if (updated) check('update response plaintext', updated.idNumber === '2902020202');
  const rawRow2 = await prisma.tenant.findUniqueOrThrow({ where: { id: t.id } });
  check('re-encrypted after update', isEncrypted(rawRow2.idNumber ?? '') && rawRow2.idNumber !== rawRow.idNumber);

  // Idempotent PATCH: sending the SAME plaintext again re-encrypts (new IV) but decrypts equal.
  const again = await expectOk('re-PATCH same idNumber', () =>
    tenantDomain.updateTenant(actor, t.id, { idNumber: '2902020202' }),
  );
  if (again) check('same value after re-PATCH', again.idNumber === '2902020202');

  console.log('— legacy plaintext row (pre-slice data) still readable');
  const legacy = await expectOk('insert legacy plaintext tenant', () =>
    prisma.tenant.create({
      data: {
        organizationId: org.id,
        displayName: 'SMOKE Crypto Legacy',
        tenantRef: `SMOKE-CRYPTO-LEGACY-${Date.now()}`,
        idNumber: '12345678',
      },
    }),
  );
  if (legacy) {
    cleanupTenantIds.push(legacy.id);
    const legacyProfile = await expectOk('getTenant on legacy row', () => tenantDomain.getTenant(actor, legacy.id));
    if (legacyProfile) check('legacy plaintext passes through', legacyProfile.idNumber === '12345678');
    // Lazy migration: the row is sealed when idNumber is next WRITTEN
    // (unrelated updates leave it plaintext — parse only touches payload fields).
    await tenantDomain.updateTenant(actor, legacy.id, { idNumber: '12345678' });
    const sealed = await prisma.tenant.findUniqueOrThrow({ where: { id: legacy.id } });
    check('legacy row sealed when idNumber rewritten', isEncrypted(sealed.idNumber ?? ''));
    const stillReadable = await tenantDomain.getTenant(actor, legacy.id);
    check('sealed legacy still decrypts', stillReadable.idNumber === '12345678');
  }

  console.log('— stranger cannot read tenant');
  if (stranger) {
    await expectStatus('stranger getTenant → 404', 404, () => tenantDomain.getTenant(stranger, t.id));
  } else {
    ok('stranger skipped (single-org env)');
  }

  console.log('— owner party: idNumber + homeAddress encrypted');
  const party = await expectOk('create owner party with PII', () =>
    ownership.createOwnerParty(actor, {
      partyType: 'PERSON',
      name: 'SMOKE Crypto Owner',
      idType: 'NATIONAL_ID',
      idNumber: '30030303',
      homeAddress: '12 Crypto Lane, Nairobi',
    }),
  );
  if (!party) throw new Error('setup failed');
  cleanupPartyIds.push(party.id);

  const rawParty = await prisma.propertyOwnerParty.findUniqueOrThrow({ where: { id: party.id } });
  check('owner idNumber ciphertext at rest', isEncrypted(rawParty.idNumber ?? ''));
  check('owner homeAddress ciphertext at rest', isEncrypted(rawParty.homeAddress ?? ''));
  check('create response plaintext idNumber', party.idNumber === '30030303');
  check('create response plaintext homeAddress', party.homeAddress === '12 Crypto Lane, Nairobi');

  const fetched = await expectOk('getOwnerParty decrypts', () => ownership.getOwnerParty(actor, party.id));
  if (fetched) {
    check('getOwnerParty idNumber', fetched.idNumber === '30030303');
    check('getOwnerParty homeAddress', fetched.homeAddress === '12 Crypto Lane, Nairobi');
  }

  const listed = await expectOk('listOwnerParties decrypts', () => ownership.listOwnerParties(actor, { q: 'SMOKE Crypto Owner' }));
  if (listed) {
    const row = listed.find((p) => p.id === party.id);
    check('list row idNumber plaintext', row?.idNumber === '30030303');
    check('list row homeAddress plaintext', row?.homeAddress === '12 Crypto Lane, Nairobi');
  }

  const partyUpdated = await expectOk('update owner party idNumber', () =>
    ownership.updateOwnerParty(actor, party.id, { idNumber: '40040404' }),
  );
  if (partyUpdated) check('update response plaintext', partyUpdated.idNumber === '40040404');
  const rawParty2 = await prisma.propertyOwnerParty.findUniqueOrThrow({ where: { id: party.id } });
  check('owner idNumber re-encrypted', isEncrypted(rawParty2.idNumber ?? ''));

  if (stranger) {
    await expectStatus('stranger getOwnerParty → 404', 404, () => ownership.getOwnerParty(stranger, party.id));
  }
} finally {
  console.log('— cleanup');
  for (const id of cleanupTenantIds) {
    await prisma.tenant.delete({ where: { id } }).catch(() => undefined);
  }
  for (const id of cleanupPartyIds) {
    await prisma.propertyOwnerParty.delete({ where: { id } }).catch(() => undefined);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
