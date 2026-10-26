import { apiRoute } from '@/lib/api-route';
import * as receipts from '@/lib/domain/receipt';

/**
 * GET /api/receipts/[id] — one receipt with payment context plus a
 * stateless printable HTML render (RE number, method/ref/date, parties,
 * amount). Issuing stays on POST /api/payments/[id]/receipt.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'payment.read',
  async handler({ actor, params }) {
    const receipt = await receipts.getReceipt(actor, params.id);
    return { receipt, html: receipts.renderReceiptHtml(receipt) };
  },
});
