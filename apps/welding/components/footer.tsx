import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { getAllCategories } from "@/lib/products"

export async function Footer() {
  const categories = await getAllCategories()

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">TIJWAWELDERS</h3>
            <p className="text-sm text-muted-foreground">
              Premium steel fabrication for residential, commercial, and structural projects.
            </p>
          </div>

          {/* Products */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Products</h4>
            <ul className="space-y-2 text-sm">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <li key={category.id}>
                    <Link href={`/products/${category.slug}`} className="text-muted-foreground hover:text-foreground">
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

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/projects" className="text-muted-foreground hover:text-foreground">Projects</Link></li>
              <li><Link href="/services" className="text-muted-foreground hover:text-foreground">Services</Link></li>
              <li><Link href="/guides" className="text-muted-foreground hover:text-foreground">Materials & Guides</Link></li>
              <li><Link href="/about" className="text-muted-foreground hover:text-foreground">About</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li className="text-muted-foreground">
                <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`} className="hover:text-foreground">
                  WhatsApp
                </a>
              </li>
              <li className="text-muted-foreground">
                <a href="mailto:info@tijwawelders.com" className="hover:text-foreground">
                  Email
                </a>
              </li>
              <li className="text-muted-foreground">
                <a href={`tel:${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`} className="hover:text-foreground">
                  Phone
                </a>
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
          <p>&copy; {new Date().getFullYear()} TijwaWelders. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
