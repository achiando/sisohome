import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import {
  getProjectBySlug,
  getRelatedProjects,
  parseProjectImages,
  parseProjectSteps,
} from "@/lib/projects"
import { getWhatsAppBaseLink } from "@/lib/quote-basket"
import { formatKsh } from "@/lib/money"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { AddProjectToQuote } from "./add-project-to-quote"

interface ProjectPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) {
    return {
      title: "Project Not Found",
      description: "The requested project could not be found.",
    }
  }

  return {
    title: project.seoTitle || project.title,
    description: project.seoDesc || project.shortDesc,
    alternates: { canonical: `/projects/${project.slug}` },
  }
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) {
    notFound()
  }

  const relatedProjects = await getRelatedProjects(project)
  const images = parseProjectImages(project.images)
  const steps = parseProjectSteps(project.steps)
  const [heroImage, ...galleryImages] = images
  const hasProducts = project.products.length > 0

  return (
    <div className="container mx-auto px-4 py-12">
      <Breadcrumbs
        items={[{ name: "Projects", path: "/projects" }, { name: project.title, path: `/projects/${project.slug}` }]}
      />

      {/* Header */}
      <div className="mb-10">
        <div className="mb-4 flex flex-wrap gap-3">
          {project.category && (
            <Badge variant="neutral" shape="pill">
              {project.category}
            </Badge>
          )}
        </div>
        <h1 className="text-4xl font-bold mb-4">{project.title}</h1>
        <p className="text-xl text-muted-foreground max-w-3xl">{project.shortDesc}</p>
      </div>

      {/* Hero image */}
      {heroImage && (
        <div className="mb-10 aspect-video bg-muted overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage.url}
            alt={heroImage.alt || project.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          {/* Overview */}
          {project.description && (
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">Overview</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {project.description}
              </p>
            </section>
          )}

          {/* Build steps */}
          {steps.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-6">Build Steps</h2>
              <ol className="space-y-6">
                {steps.map((step, index) => (
                  <li key={`${step.title}-${index}`} className="flex gap-4">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Gallery */}
          {galleryImages.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-6">Project Images</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {galleryImages.map((image, index) => (
                  <div
                    key={`${image.url}-${index}`}
                    className="aspect-video bg-muted overflow-hidden rounded-2xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.alt || `${project.title} image ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {!heroImage && !project.description && steps.length === 0 && (
            <div className="mb-10 bg-muted/50 rounded-2xl p-8">
              <p className="text-muted-foreground">
                The full description, steps and images for this project are being
                added.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar: What You Need */}
        <aside>
          {hasProducts ? (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-1">What You Need</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  The products for this build. Quantities are suggested starting
                  points — confirm in your quotation.
                </p>

                <ul className="divide-y">
                  {project.products.map((link) => (
                    <li key={link.product.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/products/${link.product.category.slug}/${link.product.slug}`}
                            className="font-medium text-sm hover:text-primary transition-colors"
                          >
                            {link.product.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {link.product.shortDesc}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge variant="neutral" shape="pill" className="text-[10px]">
                              Qty {link.quantity}
                              {link.product.unit ? ` (${link.product.unit})` : ""}
                            </Badge>
                            <Badge
                              variant={link.isRequired ? "default" : "neutral"}
                              shape="pill"
                              className="text-[10px]"
                            >
                              {link.isRequired ? "Required" : "Recommended"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <AddProjectToQuote
                  project={{
                    id: project.id,
                    title: project.title,
                    products: project.products.map((link) => ({
                      id: link.product.id,
                      name: link.product.name,
                      categorySlug: link.product.category.slug,
                      slug: link.product.slug,
                      quantity: link.quantity,
                      unit: link.product.unit,
                      price: formatKsh(link.product.priceCents),
                    })),
                  }}
                />

                <Link href="/quote" className="mt-3 block">
                  <Button variant="outline" size="md" className="w-full">
                    View Quote
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-1">What You Need</h2>
                <p className="text-sm text-muted-foreground">
                  The product list for this project hasn&apos;t been published
                  yet. Tell us what you&apos;re building on WhatsApp and we&apos;ll
                  help you put a list together.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Questions About This Build?</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Message us on WhatsApp and we&apos;ll help with product choices
                and quantities.
              </p>
              <a href={getWhatsAppBaseLink()} target="_blank" rel="noopener noreferrer">
                <Button variant="primary" size="md" className="w-full">
                  Ask on WhatsApp
                </Button>
              </a>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Separator className="my-12" />

      {/* Related projects */}
      {relatedProjects.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-6">Related Projects</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {relatedProjects.map((related) => (
              <Link key={related.id} href={`/projects/${related.slug}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <h3 className="font-semibold">{related.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {related.shortDesc}
                    </p>
                    <span className="mt-3 inline-block text-sm font-medium text-primary">
                      View project →
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
