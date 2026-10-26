import type { Metadata } from 'next'

import { PortalFrame } from './_components/portal-frame'

/**
 * `/portal` route group — the org-less tenant shell (plan-slice-7 §3).
 * The frame handles the client-side guard; `/portal/accept` renders inside
 * it as a bare branded page (invite redemption needs no session). Portal
 * pages are capability-adjacent account surfaces — keep them out of
 * search results like the auth + intake shells do.
 */

export const metadata: Metadata = {
  title: {
    default: 'Tenant Portal',
    template: '%s · SisoHome Portal',
  },
  robots: { index: false, follow: false },
}

export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PortalFrame>{children}</PortalFrame>
}
