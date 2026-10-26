import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as adjustments from '@/lib/domain/adjustment';

/**
 * GET /api/adjustments — adjustments queue/register (PENDING first).
 * Filters: propertyId, status (PENDING|APPROVED|REJECTED), chargeId.
 */
export const GET = apiRoute({
  permissions: 'adjustment.list',
  async handler({ actor, query }) {
    const list = await adjustments.listAdjustments(actor, {
      propertyId: query.get('propertyId') ?? undefined,
      status: query.get('status') ?? undefined,
      chargeId: query.get('chargeId') ?? undefined,
    });
    return { adjustments: list };
  },
});

/**
 * POST /api/adjustments — submit a credit/waiver/reversal/write-off
 * (PENDING until `adjustment.approve` decides it). Amount must fit the
 * charge's current open balance.
 */
export const POST = apiRoute({
  permissions: 'adjustment.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const adjustment = await adjustments.createAdjustment(actor, input);
    return ok({ adjustment }, { status: 201 });
  },
});
