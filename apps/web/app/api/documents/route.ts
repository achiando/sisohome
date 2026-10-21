import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as documents from '@/lib/domain/documents';

/**
 * GET /api/documents?entityType=&entityId= — list a container's documents
 * (resolved through the entity's scope; cross-tenant IDs 404).
 */
export const GET = apiRoute({
  permissions: 'document.read',
  async handler({ actor, query }) {
    const docs = await documents.listDocuments(actor, {
      entityType: query.get('entityType') ?? undefined,
      entityId: query.get('entityId') ?? undefined,
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
