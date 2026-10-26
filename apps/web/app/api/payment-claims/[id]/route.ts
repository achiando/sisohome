import { apiRoute } from '@/lib/api-route';
import { decidePaymentClaim } from '@/lib/domain/payment-claim';

/**
 * PATCH /api/payment-claims/[id] — decide a claim.
 * `{ action: 'confirm' }` records the real Payment (oldest-first allocation,
 * tenant's paidAt) and emails the tenant; `{ action: 'reject', note? }`
 * closes it with a note back to the tenant. Both are audited.
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'payment.create',
  async handler({ actor, params, body }) {
    const input = await body();
    return await decidePaymentClaim(actor, params.id, input);
  },
});
