import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as documents from '@/lib/domain/documents';

/**
 * POST /api/documents/[id]/versions — append a DocumentVersion and flip the
 * parent to the latest storage key. Prior versions are never mutated.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'document.upload',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const document = await documents.createDocumentVersion(actor, params.id, input);
    return ok({ document }, { status: 201 });
  },
});
