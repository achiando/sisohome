'use client'

/**
 * PortalFrame — the org-less shell for `/portal/*` (plan-slice-7 §3): no
 * dashboard sidebar, a header with brand + tenancy picker + sign out, and a
 * horizontal nav. Client-side guard only (UX): `GET /api/portal/session`
 * drives redirect/no-access states, while every data endpoint authorizes
 * itself server-side. `/portal/accept` renders inside a bare branded frame —
 * it must work with NO session (invite redemption).
 */

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, FileText, FolderOpen, Home, LogOut, Receipt, User, Wrench } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'

import {
  PortalSessionContext,
  portalSignOut,
  type PortalSessionState,
  type PortalTenantOption,
} from './portal-data'

interface NavItem {
  href: string
  label: string
  icon: typeof Home
  exact?: boolean
}

const NAV: NavItem[] = [
  { href: '/portal', label: 'Home', icon: Home, exact: true },
  { href: '/portal/lease', label: 'Lease', icon: FileText },
  { href: '/portal/statement', label: 'Statement', icon: Receipt },
  { href: '/portal/tickets', label: 'Maintenance', icon: Wrench },
  { href: '/portal/documents', label: 'Documents', icon: FolderOpen },
  { href: '/portal/profile', label: 'Profile', icon: User },
]

type Phase = 'loading' | 'ok' | 'unauth' | 'password' | 'noaccess' | 'error'

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"
        aria-hidden="true"
      >
        <span className="text-base font-bold leading-none">S</span>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        SisoHome <span className="text-muted-foreground">Portal</span>
      </span>
    </span>
  )
}

function TenantPicker({
  tenants,
  current,
}: {
  tenants: PortalTenantOption[]
  current: string
}) {
  const currentTenant = tenants.find((t) => t.id === current) ?? tenants[0]

  const switchTo = async (tenantId: string) => {
    if (tenantId === current) return
    const res = await fetch('/api/portal/switch-tenant', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    }).catch(() => null)
    if (res?.ok) {
      // Full reload: every portal page reads the signed context cookie
      // server-side, so the chosen tenancy must be applied before refetch.
      window.location.reload()
      return
    }
    toast.error('Could not switch tenancy')
  }

  if (tenants.length === 1) {
    return (
      <span className="max-w-[14rem] truncate rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
        {currentTenant?.displayName}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[14rem]">
          <span className="truncate">{currentTenant?.displayName}</span>
          <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {tenants.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => switchTo(t.id)}>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{t.displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{t.orgName}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CenteredCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card variant="outlined" className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children ? <CardContent>{children}</CardContent> : null}
      </Card>
    </div>
  )
}

export function PortalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [session, setSession] = useState<PortalSessionState | null>(null)

  const onAccept = pathname === '/portal/accept' || pathname.startsWith('/portal/accept/')

  useEffect(() => {
    if (onAccept) return
    let cancelled = false
    fetch('/api/portal/session', { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 401) {
          setPhase('unauth')
          router.replace(`/login?next=${encodeURIComponent(pathname)}`)
          return
        }
        const body = await res.json().catch(() => ({}))
        if (res.status === 403) {
          setPhase(body.error === 'Password change required' ? 'password' : 'noaccess')
          return
        }
        if (!res.ok) {
          setPhase('error')
          return
        }
        setSession({
          tenants: body.tenants ?? [],
          profile: body.profile ?? { email: null, name: null, mustChangePassword: false },
          contextTenantId: body.contextTenantId ?? '',
        })
        setPhase('ok')
      })
      .catch(() => {
        if (!cancelled) setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [onAccept, pathname, router])

  // Invite redemption: bare branded frame, no session required.
  if (onAccept) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <header className="flex items-center gap-2.5 px-4 py-4 md:px-8">
          <Brand />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-6 md:px-8">
          <div className="w-full max-w-xl">{children}</div>
        </main>
        <footer className="px-4 pb-8 text-center text-xs text-muted-foreground md:px-8">
          Property operations, calmly organized.
        </footer>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <PageLoader title="Opening your portal..." />
      </div>
    )
  }

  if (phase === 'unauth') return null // already redirecting to /login

  if (phase === 'password') {
    return (
      <CenteredCard
        title="Set your password"
        description="Finish setting up your account before entering the portal."
      >
        <div className="flex flex-col gap-2">
          <Button variant="primary" asChild>
            <Link href="/change-password">Set password</Link>
          </Button>
          <Button variant="ghost" onClick={portalSignOut}>
            Sign out
          </Button>
        </div>
      </CenteredCard>
    )
  }

  if (phase === 'noaccess') {
    return (
      <CenteredCard
        title="No portal access"
        description="This account is not linked to an active tenancy. If you expect portal access, ask your property manager to invite you."
      >
        <Button variant="outline" onClick={portalSignOut}>
          Sign out
        </Button>
      </CenteredCard>
    )
  }

  if (phase === 'error' || !session) {
    return (
      <CenteredCard
        title="Something went wrong"
        description="We could not open your portal. Check your connection and try again."
      >
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </CenteredCard>
    )
  }

  return (
    <PortalSessionContext.Provider value={session}>
      <div className="flex min-h-svh flex-col bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8">
            <Link href="/portal" aria-label="Portal home">
              <Brand />
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <TenantPicker tenants={session.tenants} current={session.contextTenantId} />
              <Button
                variant="ghost"
                size="sm"
                onClick={portalSignOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
          <nav aria-label="Portal" className="mx-auto max-w-5xl overflow-x-auto px-4 md:px-8">
            <div className="flex gap-1 pb-2">
              {NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </nav>
          {session.profile.mustChangePassword ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200">
              Set a permanent password to unlock everything —{' '}
              <Link href="/change-password" className="underline underline-offset-2">
                change password
              </Link>
            </div>
          ) : null}
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">{children}</main>
        <footer className="px-4 pb-8 pt-2 text-center text-xs text-muted-foreground md:px-8">
          Your tenancy, in one place.
        </footer>
      </div>
    </PortalSessionContext.Provider>
  )
}
