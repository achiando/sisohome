import Link from 'next/link'
import type { Metadata } from 'next'

/**
 * (auth) route group layout — shared branded frame for the public
 * authentication screens (login / signup / forgot-password).
 *
 * Light, calm canvas per design.json. A centered card on desktop; on mobile
 * the card fills the width with comfortable padding. A top brand bar links
 * back home, and a footer carries the cross-links so each page only renders
 * its own form.
 */

export const metadata: Metadata = {
  title: 'Sign in',
}

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Brand bar */}
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="SisoHome home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-base font-bold leading-none">S</span>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            SisoHome
          </span>
        </Link>
      </header>

      {/* Centered content */}
      <main className="flex flex-1 items-center justify-center px-4 py-6 md:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Footer note */}
      <footer className="px-4 pb-8 text-center text-xs text-muted-foreground md:px-8">
        Property operations, calmly organized.
      </footer>
    </div>
  )
}
