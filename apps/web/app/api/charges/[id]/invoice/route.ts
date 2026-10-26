import { apiRoute } from '@/lib/api-route';
import * as charges from '@/lib/domain/charge';

/**
 * GET /api/charges/[id]/invoice — stateless printable invoice for a charge.
 * Mints `INV-YYYY-NNNN` lazily for pre-Slice-8 rows (same number on every
 * subsequent fetch). Returns `{ invoiceNumber, html }`.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'charge.read',
  async handler({ actor, params }) {
    const result = await charges.invoiceCharge(actor, params.id);
    return { invoiceNumber: result.invoiceNumber, html: result.html };
  },
});
