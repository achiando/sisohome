/* ── GET /api/reports/summary ────────────────────────────────────────────────────
 * Roadmap Phase 5 — thin aggregate dashboard, gated audit.read.
 *
 * apiRoute handles: session‑cookie auth, mustChangePassword block, active‑org
 * requirement, permission‑key checks, params awaiting, cached JSON body parsing,
 * and error mapping (RouteError / AccessError → JSON with status).
 *--------------------------------------------------------------------------*/

import { apiRoute } from '@/lib/api-route';
import * as reports from '@/lib/domain/reports';

/** GET /api/reports/summary — thin dashboard aggregates (Phase 5). */
export const GET = apiRoute({
  permissions: 'audit.read',
  async handler({ actor }) {
    const summary = await reports.getReportsSummary(actor);
    return { summary };
  },
});