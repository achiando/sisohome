'use client'

/**
 * Mobile "More" bottom sheet — everything that isn't pinned to the tab
 * bar: the remaining nav sections (permission-filtered), new-workspace
 * entry point, and sign out. Bottom sheet + swipe-to-dismiss = app feel.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, LogOut } from 'lucide-react'

import { Sheet, SheetContent } from '@workspace/ui/components/sheet'
import { cn } from '@workspace/ui/lib/utils'
import { useAuth } from '@workspace/auth-ui'

import { isActive, navSections } from './nav-config'
import { useUiPermission } from './use-ui-permission'

export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname()
  const { hasUiPermission } = useUiPermission()
  const { user, logout } = useAuth()

  const sections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.tab && hasUiPermission(item.uiPermission),
      ),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        title="SisoHome"
        description={user?.email}
        className="max-h-[80svh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
      >
        {sections.map((section) => (
          <div key={section.overline}>
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {section.overline}
            </p>
            <div className="mt-1.5 flex flex-col gap-1">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                      active
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    )}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {active && <span className="size-1.5 rounded-full bg-primary" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {/* App-level actions */}
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <Link
            href="/create-organization"
            onClick={() => onOpenChange(false)}
            className="flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/50"
          >
            <Plus className="size-5" />
            New workspace
          </Link>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              logout()
            }}
            className="flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-5" />
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
