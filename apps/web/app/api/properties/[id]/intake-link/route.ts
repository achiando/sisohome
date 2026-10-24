/**
 * POST /api/properties/[id]/intake-link — mint a public self-onboarding link.
 *
 * Requires `application.create` + property scope (apiRoute). The response
 * contains the signed URL; it is stateless, so the token cannot be revoked
 * early — expiry (≤90 days) plus the issuer's scope re-check at use time are
 * the revocation levers (domain: intake.ts).
 */

import { apiRoute } from '@/lib/api-route';
import { issueIntakeLink } from '@/lib/domain/intake';

export const POST = apiRoute<{ id: string }>({
  permissions: 'application.create',
  async handler({ actor, params, body }) {
    const input = await body();
    return issueIntakeLink(actor, params.id, input);
  },
});
