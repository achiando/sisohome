import { apiRoute } from '@/lib/api-route';
import * as payments from '@/lib/domain/payment';

/** GET /api/payments/[id] — payment detail with allocations. */
export const GET = apiRoute<{ id: string }>({
  permissions: 'payment.read',
  async handler({ actor, params }) {
    const payment = await payments.getPayment(actor, params.id);
    return { payment };
  },
});
