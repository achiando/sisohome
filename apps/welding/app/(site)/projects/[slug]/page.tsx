import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { getProjectBySlug, type ProjectWithImages } from "@/lib/projects"

interface ProjectPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProjectPageProps) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) {
    return {
      title: "Project Not Found - TijwaWelders",
      description: "The requested project could not be found.",
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"

  return {
    title: project.seoTitle || `${project.title} | TijwaWelders Projects`,
    description: project.seoDesc || project.description || `${project.title} by TijwaWelders.`,
    alternates: {
      canonical: `${baseUrl}/projects/${slug}`,
    },
  }
}

function getImages(project: ProjectWithImages): { url: string; alt?: string }[] {
  if (!project.images || !Array.isArray(project.images)) return []
  return project.images.filter(
    (image): image is { url: string; alt?: string } =>
      Boolean(image) && typeof image.url === "string",
  )
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) {
    notFound()
  }

  const images = getImages(project)
  const [heroImage, ...galleryImages] = images

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">
            Projects
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span aria-current="page">{project.title}</span>
        </nav>
        <h1 className="text-4xl font-bold mb-4">{project.title}</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          {project.type && (
            <span className="bg-muted rounded-full px-3 py-1">{project.type}</span>
          )}
          {project.location && (
            <span className="bg-muted rounded-full px-3 py-1">{project.location}</span>
          )}
        </div>
      </div>

      {/* Hero image */}
      {heroImage && (
        <div className="mb-10 aspect-video bg-muted overflow-hidden rounded-lg">
          <img
            src={heroImage.url}
            alt={heroImage.alt || project.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Description */}
      {project.description && (
        <div className="mb-10 max-w-3xl">
          <h2 className="text-2xl font-semibold mb-4">About This Project</h2>
          <p className="text-muted-foreground whitespace-pre-line">{project.description}</p>
        </div>
      )}

      {/* Gallery */}
      {galleryImages.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-6">Project Photographs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryImages.map((image, index) => (
              <div key={`${image.url}-${index}`} className="aspect-video bg-muted overflow-hidden rounded-lg">
                <img
                  src={image.url}
                  alt={image.alt || `${project.title} photograph ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {!heroImage && !project.description && (
        <div className="mb-10 bg-muted/50 rounded-lg p-8">
          <p className="text-muted-foreground">
            Photographs and a full description for this project are being added.
          </p>
        </div>
      )}

      {/* CTA */}
      <Card className="bg-muted/50">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Want Work Like This?</h2>
          <p className="text-muted-foreground mb-6">
            Tell us about your project and we&apos;ll come back with a quotation
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="primary" size="lg">Start on WhatsApp</Button>
            </a>
            <Link href="/products">
              <Button variant="outline" size="lg">Browse Products</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
