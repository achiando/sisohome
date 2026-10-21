import { db } from '@/lib/auth';
import { apiRoute, RouteError } from '@/lib/api-route';

/**
 * GET /api/organization/current — the caller's active organization profile.
 * Drives account-type-aware UI: `kind` (LANDLORD vs PM/…) selects the
 * property wizard steps; legal fields prefill the landlord auto-owner path;
 * address prefills new-property forms. Any active member may read their own
 * org's basic profile (no PII beyond the org record itself).
 */
export const GET = apiRoute({
  async handler({ ctx }) {
    if (!ctx.organizationId) throw new RouteError(400, 'No active organization');
    const org = await db.organization.findUnique({
      where: { id: ctx.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        kind: true,
        type: true,
        legalName: true,
        taxId: true,
        registrationNumber: true,
        email: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    });
    if (!org) throw new RouteError(404, 'Organization not found');
    return { organization: org };
  },
});
