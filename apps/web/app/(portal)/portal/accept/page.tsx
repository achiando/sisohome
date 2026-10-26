import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

import { authService, db, getSessionToken } from '@/lib/auth'
import { hashInviteToken } from '@/lib/domain/tenant'

import { AcceptForm, type AcceptContext } from './accept-form'

/**
 * `/portal/accept?token=` — the invite-redemption screen (plan-slice-7
 * §1.5/§3). The invite is resolved server-side like `/i/<token>`: invalid →
 * 404, expired/used → a friendly card (pages can't send 410/409 — the JSON
 * API does). Existing account + no session → bounce through
 * `/login?next=…` first; existing account + a DIFFERENT session → the form
 * offers sign-out (sessions are never swapped silently).
 */

interface AcceptPageProps {
  searchParams: Promise<{ token?: string | string[] }>
}

async function resolveInvite(raw: string): Promise<AcceptContext | 'login' | null> {
  const token = typeof raw === 'string' ? raw.trim() : ''
  if (!token) return null

  const invite = await db.tenantPortalInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: {
      tenant: { select: { displayName: true, portalStatus: true } },
      organization: { select: { name: true } },
    },
  })
  if (!invite) return null
  if (invite.usedAt || invite.tenant.portalStatus === 'ACTIVE') {
    return {
      mode: 'used',
      email: invite.email,
      tenantName: invite.tenant.displayName,
      expiresAt: invite.expiresAt,
      organizationName: invite.organization.name,
    }
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return {
      mode: 'expired',
      email: invite.email,
      tenantName: invite.tenant.displayName,
      expiresAt: invite.expiresAt,
      organizationName: invite.organization.name,
    }
  }

  const base = {
    email: invite.email,
    tenantName: invite.tenant.displayName,
    expiresAt: invite.expiresAt,
    organizationName: invite.organization.name,
  }

  const user = await db.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  })
  if (!user) {
    // Brand-new account: the form sets the password on redemption.
    return { ...base, mode: 'new' }
  }

  const sessionToken = await getSessionToken()
  let identity: { userId: string } | null = null
  if (sessionToken) {
    try {
      identity = await authService.verifySession(sessionToken)
    } catch {
      identity = null
    }
  }
  if (!identity) return 'login'
  if (identity.userId !== user.id) return { ...base, mode: 'switch' }
  return { ...base, mode: 'existing' }
}

const resolveCached = cache(resolveInvite)

export async function generateMetadata({ searchParams }: AcceptPageProps): Promise<Metadata> {
  const { token } = await searchParams
  const resolved = await resolveCached(typeof token === 'string' ? token : '')
  if (resolved && typeof resolved === 'object') {
    return { title: `Portal invitation — ${resolved.tenantName}` }
  }
  return { title: 'Portal invitation' }
}

export default async function PortalAcceptPage({ searchParams }: AcceptPageProps) {
  const { token: rawToken } = await searchParams
  const token = typeof rawToken === 'string' ? rawToken.trim() : ''
  if (!token) notFound()

  const resolved = await resolveCached(token)
  if (resolved === null) notFound()
  if (resolved === 'login') {
    redirect(`/login?next=${encodeURIComponent(`/portal/accept?token=${token}`)}`)
  }

  return <AcceptForm token={token} context={resolved} />
}
