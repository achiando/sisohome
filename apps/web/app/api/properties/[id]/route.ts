import { authorizationService } from '@/lib/auth';
import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as properties from '@/lib/domain/property';

/** GET /api/properties/[id] — scoped detail (agreements filtered either-side). */
export const GET = apiRoute<{ id: string }>({
  permissions: 'property.read',
  async handler({ actor, ctx, params }) {
    const granted = ctx.organizationId
      ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
      : [];
    const property = await properties.get(actor, params.id, {
      includeBalance: granted.includes('charge.list' as never),
    });
    return { property };
  },
});

/**
 * PATCH /api/properties/[id] — fetch → scope assert → updateMany keyed by
 * the property's own portfolio org (a managing org may edit; the row's home
 * org never changes). Allowlist lives in `parsePropertyInput`.
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'property.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const property = await properties.update(actor, params.id, input);
    return { property };
  },
});

/** DELETE /api/properties/[id] — drafts only, no children (else 409). */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'property.delete',
  async handler({ actor, params }) {
    await properties.remove(actor, params.id);
    return ok();
  },
});
