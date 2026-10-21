import { apiRoute, RouteError } from '@/lib/api-route';
import * as documents from '@/lib/domain/documents';

/** PATCH /api/documents/[id] — caption / isCover / sortOrder (gallery ops). */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'document.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const document = await documents.updateDocument(actor, params.id, input);
    return { document };
  },
});

/** DELETE /api/documents/[id] — scoped hard delete (versions cascade). */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'document.delete',
  async handler({ actor, params }) {
    await documents.deleteDocument(actor, params.id);
    return { success: true };
  },
});
