'use client'

/**
 * (dashboard) route group layout.
 *
 * Wraps every authenticated app page in the AppShell (sidebar + mobile
 * sheet nav). AppShell itself handles the auth/onboarding redirects and
 * renders a loading state until the session resolves, so child pages can
 * assume an authenticated user with an active organization.
 */

import { AppShell } from '@/components/shell/app-shell'

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>
}
