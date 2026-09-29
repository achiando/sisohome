"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Package } from "lucide-react"
import { NavItem } from "@workspace/ui/components/nav-item"

const links = [{ href: "/admin/products", label: "Products", icon: Package }]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-row gap-1 md:flex-col">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="flex-1 md:flex-none">
          <NavItem label={link.label} icon={link.icon} active={pathname.startsWith(link.href)} />
        </Link>
      ))}
    </nav>
  )
}
