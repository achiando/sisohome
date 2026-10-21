import { authorizationService } from '@/lib/auth';
import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as application from '@/lib/domain/application';

/**
 * GET /api/applications/[id] — detail. Applicant PII is upgraded only when
 * the caller ALSO holds `tenant.read` (plan-slice-2 §2.2); otherwise the
 * applicant is contact-minimal.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'application.read',
  async handler({ actor, ctx, params }) {
    const granted = ctx.organizationId
      ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
      : [];
    const row = await application.getApplication(actor, params.id, {
      includeTenantPii: granted.includes('tenant.read' as never),
    });
    return { application: row };
  },
});

/** PATCH /api/applications/[id] — pre-decision edits only (409 after). */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'application.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await application.updateApplication(actor, params.id, input);
    return ok({ application: row });
  },
});
