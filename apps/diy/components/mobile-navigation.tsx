"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@workspace/ui/components/sheet"
import { Badge } from "@workspace/ui/components/badge"
import { getQuoteBasketCount, getWhatsAppBaseLink } from "@/lib/quote-basket"

const navigation = [
  { name: "Products", href: "/products" },
  { name: "Projects", href: "/projects" },
  { name: "Quote", href: "/quote" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
]

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [quoteCount, setQuoteCount] = useState(0)

  useEffect(() => {
    setQuoteCount(getQuoteBasketCount())
  }, [])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button className="md:hidden p-2 -mr-2" aria-label="Open menu">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetTitle className="text-xl font-bold">TijwaWelders DIY</SheetTitle>

        <nav className="flex-1 mt-6" aria-label="Mobile navigation">
          <ul className="space-y-4">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="text-lg font-medium hover:text-primary transition-colors block"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 space-y-3">
          <a
            href={getWhatsAppBaseLink()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
          >
            <Button variant="primary" size="lg" className="w-full">
              WhatsApp
            </Button>
          </a>
          <Link href="/quote" onClick={() => setIsOpen(false)} className="relative block">
            <Button variant="outline" size="lg" className="w-full">
              Get a Quote
            </Button>
            {quoteCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-white text-xs">
                {quoteCount}
              </Badge>
            )}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
