import { apiRoute } from '@/lib/api-route';
import * as agreements from '@/lib/domain/agreement';

/**
 * POST /api/agreements/[id]/approve — portfolio org only (service enforces;
 * `agreement.approve` is owner-held in every role template). DRAFT → ACTIVE
 * opens scope arm 2 the moment `startsAt ≤ now`.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'agreement.approve',
  async handler({ actor, params }) {
    const agreement = await agreements.approveAgreement(actor, params.id);
    return { agreement };
  },
});
