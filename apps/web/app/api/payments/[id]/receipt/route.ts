import { apiRoute, ok } from '@/lib/api-route';
import * as receipts from '@/lib/domain/receipt';

/**
 * POST /api/payments/[id]/receipt — issue a receipt for a payment
 * (receipt.issue). Idempotent: returns existing receipt if already issued.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'receipt.issue',
  async handler({ actor, params }) {
    const receipt = await receipts.issueReceipt(actor, params.id);
    return ok({ receipt }, { status: 201 });
  },
});
