import { apiRoute, ok } from '@/lib/api-route';
import * as ledgerAccounts from '@/lib/domain/ledger-account';

/**
 * GET /api/properties/[id]/accounts — the rent + utilities ledger account
 * pair for a property (idempotent: creates them on first read if missing).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'payment.list',
  async handler({ actor, params }) {
    const list = await ledgerAccounts.ensurePropertyAccounts(actor, params.id);
    return ok({ accounts: list });
  },
});
