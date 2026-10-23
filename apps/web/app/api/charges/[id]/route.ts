import { apiRoute } from '@/lib/api-route';
import * as charges from '@/lib/domain/charge';

/** GET /api/charges/[id] — charge detail with allocations + payments trace. */
export const GET = apiRoute<{ id: string }>({
  permissions: 'charge.read',
  async handler({ actor, params }) {
    const charge = await charges.getCharge(actor, params.id);
    return { charge };
  },
});
