import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get session token from request
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No session token' },
        { status: 400 }
      );
    }

    // Verify session to get session ID
    const identity = await authService.verifySession(token);

    // Revoke session
    if (identity.sessionId) {
      await authService.revokeSession(identity.sessionId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    // Even if logout fails, return success to avoid blocking user
    return NextResponse.json({ success: true });
  }
}
