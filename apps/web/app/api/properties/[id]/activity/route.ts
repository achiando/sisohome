import { apiRoute } from '@/lib/api-route';
import * as properties from '@/lib/domain/property';

/**
 * GET /api/properties/[id]/activity — audit trail for this property in the
 * CALLER'S org (portfolio org logs every action incl. managing-org edits;
 * managed orgs don't read the landlord's trail — plan-slice-1 §3.1).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'audit.read',
  async handler({ actor, params }) {
    const entries = await properties.activity(actor, params.id);
    return { entries };
  },
});
