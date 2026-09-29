"use client"

import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { MobileNavigation } from "./mobile-navigation"
import { getQuoteBasketCount } from "@/lib/quote-basket"
import { useEffect, useState } from "react"

export function Header() {
  const [quoteCount, setQuoteCount] = useState(0)

  useEffect(() => {
    setQuoteCount(getQuoteBasketCount())
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold tracking-tight">TIJWAWELDERS</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/products" className="text-sm font-medium hover:text-primary transition-colors">
            Products
          </Link>
          <Link href="/projects" className="text-sm font-medium hover:text-primary transition-colors">
            Projects
          </Link>
          <Link href="/services" className="text-sm font-medium hover:text-primary transition-colors">
            Services
          </Link>
          <Link href="/guides" className="text-sm font-medium hover:text-primary transition-colors">
            Guides
          </Link>
          <Link href="/about" className="text-sm font-medium hover:text-primary transition-colors">
            About
          </Link>
          <Link href="/contact" className="text-sm font-medium hover:text-primary transition-colors">
            Contact
          </Link>
        </nav>

        {/* CTA Button with Quote Badge */}
        <div className="flex items-center space-x-4">
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
          
          {/* Mobile Menu Button */}
          <MobileNavigation />
        </div>
      </div>
    </header>
  )
}
