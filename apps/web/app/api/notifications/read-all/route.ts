import { apiRoute } from '@/lib/api-route';
import * as notifications from '@/lib/domain/notification';

/** POST /api/notifications/read-all — mark every unread row read. */
export const POST = apiRoute({
  async handler({ actor }) {
    const marked = await notifications.markAllNotificationsRead(actor);
    return { marked };
  },
});
