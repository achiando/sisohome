import { apiRoute } from '@/lib/api-route';
import * as agreements from '@/lib/domain/agreement';

/**
 * POST /api/agreements/[id]/end — symmetric: owner OR manager may end
 * (both hold `agreement.update`). ACTIVE/SUSPENDED → ENDED.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'agreement.update',
  async handler({ actor, params }) {
    const agreement = await agreements.endAgreement(actor, params.id);
    return { agreement };
  },
});
