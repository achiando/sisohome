'use client'

/**
 * Authenticated app shell — native-app layout.
 *
 * Desktop (≥768px): fixed left Sidebar (collapsible) + page content; each
 * page renders its own header inside the content region.
 *
 * Mobile (<768px): app chrome, not a responsive website —
 * - Top app bar: dynamic per-page title (auto-derived from nav-config via
 *   navTitleForPath) + workspace avatar → More sheet. Safe-area padded.
 * - Bottom tab bar: pinned primary destinations + More (always visible).
 * - Content: full-bleed, padded above the tab bar.
 * No hamburger drawer on mobile — tabs are the navigation.
 *
 * Gates: unauthenticated → login; temporary password → forced change;
 * no active org → onboarding (server APIs enforce independently).
 */

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from '@workspace/ui/components/sidebar'
import { useAuth } from '@workspace/auth-ui'

import { SidebarNav } from './sidebar-nav'
import { MobileTabBar } from './mobile-tab-bar'
import { MoreSheet } from './more-sheet'
import { navTitleForPath } from './nav-config'

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, needsOnboarding, needsPasswordChange, user } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  // Gate: unauthenticated → login; temporary password → forced change;
  // no active org → onboarding.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      // Stale cookies (expired session): clear them so the optimistic proxy
      // stops treating the browser as signed in.
      void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(
        () => {}
      );
      router.replace('/login');
    } else if (needsPasswordChange) router.replace('/change-password');
    else if (needsOnboarding) router.replace('/onboarding');
  }, [isLoading, isAuthenticated, needsOnboarding, needsPasswordChange, router]);

  // Unauthenticated: redirect is in flight — render nothing (a spinner here
  // would read as "stuck loading" whenever the redirect takes a moment).
  if (!isLoading && !isAuthenticated) return null

  if (isLoading || needsPasswordChange || needsOnboarding) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-10 animate-pulse items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-lg font-bold leading-none">S</span>
          </span>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  // Dynamic app-bar title from the nav model (exact match, then longest prefix).
  const title = navTitleForPath(pathname) ?? 'SisoHome'

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full overflow-x-clip bg-background">
        {/* Desktop sidebar (renders as an off-canvas sheet on mobile, unused there) */}
        <Sidebar collapsible="offcanvas">
          <SidebarNav />
        </Sidebar>

        {/* min-w-0: flex children default to min-width:auto — without it a wide
            child (table, long badge row) expands the row and scrolls the whole
            page horizontally. */}
        <SidebarInset className="min-h-svh min-w-0">
          {/* Mobile app bar — per-page dynamic title + workspace avatar */}
          <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
            <div className="flex h-14 items-center gap-3 px-4">
              <span className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight text-foreground">
                {title}
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-label="Open menu"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground"
              >
                {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
              </button>
            </div>
          </header>

          {/* Page content — shell owns the page gutters (horizontal padding +
              top spacing) so every page inherits them; mobile bottom padding
              clears the tab bar + home indicator; max-w centers the column so
              pages breathe on wide screens. */}
          <div className="flex min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-8 md:pt-8">
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>

      {/* App-style navigation: bottom tabs + More sheet (mobile only) */}
      <MobileTabBar onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </SidebarProvider>
  )
}
