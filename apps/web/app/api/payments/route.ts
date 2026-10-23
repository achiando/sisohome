import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as payments from '@/lib/domain/payment';

/**
 * /api/payments — the payment register. Filters: propertyId, unitId,
 * tenantId, leaseId, accountType (RENT | UTILITIES), from/to (ISO dates).
 * Unscoped lists return every payment in the actor's org whose property is
 * in scope; property-scoped reads 404 out of scope.
 */
export const GET = apiRoute({
  permissions: 'payment.list',
  async handler({ actor, query }) {
    const [paymentsList, breakdown] = await Promise.all([
      payments.listPayments(actor, {
        propertyId: query.get('propertyId') ?? undefined,
        unitId: query.get('unitId') ?? undefined,
        tenantId: query.get('tenantId') ?? undefined,
        leaseId: query.get('leaseId') ?? undefined,
        accountType: query.get('accountType') ?? undefined,
        from: query.get('from') ?? undefined,
        to: query.get('to') ?? undefined,
      }),
      payments.paymentsBreakdown(actor, {
        propertyId: query.get('propertyId') ?? undefined,
        tenantId: query.get('tenantId') ?? undefined,
      }),
    ]);
    return { payments: paymentsList, breakdown };
  },
});

/**
 * POST /api/payments — record a received payment. `accountType` picks the
 * bucket (default RENT); utilities bills (waste/water/…) set UTILITIES so
 * they track separately. Server resolves the property's ledger account pair
 * (unit override preferred when unitId is given and owns one).
 */
export const POST = apiRoute({
  permissions: 'payment.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const payment = await payments.createPayment(actor, input);
    return ok({ payment }, { status: 201 });
  },
});
