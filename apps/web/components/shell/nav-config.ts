/**
 * Navigation model for the app shell.
 *
 * A single source of truth for sidebar + mobile nav items. Each entry carries
 * the permission key required to SEE it in the UI (`uiPermission`). This is a
 * UX filter only — the server remains the real authorization gate on every
 * API route. Never render an action the server would deny (design.json
 * navigation.note + multi-tenant-auth rule 3).
 */

import {
  LayoutDashboard,
  Building2,
  KeyRound,
  Users,
  Wallet,
  Wrench,
  CalendarDays,
  FileText,
  BarChart3,
  Settings,
  BookOpen,
  HelpCircle,
  MessageCircleQuestion,
  Plug,
  type LucideIcon,
} from 'lucide-react'

export interface NavEntry {
  label: string
  href: string
  icon: LucideIcon
  /** Permission key required to surface this item. Omit = always visible. */
  uiPermission?: string
  /** Pin to the mobile bottom tab bar (app-style primary navigation). */
  tab?: boolean
}

export interface NavSection {
  /** Uppercase overline label (design.json typography.overline). */
  overline: string
  items: NavEntry[]
}

/** MENU — core workspace modules (design.json navigation.primary). */
export const menuSection: NavSection = {
  overline: 'Menu',
  items: [
    { label: 'Overview', href: '/', icon: LayoutDashboard, tab: true },
    { label: 'Portfolio', href: '/portfolio', icon: Building2, uiPermission: 'resource.read' },
    { label: 'Leasing', href: '/leasing', icon: KeyRound, uiPermission: 'resource.read' },
    { label: 'People', href: '/people', icon: Users, uiPermission: 'user.read', tab: true },
    { label: 'Finances', href: '/finances', icon: Wallet, uiPermission: 'resource.read' },
    { label: 'Maintenance', href: '/maintenance', icon: Wrench, uiPermission: 'resource.read' },
    { label: 'Calendar', href: '/calendar', icon: CalendarDays, uiPermission: 'resource.read' },
    { label: 'Documents', href: '/documents', icon: FileText, uiPermission: 'resource.read' },
    { label: 'Reports', href: '/reports', icon: BarChart3, uiPermission: 'audit.read' },
  ],
}

/** HELP & SUPPORT — secondary (design.json navigation.help). */
export const helpSection: NavSection = {
  overline: 'Help & Support',
  items: [
    { label: "User's Guide", href: '/guide', icon: BookOpen },
    { label: 'FAQ', href: '/faq', icon: HelpCircle },
    { label: 'Contact Support', href: '/support', icon: MessageCircleQuestion },
  ],
}

/** SETTINGS — permission-gated admin surfaces. */
export const settingsSection: NavSection = {
  overline: 'Settings',
  items: [
    { label: 'General', href: '/settings', icon: Settings, uiPermission: 'organization.read' },
    { label: 'Roles & Permissions', href: '/roles', icon: Settings, uiPermission: 'role.read' },
    { label: 'Integrations', href: '/settings/integrations', icon: Plug, uiPermission: 'organization.read' },
  ],
}

/** All sections rendered in the sidebar, in order. */
export const navSections: NavSection[] = [menuSection, helpSection, settingsSection]

/** Bottom-tab destinations for the mobile app bar (nav entries with tab: true). */
export const mobileTabItems: NavEntry[] = menuSection.items.filter((item) => item.tab)

/** Shared active-link check (root `/` is exact-only). */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Auto page title for the mobile app bar, derived from the nav model.
 * Exact matches win; otherwise the longest matching section prefix is used.
 */
export function navTitleForPath(pathname: string): string | null {
  const all = navSections.flatMap((section) => section.items)
  for (const item of all) {
    if (item.href === pathname) return item.label
  }
  let best: { len: number; label: string } | null = null
  for (const item of all) {
    if (item.href === '/') continue
    if (pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.len) {
        best = { len: item.href.length, label: item.label }
      }
    }
  }
  return best?.label ?? null
}
