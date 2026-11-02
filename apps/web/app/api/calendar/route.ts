import { apiRoute } from '@/lib/api-route';
import * as calendar from '@/lib/domain/calendar';

/**
 * GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD — the landlord-attention
 * calendar (plan-roadmap Phase 3).
 *
 * Open to any authenticated org member (no route permission key, by plan):
 * each event class carries its own `<domain>.list` gate inside
 * `getCalendarEvents`, and rows stay scoped by each domain's own rules
 * (propertyScopeWhere / viewingScopeWhere) — so an MM org only ever sees its
 * agreement/assigned properties. `from`/`to` are optional but must come in
 * pairs; default is the current month, max span 366 days.
 */
export const GET = apiRoute({
  async handler({ actor, query }) {
    return calendar.getCalendarEvents(actor, {
      from: query.get('from'),
      to: query.get('to'),
    });
  },
});
