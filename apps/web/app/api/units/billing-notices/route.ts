import { apiRoute } from '@/lib/api-route';
import * as billing from '@/lib/domain/billing-notice';

/**
 * POST /api/units/billing-notices — send billing notices to the occupants
 * of the given units (email + NOTICE document filed in the tenant portal).
 * Body: `{ unitIds: string[] }` (≤ 50 per request — the register chunks).
 * Out-of-scope / vacant / email-less units come back in `skipped`; an all
 * out-of-scope batch is a 404.
 */
export const POST = apiRoute({
  permissions: 'charge.manage',
  async handler({ actor, body }) {
    const input = await body();
    const result = await billing.sendBillingNotice(actor, input);
    return { result };
  },
});
