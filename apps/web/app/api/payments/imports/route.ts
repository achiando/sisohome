import { apiRoute } from '@/lib/api-route';
import * as paymentImport from '@/lib/domain/payment-import';

/**
 * GET /api/payments/imports — recent import batch history (last 20) with
 * per-status counts.
 */
export const GET = apiRoute({
  permissions: 'payment.list',
  async handler({ actor }) {
    return paymentImport.listImports(actor);
  },
});
