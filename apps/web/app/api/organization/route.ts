import { NextResponse } from 'next/server';
import { organizationService, prisma } from '@/lib/auth';
import { withAuth } from '@/lib/route-auth';

/**
 * GET /api/organization — details of the session's ACTIVE organization
 * (name, kind, created). Organization context comes from the session, never
 * from client input.
 */
export const GET = withAuth(
  async (_request, context) => {
    const organization = await prisma.organization.findUnique({
      where: { id: context.organizationId! },
      select: { id: true, name: true, kind: true, createdAt: true },
    });
    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      organization: {
        ...organization,
        createdAt: organization.createdAt.toISOString(),
      },
    });
  },
  { requiredPermissions: ['organization.read'] },
);

/**
 * PATCH /api/organization — rename the active organization.
 * Server-enforced: organization.update + active membership (withAuth).
 */
export const PATCH = withAuth(
  async (request, context) => {
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Organization name is required' },
        { status: 400 },
      );
    }
    if (name.length > 80) {
      return NextResponse.json(
        { success: false, error: 'Organization name must be 80 characters or fewer' },
        { status: 400 },
      );
    }

    try {
      const organization = await organizationService.updateOrganization({
        organizationId: context.organizationId!,
        name,
      });
      return NextResponse.json({ success: true, organization });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update organization';
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  },
  { requiredPermissions: ['organization.update'] },
);
