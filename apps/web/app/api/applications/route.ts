import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as application from '@/lib/domain/application';

/** GET /api/applications — screening queue (property-scoped). */
export const GET = apiRoute({
  permissions: 'application.list',
  async handler({ actor, query }) {
    const applications = await application.listApplications(actor, {
      status: query.get('status') ?? undefined,
      propertyId: query.get('propertyId') ?? undefined,
    });
    return { applications };
  },
});

/** POST /api/applications — capture an application (status=SUBMITTED). */
export const POST = apiRoute({
  permissions: 'application.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await application.createApplication(actor, input);
    return ok({ application: row }, { status: 201 });
  },
});
