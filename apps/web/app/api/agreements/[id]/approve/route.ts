import { apiRoute } from '@/lib/api-route';
import * as agreements from '@/lib/domain/agreement';

/**
 * POST /api/agreements/[id]/approve — portfolio org only (service enforces;
 * `agreement.approve` is owner-held in every role template). DRAFT → ACTIVE
 * opens scope arm 2 the moment `startsAt ≤ now`.
 *
 * Body (optional, People plan Slice 6): `{ template, typedName }` — the
 * type-name e-sign. Both arrive together from the Approve dialog; omitting
 * both keeps the legacy approve path (scripts/integrations).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'agreement.approve',
  async handler({ actor, params, body }) {
    const input = await body();
    const agreement = await agreements.approveAgreement(actor, params.id, input);
    return { agreement };
  },
});
