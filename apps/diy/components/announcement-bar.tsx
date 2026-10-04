"use client"

import { useEffect, useState } from "react"
import { MessageCircle, Phone } from "lucide-react"
import { getWhatsAppBaseLink } from "@/lib/quote-basket"
import { getPhoneDisplay, getPhoneTel } from "@/lib/contact"

const messages = [
  "If what you're looking for is missing, call us — we'll help you find it",
  "Building a project? Tell us what you're building and we'll help with the parts",
  "School or training centre? Ask us about supplying a fully equipped lab",
  "Add products to your quote and get a quotation on WhatsApp",
]

export function AnnouncementBar() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % messages.length)
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const phoneDisplay = getPhoneDisplay()
  const phoneTel = getPhoneTel()

  return (
    <div className="bg-primary text-primary-foreground">
      <div className="container mx-auto flex h-10 items-center justify-between gap-4 px-4 text-xs">

      <p aria-live="polite" className="truncate text-right font-medium">
          {messages[index]}
        </p>
        <div className="flex h-full shrink-0 items-center gap-4">
          {phoneTel && (
            <a
              href={phoneTel}
              className="flex h-full items-center gap-1.5 font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              aria-label={`Call us on ${phoneDisplay}`}
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{phoneDisplay}</span>
            </a>
          )}
          <a
            href={getWhatsAppBaseLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full items-center gap-1.5 font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            aria-label="Chat with us on WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>

      </div>
    </div>
  )
}
