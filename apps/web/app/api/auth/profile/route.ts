import { NextRequest, NextResponse } from 'next/server';
import { authorizationService, db } from '@/lib/auth';
import { getRouteAuthContext } from '@/lib/route-auth';

/** Minimum length for a display name, mirroring the client schema. */
const NAME_MIN = 2;
const NAME_MAX = 100;

/**
 * Loose phone matcher accepting national or E.164 input.
 * Returns a compacted value (`+` and digits only) or `null` when cleared.
 * Rejects with `undefined` when the input is present but not a number.
 */
function normalizePhone(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^\+?[0-9][0-9\s\-().]{6,19}$/.test(trimmed)) return undefined;
  return trimmed.replace(/[\s\-().]/g, '');
}

/**
 * Accepts http(s) avatar links only — `javascript:`/`data:` URLs are rejected.
 * Returns `null` when the field is cleared.
 */
function normalizeAvatar(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  if (trimmed.length > 500) return undefined;
  return trimmed;
}

function userPayload(user: {
  id: string;
  email: string;
  displayName: string | null;
  phone: string | null;
  twoFactorEnabled: boolean;
  twoFactorMethod: string | null;
  profile?: {
    avatarUrl: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}) {
  const splitName = `${user.profile?.firstName ?? ''} ${user.profile?.lastName ?? ''}`.trim();
  return {
    id: user.id,
    email: user.email,
    name: user.displayName || splitName,
    avatar: user.profile?.avatarUrl ?? undefined,
    phone: user.phone,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorMethod: user.twoFactorMethod,
  };
}

/**
 * GET /api/auth/profile — the signed-in user's profile + session context.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getRouteAuthContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: context.userId },
      include: { profile: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const permissions = context.organizationId
      ? await authorizationService.getUserPermissions(context.userId, context.organizationId)
      : [];
    const roles = context.organizationId
      ? await authorizationService.getUserRoles(context.userId, context.organizationId)
      : [];

    return NextResponse.json({
      success: true,
      mustChangePassword: user.mustChangePassword,
      user: userPayload(user),
      session: {
        organizationId: context.organizationId,
        permissions,
        roles: roles.map((r) => r.slug),
      },
    });
  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}

/**
 * PATCH /api/auth/profile — update display name, avatar and/or phone.
 *
 * `email` is the account identity: it is NEVER read from the body and NEVER
 * written. `twoFactor*` is also unreachable from here — enrollment ships as
 * its own dedicated, re-authenticated endpoint later.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getRouteAuthContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const data: {
      displayName?: string;
      phone?: string | null;
      profile?: {
        upsert: { create: { avatarUrl: string | null }; update: { avatarUrl: string | null } };
      };
    } = {};
    let touched = false;

    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (name.length < NAME_MIN || name.length > NAME_MAX) {
        return NextResponse.json(
          { success: false, error: `Name must be ${NAME_MIN}–${NAME_MAX} characters` },
          { status: 400 }
        );
      }
      data.displayName = name;
      touched = true;
    }

    if (typeof body.phone === 'string') {
      const phone = normalizePhone(body.phone);
      if (phone === undefined) {
        return NextResponse.json(
          { success: false, error: 'Enter a valid phone number' },
          { status: 400 }
        );
      }
      data.phone = phone;
      touched = true;
    }

    if (typeof body.avatar === 'string') {
      const avatar = normalizeAvatar(body.avatar);
      if (avatar === undefined) {
        return NextResponse.json(
          { success: false, error: 'Avatar must be a valid http(s) image URL' },
          { status: 400 }
        );
      }
      data.profile = {
        upsert: { create: { avatarUrl: avatar }, update: { avatarUrl: avatar } },
      };
      touched = true;
    }

    if (!touched) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id: context.userId },
      data,
      include: { profile: true },
    });

    return NextResponse.json({ success: true, user: userPayload(user) });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, error: 'Profile update failed' }, { status: 500 });
  }
}
