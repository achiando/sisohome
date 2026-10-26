import { apiRoute } from '@/lib/api-route';
import * as dues from '@/lib/domain/dues';

/**
 * POST /api/dues/remind — log an in-app overdue reminder for a tenant
 * (no email; the audit trail is the record). Overdue totals are recomputed
 * server-side; the Dues register shows `lastRemindedAt` per row.
 */
export const POST = apiRoute({
  permissions: 'charge.manage',
  async handler({ actor, body }) {
    const input = await body();
    const reminder = await dues.remindTenant(actor, input);
    return { reminder };
  },
});
