import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { Tag } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  getAllCategories,
  getCategoryCounts,
  getFeaturedProducts,
  getProductsByCategory,
  type ProductWithCategory,
} from "@/lib/products"
import {
  getFeaturedProjects,
  getAllProjects,
  type ProjectListItem,
} from "@/lib/projects"
import { ProductCard } from "@/components/product-card"
import { ProjectCard } from "@/components/project-card"
import { CategoryChips } from "@/components/category-chips"
import { getWhatsAppBaseLink } from "@/lib/quote-basket"
import { formatKsh } from "@/lib/money"

export const revalidate = 60

export const metadata: Metadata = {
  description:
    "Discover DIY tools, electronics components and project parts, see practical projects to build, and request a quotation on WhatsApp.",
  alternates: { canonical: "/" },
}

const whyPoints = [
  {
    title: "A broad technical catalog",
    body: "Tools, electronics, modules, sensors, wiring, power and workshop equipment in one place.",
  },
  {
    title: "Projects that show what to build",
    body: "Each project lists the products you need, with quantities, so you know exactly what to ask for.",
  },
  {
    title: "Quotation by WhatsApp",
    body: "Add products or a whole project to your quote and send it straight to us on WhatsApp.",
  },
]

const browseSections = [
  { slug: "sensors", title: "Sensors", blurb: "Distance, temperature, gas, motion and more" },
  { slug: "electronics-components", title: "Electronics Components", blurb: "Resistors, capacitors, diodes and ICs" },
  { slug: "tools-workshop", title: "Tools & Workshop", blurb: "Soldering, hand tools and bench essentials" },
]

function productImages(product: ProductWithCategory): { url: string; alt?: string }[] {
  if (!Array.isArray(product.images)) return []
  return (product.images as { url?: string; alt?: string }[]).filter(
    (image): image is { url: string; alt?: string } =>
      Boolean(image) && typeof image.url === "string",
  )
}

function DealTile({ product }: { product: ProductWithCategory }) {
  const image = productImages(product)[0]
  const price = formatKsh(product.priceCents)

  return (
    <Link
      href={`/products/${product.category.slug}/${product.slug}`}
      className="group flex items-center gap-3 rounded-2xl bg-background p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
        {image && (
          <Image
            src={image.url}
            alt={image.alt || product.name}
            fill
            sizes="80px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">
          {product.category.name}
        </p>
        <p className="truncate text-sm font-semibold text-foreground">
          {product.name}
        </p>
        {price && (
          <p className="text-base font-bold text-primary">{price}</p>
        )}
      </div>
      <span
        className="pr-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      >
        →
      </span>
    </Link>
  )
}

export default async function HomePage() {
  const categories = await getAllCategories()
  const counts = await getCategoryCounts()
  const featuredProducts = await getFeaturedProducts()
  const featuredProjects = await getFeaturedProjects()
  const allProjects = featuredProjects.length > 0 ? [] : await getAllProjects()
  const projects: ProjectListItem[] = [...featuredProjects, ...allProjects].slice(0, 6)
  const browseProducts = await Promise.all(
    browseSections.map((section) => getProductsByCategory(section.slug, 6)),
  )

  const deals = featuredProducts.slice(0, 3)

  return (
    <div className="flex flex-col">
      {/* Category badges — top of the page, above the hero */}
      {categories.length > 0 && (
        <section className="border-b bg-background">
          <div className="container mx-auto px-4 py-4">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Shop by category
              </h2>
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
              <Link
                href="/products"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all →
              </Link>
            </div>
            <CategoryChips
              categories={categories}
              counts={counts}
              className="gap-2"
            />
          </div>
        </section>
      )}

      {/* Deals hero — shopping-app style featured deals banner */}
      <section className="container mx-auto px-4 pt-6 md:pt-10">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
          <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-2 md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">
                <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                Featured Deals
              </span>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                Deals for makers and repairers
              </h1>
              <p className="mt-4 max-w-xl text-base text-slate-300 sm:text-lg">
                Featured products with prices, plus everything you need for your
                next build. Add to your quote and get the full quotation in one
                WhatsApp message.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/products" className="w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="lg"
                    className="h-12 w-full px-8 sm:w-auto"
                  >
                    Browse Products
                  </Button>
                </Link>
                <a
                  href={getWhatsAppBaseLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 w-full border-white/30 bg-transparent px-8 text-white hover:bg-white/10 sm:w-auto"
                  >
                    Request a Quote on WhatsApp
                  </Button>
                </a>
              </div>
            </div>

            {deals.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Featured picks
                </p>
                {deals.map((product) => (
                  <DealTile key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured products / deals */}
      {featuredProducts.length > 0 && (
        <section className="bg-background py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
              <div>
                <h2 className="mb-2 text-2xl font-bold md:text-3xl">
                  Featured Deals
                </h2>
                <p className="text-sm text-muted-foreground md:text-base">
                  Curated picks from the catalog
                </p>
              </div>
              <Link
                href="/products"
                className="text-sm font-medium text-primary hover:underline"
              >
                All products →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-3">
              {featuredProducts.slice(0, 6).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Browse by category sections */}
      {browseSections.map((section, index) => {
        const products = browseProducts[index]
        if (!products || products.length === 0) return null

        return (
          <section
            key={section.slug}
            className={index % 2 === 1 ? "bg-muted/50 py-12 md:py-16" : "py-12 md:py-16"}
          >
            <div className="container mx-auto px-4">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
                <div>
                  <h2 className="mb-2 text-2xl font-bold md:text-3xl">
                    {section.title}
                  </h2>
                  <p className="text-sm text-muted-foreground md:text-base">
                    {section.blurb}
                  </p>
                </div>
                <Link
                  href={`/products/${section.slug}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          </section>
        )
      })}

      {/* Projects — near the bottom of the page */}
      {projects.length > 0 && (
        <section className="bg-background py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
              <div>
                <h2 className="mb-2 text-2xl font-bold md:text-3xl">
                  Build Something With It
                </h2>
                <p className="text-sm text-muted-foreground md:text-base">
                  Practical projects with the products you need, listed with quantities
                </p>
              </div>
              <Link
                href="/projects"
                className="text-sm font-medium text-primary hover:underline"
              >
                All projects →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why DIY */}
      <section className="bg-muted/50 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-2xl font-bold md:mb-10 md:text-3xl">
            Why TijwaWelders DIY
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {whyPoints.map((point) => (
              <Card key={point.title} className="h-full">
                <CardContent className="p-6">
                  <h3 className="mb-2 font-semibold">{point.title}</h3>
                  <p className="text-sm text-muted-foreground">{point.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-12 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-2xl font-bold text-white md:text-3xl">
            Have Something in Mind?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-base text-slate-200 md:text-xl">
            Add products or a project to your quote and tell us what you are
            building. We will come back with a quotation.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/quote" className="w-full sm:w-auto">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Review Your Quote
              </Button>
            </Link>
            <a
              href={getWhatsAppBaseLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Request a Quote on WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
