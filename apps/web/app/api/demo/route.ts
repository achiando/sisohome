import { apiRoute, ok } from '@/lib/api-route';
import { db } from '@/lib/auth';
import { seedDemoData, wipeDemoData } from '@/lib/domain/demo-seed';

/**
 * /api/demo — the dev test-page's seed/wipe endpoint.
 *
 * Owner-gated (`organization.manage` exists in every kind's owner template).
 * POST seeds a kind-aware demo portfolio for the ACTIVE organization; DELETE
 * removes only demo-marked rows (`DEMO-*` codes/refs, `demo` tag, "Demo "
 * owner-party names). Never touches permissions, roles, or non-demo data.
 */

export const POST = apiRoute({
  permissions: 'organization.manage',
  async handler({ actor }) {
    const summary = await seedDemoData(actor);
    return ok({ seeded: summary });
  },
});

export const DELETE = apiRoute({
  permissions: 'organization.manage',
  async handler({ actor }) {
    const summary = await wipeDemoData(actor);
    if (summary.properties === 0 && summary.tenants === 0) {
      return ok({ wiped: summary, message: 'No demo data found' });
    }
    return ok({ wiped: summary });
  },
});

/** GET — report whether demo data currently exists (page boot state). */
export const GET = apiRoute({
  permissions: 'organization.manage',
  async handler({ actor }) {
    const org = await db.organization.findUnique({
      where: { id: actor.organizationId },
      select: { kind: true },
    });
    const properties = await db.property.count({
      where: {
        portfolioOrganizationId: actor.organizationId,
        tags: { has: 'demo' },
      },
    });
    if (properties === 0) return ok({ present: false, kind: org?.kind ?? null });
    const [units, tenants, leases] = await Promise.all([
      db.unit.count({
        where: { property: { portfolioOrganizationId: actor.organizationId, tags: { has: 'demo' } } },
      }),
      db.tenant.count({
        where: { organizationId: actor.organizationId, tenantRef: { startsWith: 'DEMO-' } },
      }),
      db.lease.count({
        where: { organizationId: actor.organizationId, leaseRef: { startsWith: 'DEMO-' } },
      }),
    ]);
    return ok({ present: true, kind: org?.kind ?? null, properties, units, tenants, leases });
  },
});
