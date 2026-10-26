import { apiRoute } from '@/lib/api-route';
import * as receipts from '@/lib/domain/receipt';

/**
 * GET /api/receipts — issued-receipts register with payment context
 * (method/reference/receivedAt + property/unit/tenant). Filters:
 * propertyId, unitId, tenantId, paymentId, from/to (payment receivedAt).
 */
export const GET = apiRoute({
  permissions: 'payment.list',
  async handler({ actor, query }) {
    const list = await receipts.listReceipts(actor, {
      propertyId: query.get('propertyId') ?? undefined,
      unitId: query.get('unitId') ?? undefined,
      tenantId: query.get('tenantId') ?? undefined,
      paymentId: query.get('paymentId') ?? undefined,
      from: query.get('from') ?? undefined,
      to: query.get('to') ?? undefined,
    });
    return { receipts: list };
  },
});
