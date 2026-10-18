import { membershipService } from '@/lib/auth';
import { apiRoute, RouteError } from '@/lib/api-route';

type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

const STATUSES = new Set<string>(['ACTIVE', 'SUSPENDED', 'REMOVED']);

function isMemberStatus(value: unknown): value is MemberStatus {
  return typeof value === 'string' && STATUSES.has(value);
}

/**
 * PATCH /api/members/[id] — update a membership.
 *
 * Accepts any subset of:
 * - `status`: ACTIVE | SUSPENDED | REMOVED (last-active-owner protection
 *   enforced in the service)
 * - `name`: the member's display name (email is the immutable login identity
 *   and is intentionally NOT editable here)
 *
 * Both fields may be sent together; each is applied only when present.
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'membership.manage',
  async handler({ actor, params, body }) {
    const input = await body();

    const hasStatus = input?.status !== undefined;
    const hasName = input?.name !== undefined;

    if (!hasStatus && !hasName) {
      throw new RouteError(400, 'Provide status and/or name to update');
    }
    if (hasStatus && !isMemberStatus(input.status)) {
      throw new RouteError(400, 'status must be ACTIVE, SUSPENDED, or REMOVED');
    }
    if (hasName && (typeof input.name !== 'string' || !input.name.trim())) {
      throw new RouteError(400, 'name must be a non-empty string');
    }

    if (hasName) {
      await membershipService.updateMember(actor, params.id, { name: input.name as string });
    }
    if (hasStatus) {
      await membershipService.setStatus(actor, params.id, input.status as MemberStatus);
    }
  },
});
