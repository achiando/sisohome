import { apiRoute } from '@/lib/api-route';
import { listPaymentClaims } from '@/lib/domain/payment-claim';

/**
 * GET /api/payment-claims?status=PENDING — landlord/PM queue of portal
 * payment messages (PENDING first). Confirmed claims carry their paymentId;
 * pending ones are display-only until confirmed.
 */
export const GET = apiRoute({
  permissions: 'payment.list',
  async handler({ actor, query }) {
    return await listPaymentClaims(actor, { status: query.get('status') });
  },
});
