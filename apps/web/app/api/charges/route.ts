import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as charges from '@/lib/domain/charge';

/**
 * GET /api/charges — the charge register (posted + draft) with DERIVED
 * balance per row. Filters: propertyId, unitId, tenantId, leaseId,
 * accountType (RENT | UTILITIES), posted (true|false), status
 * (open|overdue|paid|all), dueFrom/dueTo (YYYY-MM-DD range).
 */
export const GET = apiRoute({
  permissions: 'charge.list',
  async handler({ actor, query }) {
    const postedRaw = query.get('posted');
    const list = await charges.listCharges(actor, {
      propertyId: query.get('propertyId') ?? undefined,
      unitId: query.get('unitId') ?? undefined,
      tenantId: query.get('tenantId') ?? undefined,
      leaseId: query.get('leaseId') ?? undefined,
      accountType: query.get('accountType') ?? undefined,
      posted: postedRaw === 'true' ? true : postedRaw === 'false' ? false : undefined,
      status: (query.get('status') as charges.ChargeStatusFilter | null) ?? undefined,
      dueFrom: query.get('dueFrom') ?? undefined,
      dueTo: query.get('dueTo') ?? undefined,
    });
    return { charges: list };
  },
});

/**
 * POST /api/charges — manual one-off charge (posted immediately, invoice
 * number minted in the same create). Property must be in scope (404), the
 * unit must belong to it (400), tenant must be the caller's org's party.
 */
export const POST = apiRoute({
  permissions: 'charge.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const charge = await charges.createManualCharge(actor, input);
    return ok({ charge }, { status: 201 });
  },
});
