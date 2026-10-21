/**
 * Demo-data seed smoke — runs seedDemoData → asserts kind-shaped rows →
 * wipe → asserts zero residue, for ALL FOUR organization kinds. Also
 * verifies media rows point at real public CDN URLs and the wipe never
 * touches non-demo rows.
 *
 *   cd apps/web && set -a && source .env && set +a \
 *     && ../../packages/database/node_modules/.bin/tsx scripts/smoke-demo-seed.ts
 *
 * Prints one line per case; exits 1 on any failure. Self-cleans the
 * scratch user + orgs.
 */

import { prisma, organizationService } from '@/lib/auth';
import { seedDemoData, wipeDemoData, DEMO_TAG, DEMO_REF_PREFIX } from '@/lib/domain/demo-seed';

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

const KINDS = ['LANDLORD', 'PROPERTY_MANAGEMENT', 'MAINTENANCE_COMPANY', 'MARKETING_AGENT'] as const;

async function main() {
  const cleanupUserIds: string[] = [];
  const cleanupOrgIds: string[] = [];
  const sentinelPropertyIds: string[] = [];

  try {
    // Scratch user (no password — we never sign in; services take userId directly)
    const user = await prisma.user.create({
      data: {
        email: `smoke-demo-${Date.now()}@example.com`,
        displayName: 'Smoke Demo User',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
    cleanupUserIds.push(user.id);

    for (const kind of KINDS) {
      console.log(`\n— ${kind}`);
      const org = await organizationService.createOrganization({
        userId: user.id,
        name: `Smoke Demo ${kind}`,
        kind,
      });
      cleanupOrgIds.push(org.id);
      const actor = { userId: user.id, organizationId: org.id };

      // sentinel: a real (non-demo) property + tenant that must survive wipe
      const sentinelProperty = await prisma.property.create({
        data: {
          portfolioOrganizationId: org.id,
          name: 'SENTINEL Keep-Me Property',
          category: 'RESIDENTIAL',
          propertyType: 'APARTMENT',
          addressLine1: 'Sentinel Lane 1',
          locality: 'Nairobi',
          country: 'KE',
        },
      });
      sentinelPropertyIds.push(sentinelProperty.id);
      const sentinelTenant = await prisma.tenant.create({
        data: {
          organizationId: org.id,
          displayName: 'Sentinel Tenant',
          email: `sentinel-${org.id.slice(0, 8)}@example.com`,
          status: 'ACTIVE',
        },
      });

      // ── seed ──────────────────────────────────────────────────────────────
      const summary = await seedDemoData(actor);
      check(`${kind}: summary.kind`, summary.kind === kind, summary.kind);
      check(`${kind}: 3 properties`, summary.properties === 3, String(summary.properties));
      check(`${kind}: 13 units`, summary.units === 13, String(summary.units));
      check(`${kind}: 5 tenants`, summary.tenants === 5, String(summary.tenants));
      check(`${kind}: 4 leases`, summary.leases === 4, String(summary.leases));
      check(`${kind}: 2 applications`, summary.applications === 2, String(summary.applications));

      // kind-shaped assertions
      const agreements = await prisma.propertyManagementAgreement.count({
        where: { organizationId: org.id, status: 'ACTIVE' },
      });
      if (kind === 'PROPERTY_MANAGEMENT' || kind === 'MAINTENANCE_COMPANY') {
        check(`${kind}: 3 ACTIVE agreements`, agreements === 3, String(agreements));
      } else {
        check(`${kind}: no agreements`, agreements === 0, String(agreements));
      }

      const staff = await prisma.propertyStaffAssignment.count({
        where: { organizationId: org.id, isActive: true },
      });
      check(
        `${kind}: caretaker ${kind === 'MAINTENANCE_COMPANY' ? 'present' : 'absent'}`,
        staff === (kind === 'MAINTENANCE_COMPANY' ? 1 : 0),
        String(staff),
      );

      const ownerParties = await prisma.propertyOwnerParty.count({
        where: { organizationId: org.id, name: { startsWith: 'Demo ' } },
      });
      if (kind === 'PROPERTY_MANAGEMENT') {
        check(`${kind}: 3 owner parties`, ownerParties === 3, String(ownerParties));
      } else if (kind === 'MAINTENANCE_COMPANY') {
        check(`${kind}: 2 owner parties`, ownerParties === 2, String(ownerParties));
      } else {
        check(`${kind}: 1 owner party`, ownerParties === 1, String(ownerParties));
      }

      // media: gallery photos must be real public CDN URLs
      const demoProps = await prisma.property.findMany({
        where: { portfolioOrganizationId: org.id, tags: { has: DEMO_TAG } },
        select: { id: true, videoUrl: true },
      });
      const photos = await prisma.propertyDocument.findMany({
        where: { propertyId: { in: demoProps.map((p) => p.id) }, kind: 'PHOTO' },
        select: { storageKey: true, isCover: true },
      });
      check(`${kind}: 12 gallery photos`, photos.length === 12, String(photos.length));
      check(
        `${kind}: all photos are https CDN URLs`,
        photos.every((p) => p.storageKey.startsWith('https://images.unsplash.com/')),
      );
      const covers = photos.filter((p) => p.isCover).length;
      check(`${kind}: exactly 3 covers (one per property)`, covers === 3, String(covers));
      const withVideo = demoProps.filter((p) => p.videoUrl?.startsWith('https://')).length;
      check(`${kind}: 1 property with tour video`, withVideo === 1, String(withVideo));

      // occupancy: B-301 + VILLA-1 under ACTIVE leases → OCCUPIED
      const occupied = await prisma.unit.count({
        where: { propertyId: { in: demoProps.map((p) => p.id) }, status: 'OCCUPIED' },
      });
      check(`${kind}: 2 units OCCUPIED (active leases)`, occupied === 2, String(occupied));
      const maintenance = await prisma.unit.count({
        where: { propertyId: { in: demoProps.map((p) => p.id) }, status: 'MAINTENANCE' },
      });
      check(`${kind}: 1 unit MAINTENANCE (preserved)`, maintenance === 1, String(maintenance));

      // re-seed is idempotent (wipe-then-seed inside)
      const again = await seedDemoData(actor);
      check(`${kind}: re-seed still 3 properties`, again.properties === 3, String(again.properties));
      const propCount = await prisma.property.count({
        where: { portfolioOrganizationId: org.id, tags: { has: DEMO_TAG } },
      });
      check(`${kind}: re-seed did not duplicate`, propCount === 3, String(propCount));

      // ── wipe ──────────────────────────────────────────────────────────────
      const wiped = await wipeDemoData(actor);
      check(`${kind}: wipe removed 3 properties`, wiped.properties === 3, String(wiped.properties));
      check(`${kind}: wipe removed 5 tenants`, wiped.tenants === 5, String(wiped.tenants));

      const leftoverProps = await prisma.property.count({
        where: { portfolioOrganizationId: org.id, tags: { has: DEMO_TAG } },
      });
      const leftoverTenants = await prisma.tenant.count({
        where: { organizationId: org.id, tenantRef: { startsWith: DEMO_REF_PREFIX } },
      });
      const leftoverLeases = await prisma.lease.count({
        where: { organizationId: org.id, leaseRef: { startsWith: DEMO_REF_PREFIX } },
      });
      const leftoverParties = await prisma.propertyOwnerParty.count({
        where: { organizationId: org.id, name: { startsWith: 'Demo ' } },
      });
      check(`${kind}: zero leftover demo properties`, leftoverProps === 0);
      check(`${kind}: zero leftover demo tenants`, leftoverTenants === 0);
      check(`${kind}: zero leftover demo leases`, leftoverLeases === 0);
      check(`${kind}: zero leftover demo owner parties`, leftoverParties === 0);

      // sentinel survival
      const sentinelProp = await prisma.property.findUnique({
        where: { id: sentinelProperty.id },
      });
      const sentinelT = await prisma.tenant.findUnique({ where: { id: sentinelTenant.id } });
      check(`${kind}: sentinel property survived wipe`, sentinelProp !== null);
      check(`${kind}: sentinel tenant survived wipe`, sentinelT !== null);

      // wipe on empty is a clean no-op
      const second = await wipeDemoData(actor);
      check(`${kind}: second wipe is a no-op`, second.properties === 0 && second.tenants === 0);

      // audit rows landed
      const audits = await prisma.auditLog.count({
        where: { actorUserId: user.id, organizationId: org.id, action: 'demo.seed' },
      });
      check(`${kind}: demo.seed audit rows`, audits >= 2, String(audits));
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
    else console.log('✅ DEMO SEED SMOKE OK');
  } finally {
    // Self-clean: demo rows are already wiped; drop sentinels, then every
    // org-scoped row in FK-safe order (Restrict everywhere), then orgs.
    if (cleanupOrgIds.length) {
      await prisma.property.deleteMany({ where: { id: { in: sentinelPropertyIds } } });
      await prisma.tenant.deleteMany({ where: { organizationId: { in: cleanupOrgIds } } });
      await prisma.propertyOwnerParty.deleteMany({ where: { organizationId: { in: cleanupOrgIds } } });
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: cleanupOrgIds } } });
      await prisma.organizationMember.deleteMany({ where: { organizationId: { in: cleanupOrgIds } } });
      await prisma.session.deleteMany({ where: { organizationId: { in: cleanupOrgIds } } });
      // template roles cascade from org (399/428); orgs delete last
      await prisma.organization.deleteMany({ where: { id: { in: cleanupOrgIds } } });
    }
    if (cleanupUserIds.length) {
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: cleanupUserIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: cleanupUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }
    console.log('🧹 cleaned up');
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
