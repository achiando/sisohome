import Link from "next/link"
import Image from "next/image"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  getAllCategories,
  getFeaturedProducts,
  type CategoryList,
  type ProductWithCategory,
} from "@/lib/products"
import { getFeaturedProjects, type ProjectWithImages } from "@/lib/projects"

export default async function HomePage() {
  const categories = await getAllCategories()
  const featuredProducts = await getFeaturedProducts()
  const featuredProjects = await getFeaturedProjects()

  // Use first featured project image for hero if available
  const firstProjectImages = featuredProjects[0]?.images
  const firstHeroImage = Array.isArray(firstProjectImages)
    ? firstProjectImages[0]
    : undefined
  const heroImage =
    firstHeroImage &&
    typeof firstHeroImage === "object" &&
    !Array.isArray(firstHeroImage) &&
    typeof firstHeroImage.url === "string"
      ? firstHeroImage.url
      : null

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center bg-black">
        {heroImage ? (
          <div className="absolute inset-0">
            <Image
              src={heroImage}
              alt="TijwaWelders Steel Fabrication"
              fill
              className="object-cover"
              priority
              quality={90}
            />
            <div className="absolute inset-0 bg-black/50" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        )}

        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-white md:text-7xl lg:text-8xl">
            TijwaWelders
          </h1>
          <p className="mx-auto mb-8 max-w-3xl text-xl font-light text-white/90 md:text-2xl lg:text-3xl">
            Steel Fabrication Built for Real Projects
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="primary"
                size="lg"
                className="h-14 w-full px-8 py-6 text-lg sm:w-auto"
              >
                Get a Quote
              </Button>
            </a>
            <Link href="/products">
              <Button variant="outline" size="lg">
                Explore Products
              </Button>
            </Link>
          </div>
          <p className="mt-8 text-sm text-white/60">
            Gates • Doors • Windows • Railings • Structures
          </p>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="bg-muted/50 py-20">
          <div className="container mx-auto px-4">
            <h2 className="mb-2 text-3xl font-bold">Featured Designs</h2>
            <p className="mb-8 text-muted-foreground">
              Our most popular steel fabrications
            </p>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {featuredProducts
                .slice(0, 3)
                .map((product: ProductWithCategory) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.category.slug}/${product.slug}`}
                  >
                    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                      {product.images &&
                      Array.isArray(product.images) &&
                      product.images.length > 0 &&
                      product.images[0] ? (
                        <div className="aspect-video bg-muted">
                          <img
                            src={product.images[0].url}
                            alt={product.images[0].alt || product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-video items-center justify-center bg-muted">
                          <p className="text-sm text-muted-foreground">
                            Image coming soon
                          </p>
                        </div>
                      )}
                      <CardContent className="p-6">
                        <h3 className="mb-2 text-lg font-semibold">
                          {product.name}
                        </h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                          {product.shortDesc}
                        </p>
                        <Button variant="outline" className="w-full">
                          Explore →
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Real Projects */}
      {featuredProjects.length > 0 && (
        <section className="bg-background py-20">
          <div className="container mx-auto px-4">
            <h2 className="mb-2 text-3xl font-bold">Built in the Real World</h2>
            <p className="mb-8 text-muted-foreground">
              A selection of our fabrication work
            </p>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredProjects
                .slice(0, 3)
                .map((project: ProjectWithImages) => (
                  <Link key={project.id} href={`/projects/${project.slug}`}>
                    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                      {project.images &&
                      Array.isArray(project.images) &&
                      project.images.length > 0 &&
                      project.images[0] ? (
                        <div className="aspect-video bg-muted">
                          <img
                            src={project.images[0].url}
                            alt={project.images[0].alt || project.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-video items-center justify-center bg-muted">
                          <p className="text-sm text-muted-foreground">
                            Image coming soon
                          </p>
                        </div>
                      )}
                      <CardContent className="p-6">
                        <h3 className="mb-2 text-lg font-semibold">
                          {project.title}
                        </h3>
                        {project.location && (
                          <p className="mb-4 text-sm text-muted-foreground">
                            {project.location}
                          </p>
                        )}
                        <Button variant="outline" className="w-full">
                          View Project →
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Capabilities */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">
            From Small Fabrication to Complete Structures
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
            Custom welding and fabrication for residential, commercial and
            structural projects
          </p>
          <Link href="/services" className="flex justify-center">
            <Button variant="primary" size="lg">
              Explore Services
            </Button>
          </Link>
        </div>
      </section>

      {/* Education */}
      <section className="flex justify-center bg-background py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-2 text-3xl font-bold">
            Not Sure Which Steel You Need?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Understand the materials and specifications before starting your
            project
          </p>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              "Gauge 16 vs Gauge 18",
              'What is a 3/4" Tube?',
              "Choosing Steel for a Gate",
              "Common Steel Sections",
            ].map((guide) => (
              <Link key={guide} href="/guides">
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm font-medium">{guide}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Link href="/guides">
              <Button variant="outline">Explore Guides</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">
            Have a Project in Mind?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-slate-200">
            Tell us what you need. We'll help you work out the next step.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Request a Quote on WhatsApp
              </Button>
            </a>
            <Link href="/contact">
              <Button variant="outline" size="lg">
                Email Us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
