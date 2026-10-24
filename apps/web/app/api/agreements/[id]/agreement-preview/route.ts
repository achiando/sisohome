import { apiRoute, ok } from '@/lib/api-route';
import * as sign from '@/lib/domain/agreement-sign';

/**
 * GET /api/agreements/[id]/agreement-preview?template= — server-rendered
 * manager/maintainer template preview (People plan Slice 6). The template
 * list depends on the managing org's kind (PROPERTY_MANAGEMENT → manager
 * templates, MAINTENANCE_COMPANY → maintainer templates). Either side may
 * preview (either-side read); approval stays portfolio-only upstream.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'agreement.read',
  async handler({ actor, params, query }) {
    const preview = await sign.previewManagementAgreement(actor, params.id, query.get('template') ?? undefined);
    return ok(preview);
  },
});
