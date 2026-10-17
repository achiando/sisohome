import { NextRequest, NextResponse } from 'next/server';
import { authProvider, authService, db } from '@/lib/auth';
import { getRouteAuthContext } from '@/lib/route-auth';

/**
 * POST /api/auth/change-password — change the signed-in user's password.
 * Required when `mustChangePassword` is set (admin-created temporary
 * password); clears the flag on success.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getRouteAuthContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'currentPassword and newPassword are required' },
        { status: 400 },
      );
    }

    try {
      const ok = await authProvider.changePassword(context.userId, currentPassword, newPassword);
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 400 },
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password change failed';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    return NextResponse.json({ success: true, mustChangePassword: false });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ success: false, error: 'Password change failed' }, { status: 500 });
  }
}

/**
 * GET /api/auth/change-password — probe endpoint (session validity only).
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ success: true });
}
