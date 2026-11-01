import { apiRoute, RouteError } from '@/lib/api-route';
import * as paymentImport from '@/lib/domain/payment-import';

/**
 * POST /api/payments/import/preview — parse a pasted batch through the
 * payment-source adapter and match it against tenants/open charges.
 * **No writes**: rows exist only in the response, so the dialog can
 * preview repeatedly before the user commits anything.
 */
export const POST = apiRoute({
  permissions: 'payment.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    return paymentImport.previewImport(actor, input);
  },
});
