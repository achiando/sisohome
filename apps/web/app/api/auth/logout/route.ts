import { NextResponse } from 'next/server';
import { authService, getSessionToken } from '@/lib/auth';
import { clearSessionCookie, setActiveOrgCookie } from '@/lib/session-cookie';

export async function POST() {
  try {
    // Session token comes from the httpOnly cookie
    const token = await getSessionToken();

    if (token) {
      // Verify session to get session ID, then revoke it
      try {
        const identity = await authService.verifySession(token);
        if (identity.sessionId) {
          await authService.revokeSession(identity.sessionId);
        }
      } catch {
        // Token may already be invalid — continue to clear cookies anyway
      }
    }

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    setActiveOrgCookie(response, null);
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    // Even if logout fails, clear cookies and return success to unblock user
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    setActiveOrgCookie(response, null);
    return response;
  }
}
