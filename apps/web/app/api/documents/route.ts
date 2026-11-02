import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as documents from '@/lib/domain/documents';

/**
 * GET /api/documents — document listing, two modes (roadmap Phase 4):
 *   - `?entityType=&entityId=` — one container's documents (resolved through
 *     the entity's scope; cross-tenant IDs 404);
 *   - no `entityId` — the org-wide library (own-org + in-scope property
 *     rows; `entityType` narrows it server-side).
 */
export const GET = apiRoute({
  permissions: 'document.read',
  async handler({ actor, query }) {
    const entityId = query.get('entityId');
    if (entityId) {
      const docs = await documents.listDocuments(actor, {
        entityType: query.get('entityType') ?? undefined,
        entityId,
      });
      return { documents: docs };
    }
    const docs = await documents.listLibraryDocuments(actor, {
      entityType: query.get('entityType') ?? undefined,
    });
    return { documents: docs };
  },
});

/** POST /api/documents — register an uploaded object in the container. */
export const POST = apiRoute({
  permissions: 'document.upload',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const doc = await documents.createDocument(actor, input);
    return ok({ document: doc }, { status: 201 });
  },
});
