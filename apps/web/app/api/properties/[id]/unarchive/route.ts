import { apiRoute, RouteError } from '@/lib/api-route';
import * as properties from '@/lib/domain/property';

/**
 * POST /api/properties/[id]/unarchive — ARCHIVED → ACTIVE when the
 * activation gate passes (pin; + title for land), else → DRAFT.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'property.update',
  async handler({ actor, params }) {
    const property = await properties.unarchive(actor, params.id);
    if (!property) throw new RouteError(404, 'Property not found');
    return { property };
  },
});
