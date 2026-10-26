import { NextRequest, NextResponse } from 'next/server'

import { newPasswordSchema } from '@workspace/auth-ui/lib'

import { authProvider, db } from '@/lib/auth'
import { checkRateLimits, ipKey } from '@/lib/rate-limit'
import { getRouteAuthContext } from '@/lib/route-auth'
import { setActiveOrgCookie, setSessionCookie } from '@/lib/session-cookie'
import { hashInviteToken } from '@/lib/domain/tenant'
import { auditLog } from '@/lib/domain/audit'

/**
 * POST /api/portal/accept — the invite-redemption entry to the tenant
 * portal (plan-slice-7 §1.5). Public + token, rate-limited like the auth
 * endpoints.
 *
 *   - new account   → password required (same policy as reset), user is
 *                     created email-verified, invite consumed, tenant linked,
 *                     session issued.
 *   - existing user → must already be signed IN as that user (the accept
 *     (no session)    page redirects to /login?next=… first) → 403 + redirectTo.
 *   - signed in as someone else → 409 + needsLogout (never swap sessions
 *                     silently; the page offers "sign out and continue").
 *
 * The invite is consumed race-safely (updateMany where usedAt: null), so a
 * second click on the same link gets 409. Dual-role sign-ins keep their
 * existing session untouched (org context is never read here).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const limited = checkRateLimits([
      { key: ipKey(request, 'portal-accept'), limit: 10, windowMs: 10 * 60_000 },
    ])
    if (limited) return limited

    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'This invitation link is incomplete.' },
        { status: 400 },
      )
    }

    const invite = await db.tenantPortalInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: {
        tenant: { select: { id: true, displayName: true, portalStatus: true } },
      },
    })
    if (!invite) {
      return NextResponse.json(
        { success: false, error: 'This invitation link is invalid.' },
        { status: 404 },
      )
    }
    if (invite.usedAt || invite.tenant.portalStatus === 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          alreadyUsed: true,
          error: 'This invitation has already been used. Sign in to continue.',
        },
        { status: 409 },
      )
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        {
          success: false,
          error: 'This invitation has expired. Ask your property manager for a new one.',
        },
        { status: 410 },
      )
    }

    const ctx = await getRouteAuthContext(request)
    const loginRedirect = `/login?next=${encodeURIComponent(`/portal/accept?token=${token}`)}`

    let user = await db.user.findUnique({
      where: { email: invite.email },
      select: { id: true, email: true, displayName: true },
    })

    // Signed in as a DIFFERENT account (including "invite for a brand-new
    // email while someone else's session is live"): force an explicit
    // sign-out — sessions are never swapped behind the user's back.
    if (ctx && (!user || ctx.userId !== user.id)) {
      return NextResponse.json(
        {
          success: false,
          needsLogout: true,
          error: 'You are signed in to a different account. Sign out to accept this invitation.',
        },
        { status: 409 },
      )
    }

    if (!user) {
      // New account — password policy first, then create + mark verified.
      if (!password) {
        return NextResponse.json(
          { success: false, error: 'password is required' },
          { status: 400 },
        )
      }
      const parsed = newPasswordSchema.safeParse({ password, confirmPassword: password })
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: parsed.error.issues[0]?.message ?? 'Password is not acceptable.' },
          { status: 400 },
        )
      }
      const identity = await authProvider.signUp(invite.email, password, invite.tenant.displayName)
      if (identity) {
        await db.user.update({
          where: { id: identity.userId },
          data: { emailVerifiedAt: new Date() },
        })
        user = await db.user.findUnique({
          where: { id: identity.userId },
          select: { id: true, email: true, displayName: true },
        })
      } else {
        // Lost a create race — fall through to the existing-user rules.
        user = await db.user.findUnique({
          where: { email: invite.email },
          select: { id: true, email: true, displayName: true },
        })
        if (!user || !ctx || ctx.userId !== user.id) {
          return NextResponse.json(
            { success: false, error: 'Sign in to your account to accept this invitation.', redirectTo: loginRedirect },
            { status: 403 },
          )
        }
      }
    } else if (!ctx) {
      // Existing account without a session — log in first (plan §1.5).
      return NextResponse.json(
        { success: false, error: 'Sign in to your account to accept this invitation.', redirectTo: loginRedirect },
        { status: 403 },
      )
    }
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Could not set up your portal account.' },
        { status: 500 },
      )
    }

    // Consume the invite race-safely BEFORE linking, so double-clicks and
    // replays collapse to one 409.
    const consumed = await db.tenantPortalInvite.updateMany({
      where: { id: invite.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (consumed.count === 0) {
      return NextResponse.json(
        { success: false, alreadyUsed: true, error: 'This invitation has already been used.' },
        { status: 409 },
      )
    }

    await db.tenant.updateMany({
      where: { id: invite.tenantId },
      data: {
        portalUserId: user.id,
        portalStatus: 'ACTIVE',
        portalActivatedAt: new Date(),
      },
    })
    await auditLog(
      { userId: user.id, organizationId: invite.organizationId },
      'TENANT',
      'tenant.portal_accept',
      invite.tenantId,
      { email: invite.email },
    )

    // Already signed in (dual-role or pre-login) → keep that session as-is.
    if (ctx) {
      return NextResponse.json({ success: true, alreadySignedIn: true })
    }

    const identity = await authProvider.issueSession(user.id)
    if (!identity?.sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sign-in failed. Please sign in normally.' },
        { status: 500 },
      )
    }
    const session = await db.session.findUnique({ where: { id: identity.sessionId } })
    const organizationId = (identity.metadata?.organizationId as string | null) ?? null
    const response = NextResponse.json({ success: true, organizationId })
    if (session?.token) {
      setSessionCookie(response, session.token)
      setActiveOrgCookie(response, organizationId)
    }
    return response
  } catch (error) {
    console.error('Portal accept error:', error)
    return NextResponse.json(
      { success: false, error: 'Could not accept this invitation. Please try again.' },
      { status: 500 },
    )
  }
}
