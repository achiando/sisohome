"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@workspace/ui/lib/utils"
import { NavItem } from "./nav-item"
import { Sheet, SheetContent, SheetTrigger } from "./sheet"
import { Button } from "./button"
import { Menu } from "lucide-react"

export interface SectionNavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active?: boolean
  activeVariant?: "default" | "primary"
  /** Optional separator rendered after this item */
  separator?: boolean
}

interface SectionNavProps {
  items: SectionNavItem[]
  title: string
  className?: string
  width?: string
}

export function SectionNav({
  items,
  title,
  className,
  width = "w-52",
}: SectionNavProps) {
  const [open, setOpen] = React.useState(false)
  const activeItem = items.find((i) => i.active)

  return (
    <>
      {/* Mobile: trigger → Sheet */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Menu className="h-4 w-4" />
              <span className="truncate text-sm font-medium">
                {activeItem?.label ?? title}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" size="sm" title={title}>
            <nav className="flex flex-col gap-0.5 pt-2">
              {items.map((item) => (
                <React.Fragment key={item.href}>
                  <Link href={item.href} onClick={() => setOpen(false)}>
                    <NavItem
                      icon={item.icon}
                      label={item.label}
                      active={item.active}
                      activeVariant={item.activeVariant}
                    />
                  </Link>
                  {item.separator && <div className="my-3 h-px bg-border" />}
                </React.Fragment>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: sidebar */}
      <nav className={cn("hidden shrink-0 md:block", width, className)}>
        <div className="space-y-1">
          {items.map((item) => (
            <React.Fragment key={item.href}>
              <Link href={item.href}>
                <NavItem
                  icon={item.icon}
                  label={item.label}
                  active={item.active}
                  activeVariant={item.activeVariant}
                />
              </Link>
              {item.separator && <div className="my-3 h-px bg-border" />}
            </React.Fragment>
          ))}
        </div>
      </nav>
    </>
  )
}
