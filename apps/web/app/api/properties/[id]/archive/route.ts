import { apiRoute } from '@/lib/api-route';
import * as properties from '@/lib/domain/property';

/** POST /api/properties/[id]/archive — status → ARCHIVED (history kept). */
export const POST = apiRoute<{ id: string }>({
  permissions: 'property.archive',
  async handler({ actor, params }) {
    const property = await properties.archive(actor, params.id);
    return { property };
  },
});
