import { apiRoute } from '@/lib/api-route';
import * as notifications from '@/lib/domain/notification';

/**
 * GET /api/notifications — the caller's own in-app notifications (latest 30
 * + unread count). Membership only — rows are already user-scoped.
 */
export const GET = apiRoute({
  async handler({ actor }) {
    return await notifications.listNotifications(actor);
  },
});
