import { organizationService, prisma } from '@/lib/auth';
import { apiRoute, RouteError } from '@/lib/api-route';

/**
 * GET /api/organization — details of the session's ACTIVE organization
 * (name, kind, created). Organization context comes from the session, never
 * from client input.
 */
export const GET = apiRoute({
  permissions: 'organization.read',
  async handler({ actor }) {
    const organization = await prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: { id: true, name: true, kind: true, createdAt: true },
    });
    if (!organization) {
      throw new RouteError(404, 'Organization not found');
    }
    return {
      organization: {
        ...organization,
        createdAt: organization.createdAt.toISOString(),
      },
    };
  },
});

/**
 * PATCH /api/organization — rename the active organization.
 * Server-enforced: organization.update + active membership (apiRoute).
 */
export const PATCH = apiRoute({
  permissions: 'organization.update',
  async handler({ actor, body }) {
    const input = await body();
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!name) {
      throw new RouteError(400, 'Organization name is required');
    }
    if (name.length > 80) {
      throw new RouteError(400, 'Organization name must be 80 characters or fewer');
    }

    try {
      const organization = await organizationService.updateOrganization({
        organizationId: actor.organizationId,
        name,
      });
      return { organization };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update organization';
      throw new RouteError(500, message);
    }
  },
});
