'use client'

/**
 * Mobile bottom tab bar — the app-style primary navigation on phones.
 * Replaces the hamburger/drawer pattern: tabs are always visible, touch
 * targets ≥44px, safe-area inset respected (viewportFit cover is set in
 * the root viewport).
 *
 * Destinations come from nav-config (`tab: true`); everything else lives
 * in the More bottom sheet.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'

import { cn } from '@workspace/ui/lib/utils'
import { isActive, mobileTabItems, navSections } from './nav-config'

export function MobileTabBar({ onMore }: { onMore: () => void }) {
  const pathname = usePathname()

  // "More" lights up when the current page isn't one of the pinned tabs.
  const moreActive = navSections
    .flatMap((section) => section.items)
    .some((item) => !item.tab && isActive(pathname, item.href))

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid h-16 grid-cols-3">
        {mobileTabItems.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={onMore}
          aria-label="More"
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
            moreActive ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <MoreHorizontal className="size-5" />
          More
        </button>
      </div>
    </nav>
  )
}
