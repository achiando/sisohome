import { apiRoute, ok } from '@/lib/api-route';
import * as sign from '@/lib/domain/agreement-sign';

/**
 * GET /api/leases/[id]/agreement-preview?template= — server-rendered tenant
 * agreement template (People plan Slice 6). Returns the tenant template list,
 * the selected id, the HTML preview (signature pending) and the account label
 * the signer must type back. Lease scope applies — cross-tenant ids 404.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'lease.read',
  async handler({ actor, params, query }) {
    const preview = await sign.previewLeaseAgreement(actor, params.id, query.get('template') ?? undefined);
    return ok(preview);
  },
});
