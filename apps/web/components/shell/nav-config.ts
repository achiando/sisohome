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
  Handshake,
  CalendarDays,
  FileText,
  BarChart3,
  Settings,
  BookOpen,
  HelpCircle,
  MessageCircleQuestion,
  Boxes,
  UserRound,
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
  /** Nested entries rendered as an expandable sub-nav (Portfolio register). */
  children?: NavEntry[]
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
    // Real domain keys from the permission catalog (phase-2 slices land the
    // pages behind each link; nav hides items the session's keys exclude).
    // Portfolio carries the register sub-nav (Properties / Units / Owners /
    // Agreements) — same pattern as the siso-design portfolio mockup.
    {
      label: 'Portfolio',
      href: '/portfolio',
      icon: Building2,
      uiPermission: 'property.list',
      children: [
        { label: 'Properties', href: '/portfolio', icon: Building2, uiPermission: 'property.list' },
        { label: 'Units', href: '/units', icon: Boxes, uiPermission: 'unit.list' },
        { label: 'Owners', href: '/portfolio/owners', icon: UserRound, uiPermission: 'ownership.list' },
        { label: 'Agreements', href: '/portfolio/owners/agreements', icon: Handshake, uiPermission: 'agreement.list' },
      ],
    },
    { label: 'Leasing', href: '/leasing', icon: KeyRound, uiPermission: 'lease.list' },
    { label: 'People', href: '/people', icon: Users, uiPermission: 'user.read', tab: true },
    { label: 'Finances', href: '/finances', icon: Wallet, uiPermission: 'charge.list' },
    { label: 'Maintenance', href: '/maintenance', icon: Wrench, uiPermission: 'maintenance.list' },
    { label: 'Sales', href: '/sales', icon: Handshake, uiPermission: 'listing.list' },
    { label: 'Calendar', href: '/calendar', icon: CalendarDays, uiPermission: 'property.read' },
    { label: 'Documents', href: '/documents', icon: FileText, uiPermission: 'document.read' },
    { label: 'Reports', href: '/reports', icon: BarChart3, uiPermission: 'audit.read' },
    // Single Settings entry — opens the settings area, which carries its own
    // nested nav (Profile, General, Roles & Permissions, Integrations).
    { label: 'Settings', href: '/settings', icon: Settings },
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

/** All sections rendered in the sidebar, in order. Settings is a single
 *  entry at the end of MENU — its sub-pages carry a nested nav inside the
 *  /settings layout (app/(dashboard)/settings/_components/settings-nav). */
export const navSections: NavSection[] = [menuSection, helpSection]

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
  const all = navSections.flatMap((section) =>
    section.items.flatMap((item) => [item, ...(item.children ?? [])]),
  )
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
