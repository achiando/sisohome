"use client"

import Link from "next/link"
import { Search, ShoppingBasket } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { MobileNavigation } from "./mobile-navigation"
import { getQuoteBasketCount, QUOTE_BASKET_EVENT } from "@/lib/quote-basket"
import { useEffect, useState } from "react"

const navLinks = [
  { href: "/products", label: "Products" },
  { href: "/projects", label: "Projects" },
]

export function Header() {
  const [quoteCount, setQuoteCount] = useState(0)

  useEffect(() => {
    const syncCount = () => setQuoteCount(getQuoteBasketCount())
    syncCount()
    window.addEventListener(QUOTE_BASKET_EVENT, syncCount)
    return () => window.removeEventListener(QUOTE_BASKET_EVENT, syncCount)
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          {/* <span className="text-xl font-bold tracking-tight">
            Tijwa <span className="text-primary">DIY</span>
          </span> */}
          <span className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight text-slate-950">
            ODHERU <span className="text-amber-600">ELECTRONICS</span>
          </span>
        </Link>

        <nav
          className="hidden items-center space-x-6 md:flex"
          aria-label="Main navigation"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <form
            action="/search"
            method="get"
            role="search"
            className="hidden w-48 lg:block"
          >
            <Input
              type="search"
              name="q"
              placeholder="Search..."
              aria-label="Search products and projects"
              leftIcon={<Search className="size-4" aria-hidden="true" />}
              className="h-11"
            />
          </form>

          <Link
            href="/search"
            aria-label="Search products and projects"
            className="p-2 lg:hidden"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>

          {/* Mobile: basket icon with badge counter */}
          <Link
            href="/quote"
            aria-label={
              quoteCount > 0
                ? `Your quote, ${quoteCount} item${quoteCount === 1 ? "" : "s"}`
                : "Your quote"
            }
            className="relative -mr-1 rounded-xl p-2.5 hover:bg-muted md:hidden"
          >
            <ShoppingBasket className="h-6 w-6" aria-hidden="true" />
            {quoteCount > 0 && (
              <Badge className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs text-white">
                {quoteCount > 99 ? "99+" : quoteCount}
              </Badge>
            )}
          </Link>

          {/* Desktop: Get a Quote button */}
          <Link href="/quote" className="relative hidden md:block">
            <Button variant="primary" size="md">
              Cart
            </Button>
            {quoteCount > 0 && (
              <Badge className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs text-white">
                {quoteCount > 99 ? "99+" : quoteCount}
              </Badge>
            )}
          </Link>

          <MobileNavigation />
        </div>
      </div>
    </header>
  )
}
