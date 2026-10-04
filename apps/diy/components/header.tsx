"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { MobileNavigation } from "./mobile-navigation"
import { getQuoteBasketCount, QUOTE_BASKET_EVENT } from "@/lib/quote-basket"
import { useEffect, useState } from "react"

const navLinks = [
  { href: "/products", label: "Products" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
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
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold tracking-tight">
            TijwaWelders <span className="text-primary">DIY</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium hover:text-primary transition-colors"
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
            className="lg:hidden p-2"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>

          <Link href="/quote" className="relative">
            <Button variant="primary" size="md">
              Get a Quote
            </Button>
            {quoteCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-white text-xs">
                {quoteCount}
              </Badge>
            )}
          </Link>

          <MobileNavigation />
        </div>
      </div>
    </header>
  )
}
