import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { getAllCategories } from "@/lib/products"
import { getWhatsAppBaseLink } from "@/lib/quote-basket"
import { getPhoneDisplay, getPhoneTel } from "@/lib/contact"

export async function Footer() {
  const categories = await getAllCategories()
  const whatsappLink = getWhatsAppBaseLink()
  const phoneDisplay = getPhoneDisplay()
  const phoneTel = getPhoneTel()

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-bold">
              TijwaWelders <span className="text-primary">DIY</span>
            </h3>
            <p className="text-sm text-muted-foreground">
              Tools, electronics components and project parts with practical
              project ideas — request a quotation when you know what you need.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Products</h4>
            <ul className="space-y-2 text-sm">
              {categories.length > 0 ? (
                categories.slice(0, 6).map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/products/${category.slug}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li>
                  <Link href="/products" className="text-muted-foreground hover:text-foreground">
                    All Products
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/products" className="text-muted-foreground hover:text-foreground">
                  Products
                </Link>
              </li>
              <li>
                <Link href="/projects" className="text-muted-foreground hover:text-foreground">
                  Projects
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-muted-foreground hover:text-foreground">
                  Search
                </Link>
              </li>
              <li>
                <Link href="/quote" className="text-muted-foreground hover:text-foreground">
                  Your Quote
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Contact</h4>
            <ul className="space-y-2 text-sm">
              {phoneTel && (
                <li className="text-muted-foreground">
                  <a
                    href={phoneTel}
                    className="hover:text-foreground"
                  >
                    {phoneDisplay}
                  </a>
                </li>
              )}
              <li className="text-muted-foreground">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  WhatsApp
                </a>
              </li>
              <li className="text-muted-foreground">
                <a href="mailto:info@tijwawelders.com" className="hover:text-foreground">
                  info@tijwawelders.com
                </a>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-foreground">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
            <Link href="/quote">
              <Button variant="primary" size="md" className="w-full">
                Get a Quote
              </Button>
            </Link>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TijwaWelders DIY. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
