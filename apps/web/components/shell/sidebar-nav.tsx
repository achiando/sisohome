"use client"

/**
 * Sidebar navigation content — shared by the desktop Sidebar and the mobile
 * Sheet so both stay in sync (design.json layout.sidebar).
 *
 * Order: brand + collapse → QUICK ACTIONS search (⌘K) → MENU nav →
 * HELP & SUPPORT → settings → user profile footer.
 * Active item = white pill (1px border + navActive shadow + ink label).
 * Items are filtered by permission via useUiPermission (UX only; server is
 * the real gate).
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { Search, ChevronsUpDown, LogOut, ChevronRight } from "lucide-react"

import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { Input } from "@workspace/ui/components/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useAuth } from "@workspace/auth-ui"

import { isActive, navSections, type NavEntry } from "./nav-config"
import { useUiPermission } from "./use-ui-permission"

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { hasUiPermission } = useUiPermission()
  const { setOpenMobile } = useSidebar()
  const { user, logout } = useAuth()
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Filter menu items by permission + search query. A parent stays visible
  // when the query matches one of its children.
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    return navSections
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item: NavEntry) => hasUiPermission(item.uiPermission))
          .map((item: NavEntry) => ({
            ...item,
            children: (item.children ?? []).filter(
              (child) =>
                hasUiPermission(child.uiPermission) &&
                (q ? child.label.toLowerCase().includes(q) : true),
            ),
          }))
          .filter(
            (item: NavEntry & { children: NavEntry[] }) =>
              q
                ? item.label.toLowerCase().includes(q) || item.children.length > 0
                : true,
          ),
      }))
      .filter((section) => section.items.length > 0)
  }, [hasUiPermission, query])

  const toggleExpanded = (href: string) =>
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }))

  const handleNavigate = () => {
    setOpenMobile(false)
    onNavigate?.()
  }

  return (
    <>
      {/* Brand + add-org shortcut */}
      <SidebarHeader className="px-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            onClick={handleNavigate}
            className="flex items-center gap-2.5"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="text-base leading-none font-bold">S</span>
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              SisoHome
            </span>
          </Link>
        </div>

        {/* Workspace chip — active org + role */}
        {/* <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[12px] font-semibold text-accent-foreground">
            {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight text-foreground">
              {user?.name || user?.email}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {user?.roles?.length ? user.roles.join(', ') : 'Member'}
            </p>
          </div>
        </div> */}
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-2 py-2">
        {/* QUICK ACTIONS search (⌘K hint) */}
        <SidebarGroup className="pb-1">
          <SidebarGroupLabel className="tracking-[0.08em] text-muted-foreground uppercase">
            Quick Actions
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="h-11 rounded-xl pr-14 pl-9"
                aria-label="Search navigation"
              />
              <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                ⌘K
              </kbd>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* MENU + HELP + SETTINGS sections, permission-filtered */}
        {sections.map((section) => (
          <SidebarGroup key={section.overline}>
            <SidebarGroupLabel className="tracking-[0.08em] text-muted-foreground uppercase">
              {section.overline}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href)
                  const hasChildren = item.children.length > 0
                  const childActive =
                    hasChildren && item.children.some((c) => isActive(pathname, c.href))
                  const isOpen = expanded[item.href] ?? (active || childActive)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={
                          <Link href={item.href} onClick={handleNavigate} />
                        }
                        isActive={active}
                        className={
                          active
                            ? "h-11 rounded-xl border border-border bg-background font-medium text-foreground shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                            : "h-11 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
                        }
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </SidebarMenuButton>
                      {hasChildren && (
                        <SidebarMenuAction
                          showOnHover={false}
                          onClick={() => toggleExpanded(item.href)}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.label} sub-nav`}
                          className="size-6 data-[state=open]:rotate-90"
                          data-state={isOpen ? 'open' : 'closed'}
                        >
                          <ChevronRight className="size-3.5 transition-transform duration-200" />
                        </SidebarMenuAction>
                      )}
                      {hasChildren && isOpen && (
                        <SidebarMenuSub>
                          {item.children.map((child) => {
                            const childOn = isActive(pathname, child.href)
                            return (
                              <SidebarMenuSubItem key={child.href}>
                                <SidebarMenuSubButton
                                  render={
                                    <Link href={child.href} onClick={handleNavigate} />
                                  }
                                  isActive={childOn}
                                  className="h-9 rounded-lg"
                                >
                                  <span className="truncate">{child.label}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {sections.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No matches.
          </p>
        )}
      </SidebarContent>

      <SidebarSeparator />

      {/* User profile footer */}
      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
                {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {user?.name || user?.email}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {user?.email}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </>
  )
}
