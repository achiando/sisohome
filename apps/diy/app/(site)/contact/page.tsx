import Link from "next/link"
import type { Metadata } from "next"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { getWhatsAppBaseLink } from "@/lib/quote-basket"
import { MessageCircle, Mail, ClipboardList } from "lucide-react"

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact TijwaWelders DIY for product and project quotations. WhatsApp is the fastest way to reach us; email is the fallback.",
  alternates: { canonical: "/contact" },
}

const quoteTips = [
  "Product names or links from the catalog",
  "Quantities for each item (and pack sizes where they matter)",
  "The project name, if your quote started from a project page",
  "Your location and timeline, so we can confirm what is practical",
]

export default function ContactPage() {
  const whatsappLink = getWhatsAppBaseLink()

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Contact TijwaWelders DIY</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Quotations are handled by a real person. WhatsApp is the fastest
          route; email works when you prefer to write things down.
        </p>
      </div>

      <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="border-2 border-primary">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold mb-2">WhatsApp</h2>
            <p className="text-muted-foreground mb-4">
              Primary contact channel — usually the quickest reply
            </p>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="primary" size="lg" className="w-full">
                Start WhatsApp Chat
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold mb-2">Email</h2>
            <p className="text-muted-foreground mb-4">
              For detailed requests and attachments
            </p>
            <a href="mailto:info@tijwawelders.com" className="block">
              <Button variant="outline" size="lg" className="w-full">
                info@tijwawelders.com
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold mb-2">Your Quote</h2>
            <p className="text-muted-foreground mb-4">
              Already picked products? Send the quote you assembled
            </p>
            <Link href="/quote" className="block">
              <Button variant="outline" size="lg" className="w-full">
                Review Your Quote
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <section className="mb-16 max-w-3xl">
        <h2 className="text-2xl font-semibold mb-4">What to include</h2>
        <p className="text-muted-foreground mb-4">
          The more complete the first message, the faster we can price it.
        </p>
        <ul className="space-y-3">
          {quoteTips.map((tip) => (
            <li key={tip} className="flex items-start">
              <span className="text-primary mr-2" aria-hidden="true">
                ✓
              </span>
              <span className="text-muted-foreground">{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-muted/50 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Not sure where to start?</h2>
        <p className="text-muted-foreground mb-6">
          Browse the catalog or open a project — add items as you go, then
          send everything in one message
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/products">
            <Button variant="primary" size="lg">
              Browse Products
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="outline" size="lg">
              Explore Projects
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
