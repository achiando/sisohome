import { apiRoute } from '@/lib/api-route';
import * as notifications from '@/lib/domain/notification';

/** PATCH /api/notifications/[id] — mark one notification read. */
export const PATCH = apiRoute<{ id: string }>({
  async handler({ actor, params }) {
    await notifications.markNotificationRead(actor, params.id);
  },
});
