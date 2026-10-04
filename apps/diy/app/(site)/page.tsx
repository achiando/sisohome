import Link from "next/link"
import type { Metadata } from "next"
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
  parseProjectImages,
  type ProjectListItem,
} from "@/lib/projects"
import { ProductCard } from "@/components/product-card"
import { ProjectCard } from "@/components/project-card"
import { FlaskConical, Hammer } from "lucide-react"
import { CategoryChips } from "@/components/category-chips"
import {
  HomeHeroCarousel,
  type HeroDeal,
  type HeroSlide,
} from "@/components/home-hero-carousel"
import { getWhatsAppBaseLink, getWhatsAppLinkWithMessage } from "@/lib/quote-basket"
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

  const totalProducts = Object.values(counts).reduce((sum, n) => sum + n, 0)

  const deals: HeroDeal[] = featuredProducts.slice(0, 3).map((product) => {
    const image = productImages(product)[0]
    return {
      href: `/products/${product.category.slug}/${product.slug}`,
      name: product.name,
      category: product.category.name,
      price: formatKsh(product.priceCents),
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt || product.name,
    }
  })

  const sensorProduct = browseProducts[0]?.[0]
  const sensorHeroImage = sensorProduct ? productImages(sensorProduct)[0] : undefined
  const projectHeroImage = parseProjectImages(projects[0]?.images)[0]

  const slides: HeroSlide[] = [
    {
      eyebrow: "Featured Deals",
      gradient: "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900",
      backgroundImageUrl: deals[0]?.imageUrl ?? null,
      title: "Deals for makers and repairers",
      body: "Featured products with prices, plus everything you need for your next build. Add to your quote and get the full quotation in one WhatsApp message.",
      primary: { label: "Browse Products", href: "/products" },
      secondary: {
        label: "Request a Quote on WhatsApp",
        href: getWhatsAppBaseLink(),
        external: true,
      },
      deals,
    },
    {
      eyebrow: `${totalProducts} products · ${categories.length} categories`,
      gradient: "bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900",
      backgroundImageUrl: sensorHeroImage?.url ?? null,
      title: "Find the exact part you need",
      body: "From resistors and sensors to tools and enclosures — browse the full catalog by category and add what you need to your quote.",
      primary: { label: "Browse Categories", href: "/products" },
    },
    {
      eyebrow: "Projects",
      gradient: "bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900",
      backgroundImageUrl: projectHeroImage?.url ?? null,
      title: "Build something with it",
      body: "Step-by-step projects that list every product you need, with quantities — add them all to your quote in one tap.",
      primary: { label: "Explore Projects", href: "/projects" },
      secondary: { label: "Get a Quote", href: "/quote" },
    },
  ]

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

      {/* Deals hero — rotating carousel banner */}
      <section className="container mx-auto px-4 pt-6 md:pt-10">
        <HomeHeroCarousel slides={slides} />
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

      {/* Help CTAs — project support and lab supply */}
      <section className="bg-background py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
            <Card className="h-full">
              <CardContent className="flex h-full flex-col p-6 md:p-8">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Hammer className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mb-2 text-xl font-bold md:text-2xl">
                  Need support making your project?
                </h2>
                <p className="mb-6 flex-1 text-sm text-muted-foreground md:text-base">
                  Tell us what you are trying to build and we will help you
                  work out the parts, quantities and practical next steps.
                </p>
                <a
                  href={getWhatsAppLinkWithMessage(
                    "Hello TijwaWelders DIY, I would like support with a project I am building. Here is what I have in mind:",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button variant="primary" size="lg" className="w-full sm:w-auto">
                    Get Project Support on WhatsApp
                  </Button>
                </a>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardContent className="flex h-full flex-col p-6 md:p-8">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FlaskConical className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mb-2 text-xl font-bold md:text-2xl">
                  Looking to equip a lab?
                </h2>
                <p className="mb-6 flex-1 text-sm text-muted-foreground md:text-base">
                  Schools, training centres and institutions — tell us what your
                  lab needs and we will put together a quotation for the
                  equipment and components.
                </p>
                <a
                  href={getWhatsAppLinkWithMessage(
                    "Hello TijwaWelders DIY, I would like a quotation for supplying a lab. Here are the details:",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Request a Lab Quote
                  </Button>
                </a>
              </CardContent>
            </Card>
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
