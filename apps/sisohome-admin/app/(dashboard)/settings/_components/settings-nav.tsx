'use client'

/**
 * Settings sub-navigation — the nested sidebar for the /settings section.
 *
 * Desktop: vertical sub-sidebar next to the settings content.
 * Mobile: horizontally scrollable pill row (native-app pattern), sitting
 * under the shell app bar that already shows "Settings".
 *
 * Items are permission-filtered (UX only — the server gates each page/API).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  Plug,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react'

import { useUiPermission } from '@/components/shell/use-ui-permission'
import { cn } from '@workspace/ui/lib/utils'

export interface SettingsNavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Permission key required to see the item. Omit = always visible. */
  uiPermission?: string
  /** Match this href exactly (the `/settings` root). */
  exact?: boolean
}

export const settingsNavItems: SettingsNavItem[] = [
  { label: 'Profile', href: '/settings', icon: User, exact: true },
  { label: 'General', href: '/settings/general', icon: Building2, uiPermission: 'organization.read' },
  { label: 'Roles & Permissions', href: '/settings/roles', icon: ShieldCheck, uiPermission: 'role.read' },
  { label: 'Integrations', href: '/settings/integrations', icon: Plug, uiPermission: 'organization.read' },
]

function isActivePath(pathname: string, item: SettingsNavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function SettingsNav() {
  const pathname = usePathname()
  const { hasUiPermission } = useUiPermission()

  const items = settingsNavItems.filter((item) => hasUiPermission(item.uiPermission))
  if (items.length === 0) return null

  return (
    <>
      {/* Desktop — vertical sub-sidebar (44px touch rows) */}
      <nav className="hidden md:block" aria-label="Settings sections">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActivePath(pathname, item)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors active:scale-[0.98]',
                    active
                      ? 'border border-border bg-accent text-accent-foreground shadow-xs'
                      : 'border border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Mobile — scrollable pill row (matches filter-chip conventions) */}
      <nav className="flex gap-2 overflow-x-auto pb-1 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Settings sections">
        {items.map((item) => {
          const active = isActivePath(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-all active:scale-[0.97]',
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border/70 bg-card text-muted-foreground'
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
