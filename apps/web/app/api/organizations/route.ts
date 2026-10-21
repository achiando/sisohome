import { apiRoute } from '@/lib/api-route';
import * as agreements from '@/lib/domain/agreement';

/**
 * GET /api/organizations — minimal manager directory for the agreement
 * picker: ACTIVE orgs of managing kinds (PROPERTY_MANAGEMENT,
 * MAINTENANCE_COMPANY), excluding the caller. Gated `agreement.create`
 * (only agreement creators need it). Names/kinds only — no contacts,
 * no membership data. Landlord-only orgs are intentionally absent.
 */
export const GET = apiRoute({
  permissions: 'agreement.create',
  async handler({ actor }) {
    const organizations = await agreements.listManagementOrgCandidates(actor);
    return { organizations };
  },
});
