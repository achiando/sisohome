import Link from "next/link"
import type { Metadata } from "next"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  getAllCategories,
  getCategoryCounts,
  getFeaturedProducts,
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

export default async function HomePage() {
  const categories = await getAllCategories()
  const counts = await getCategoryCounts()
  const featuredProducts = await getFeaturedProducts()
  const featuredProjects = await getFeaturedProjects()
  const allProjects = featuredProjects.length > 0 ? [] : await getAllProjects()
  const projects: ProjectListItem[] = [...featuredProjects, ...allProjects].slice(0, 6)

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 text-center py-16 md:py-20">
          {categories.length > 0 && (
            <div className="mb-8 md:mb-10">
              <CategoryChips
                categories={categories}
                counts={counts}
                className="justify-center"
                onDark
              />
            </div>
          )}
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-white md:text-6xl">
            TijwaWelders DIY
          </h1>
          <p className="mx-auto mb-8 max-w-3xl text-xl font-light text-white/90 md:text-2xl">
            Products for makers and repairers, projects that show what to build,
            and a quotation in one WhatsApp message.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/products">
              <Button variant="primary" size="lg" className="h-14 w-full px-8 py-6 text-lg sm:w-auto">
                Browse Products
              </Button>
            </Link>
            <a href={getWhatsAppBaseLink()} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="h-14 w-full px-8 py-6 text-lg sm:w-auto">
                Request a Quote on WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="bg-muted/50 py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="mb-2 text-3xl font-bold">Featured Products</h2>
                <p className="text-muted-foreground">Curated picks from the catalog</p>
              </div>
              <Link href="/products" className="text-sm font-medium text-primary hover:underline">
                All products →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredProducts.slice(0, 6).map((product: ProductWithCategory) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <section className="bg-background py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="mb-2 text-3xl font-bold">Build Something With It</h2>
                <p className="text-muted-foreground">
                  Practical projects with the products you need, listed with quantities
                </p>
              </div>
              <Link href="/projects" className="text-sm font-medium text-primary hover:underline">
                All projects →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why DIY */}
      <section className="bg-muted/50 py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-10 text-center text-3xl font-bold">Why TijwaWelders DIY</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-16 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">Have Something in Mind?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-slate-200">
            Add products or a project to your quote and tell us what you are
            building. We will come back with a quotation.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/quote">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Review Your Quote
              </Button>
            </Link>
            <a href={getWhatsAppBaseLink()} target="_blank" rel="noopener noreferrer">
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
