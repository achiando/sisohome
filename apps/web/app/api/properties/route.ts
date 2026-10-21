import { authorizationService, db } from '@/lib/auth';
import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as properties from '@/lib/domain/property';

/**
 * GET /api/properties — properties reachable by the caller (scope arms:
 * own portfolio / agreement / staff / assigned job). Filter: q, status,
 * category, propertyType. MK orgs simply get [] (no scope arm applies).
 */
export const GET = apiRoute({
  permissions: 'property.list',
  async handler({ actor, ctx, query }) {
    const granted = ctx.organizationId
      ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
      : [];
    const list = await properties.list(actor, {
      q: query.get('q') ?? undefined,
      status: query.get('status') ?? undefined,
      category: query.get('category') ?? undefined,
      propertyType: query.get('propertyType') ?? undefined,
      includeBalance: granted.includes('charge.list' as never),
    });
    // Column gating: Owner/Agreement are hidden for LANDLORD workspaces
    // (client-side UX — the rows above are always same-scope data).
    const org = ctx.organizationId
      ? await db.organization.findUnique({ where: { id: ctx.organizationId }, select: { kind: true } })
      : null;
    return { properties: list, organizationKind: org?.kind ?? null };
  },
});

/**
 * POST /api/properties — create in the caller's OWN portfolio
 * (`portfolioOrganizationId = actor.organizationId`). Giving a PM/MM org
 * access is an agreement, never a create-for-another-org.
 *
 * Account-type contract (all four `OrganizationKind`s handled in
 * `properties.create`): landlord auto-links itself as owner; other kinds
 * MUST send an `ownership` payload → that needs `ownership.create`; an
 * `agreement` payload (PM/MM only) needs `agreement.create`. `apiRoute`'s
 * `permissions` is an ALL-of list on the route itself, so the two extra keys
 * are checked here against the granted set.
 */
export const POST = apiRoute({
  permissions: 'property.create',
  async handler({ actor, ctx, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');

    const hasOwnership = Boolean((input as Record<string, unknown>).ownership);
    const hasAgreement = Boolean((input as Record<string, unknown>).agreement);
    if (hasOwnership || hasAgreement) {
      const granted = ctx.organizationId
        ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
        : [];
      if (hasOwnership && !granted.includes('ownership.create' as never)) {
        throw new RouteError(403, 'You need the ownership.create permission to link an owner');
      }
      if (hasAgreement && !granted.includes('agreement.create' as never)) {
        throw new RouteError(403, 'You need the agreement.create permission to attach an agreement');
      }
    }

    const property = await properties.create(actor, input);
    return ok({ property }, { status: 201 });
  },
});
