import { NextRequest, NextResponse } from 'next/server';
import { membershipService } from '@/lib/auth';
import { withAuth } from '@/lib/route-auth';

type Params = { params: Promise<{ id: string }> };

const STATUSES = new Set(['ACTIVE', 'SUSPENDED', 'REMOVED']);

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
export const PATCH = withAuth(
  async (request: NextRequest, context, { params }: Params) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const hasStatus = body?.status !== undefined;
    const hasName = body?.name !== undefined;

    if (!hasStatus && !hasName) {
      return NextResponse.json(
        { success: false, error: 'Provide status and/or name to update' },
        { status: 400 },
      );
    }

    if (hasStatus && !STATUSES.has(body.status)) {
      return NextResponse.json(
        { success: false, error: 'status must be ACTIVE, SUSPENDED, or REMOVED' },
        { status: 400 },
      );
    }

    const actor = { userId: context.userId, organizationId: context.organizationId! };

    if (hasName) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json(
          { success: false, error: 'name must be a non-empty string' },
          { status: 400 },
        );
      }
      await membershipService.updateMember(actor, id, { name: body.name });
    }

    if (hasStatus) {
      await membershipService.setStatus(actor, id, body.status);
    }

    return NextResponse.json({ success: true });
  },
  { requiredPermissions: ['membership.manage'] },
);
