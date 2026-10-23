import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as monthly from '@/lib/domain/monthly';

/**
 * POST /api/payments/for-months — record a payment covering N months of
 * open charges (rent or utilities), allocating oldest-first in one
 * transaction. Amount optional (defaults to full sum of covered charges).
 */
export const POST = apiRoute({
  permissions: 'payment.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const propertyId = typeof input.propertyId === 'string' ? input.propertyId.trim() : '';
    if (!propertyId) throw new RouteError(400, 'propertyId is required');
    const accountType = input.accountType === 'UTILITIES' ? 'UTILITIES' : 'RENT';
    const months = Number(input.months);
    if (!Number.isFinite(months)) throw new RouteError(400, 'months is required');
    const method = typeof input.method === 'string' ? input.method.trim() : '';
    if (!method) throw new RouteError(400, 'method is required');

    const result = await monthly.recordMultiMonthPayment(actor, {
      propertyId,
      unitId: typeof input.unitId === 'string' && input.unitId.trim() ? input.unitId.trim() : null,
      tenantId: typeof input.tenantId === 'string' && input.tenantId.trim() ? input.tenantId.trim() : null,
      leaseId: typeof input.leaseId === 'string' && input.leaseId.trim() ? input.leaseId.trim() : null,
      accountType,
      months,
      fromMonth: typeof input.fromMonth === 'string' && input.fromMonth.trim() ? input.fromMonth.trim() : undefined,
      amount: input.amount != null ? Number(input.amount) : undefined,
      method,
      reference: typeof input.reference === 'string' && input.reference.trim() ? input.reference.trim() : null,
      notes: typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : null,
    });
    return ok({ payment: result }, { status: 201 });
  },
});
