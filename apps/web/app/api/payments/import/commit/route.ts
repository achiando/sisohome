import { apiRoute, RouteError } from '@/lib/api-route';
import * as paymentImport from '@/lib/domain/payment-import';

/**
 * POST /api/payments/import/commit — persist the batch/rows and apply the
 * checked decisions. The paste is re-parsed server-side (never trusted
 * from the client); decisions only carry opt-ins + manual tenant/account
 * overrides. Applies via the claim-confirm allocation path, stamping
 * `externalId` + `source: 'IMPORT'`.
 */
export const POST = apiRoute({
  permissions: 'payment.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    return paymentImport.commitImport(actor, input);
  },
});
