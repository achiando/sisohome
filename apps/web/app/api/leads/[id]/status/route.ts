import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as sales from '@/lib/domain/sales';

/**
 * POST /api/leads/[id]/status — pipeline transition
 * (NEW→QUALIFIED→MATCHED→VIEWING→OFFERING→WON/LOST/WITHDRAWN). Body:
 * `{ to, nextActionAt? }` — non-terminal moves get follow-up guidance
 * (default: +3 days) when nextActionAt is omitted.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'lead.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const lead = await sales.setLeadStatus(actor, params.id, input);
    return ok({ lead });
  },
});
