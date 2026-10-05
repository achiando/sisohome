"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetTrigger } from "@workspace/ui/components/sheet"
import { Badge } from "@workspace/ui/components/badge"
import { getQuoteBasketCount, getDirectWhatsAppLink, onQuoteBasketChanged } from "@/lib/quote-basket"

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [quoteCount, setQuoteCount] = useState(0)

  useEffect(() => {
    setQuoteCount(getQuoteBasketCount())
    return onQuoteBasketChanged(() => setQuoteCount(getQuoteBasketCount()))
  }, [])

  const navigation = [
    { name: 'Products', href: '/products' },
    { name: 'Projects', href: '/projects' },
    { name: 'Services', href: '/services' },
    { name: 'Guides', href: '/guides' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ]

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button className="md:hidden p-2 -mr-2">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <span className="text-xl font-bold">TIJWAWELDERS</span>
              <button onClick={() => setIsOpen(false)} className="p-2">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-6">
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

            {/* CTA */}
            <div className="p-6 border-t space-y-3">
              <a 
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`} 
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
              >
                <Button variant="primary" size="lg" className="w-full">
                  WhatsApp
                </Button>
              </a>
              {quoteCount > 0 ? (
                <Link href="/quote" onClick={() => setIsOpen(false)} className="relative block">
                  <Button variant="outline" size="lg" className="w-full">
                    Get a Quote
                  </Button>
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-white text-xs">
                    {quoteCount}
                  </Badge>
                </Link>
              ) : (
                <a
                  href={getDirectWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                >
                  <Button variant="outline" size="lg" className="w-full">
                    Get a Quote
                  </Button>
                </a>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
