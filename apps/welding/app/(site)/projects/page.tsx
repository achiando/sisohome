import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { getAllProjects, type ProjectWithImages } from "@/lib/projects"

export const metadata = {
  title: "Projects - TijwaWelders Portfolio",
  description: "View our real fabrication work and projects. Steel gates, doors, railings, and structural installations across Kenya.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"}/projects`,
  },
}

export default async function ProjectsPage() {
  const projects = await getAllProjects()

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Projects</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Real fabrication work by TijwaWelders
        </p>
      </div>

      {/* Projects Grid */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project: ProjectWithImages) => (
            <Link key={project.id} href={`/projects/${project.slug}`}>
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                {project.images && Array.isArray(project.images) && project.images.length > 0 && project.images[0] ? (
                  <div className="aspect-video bg-muted">
                    <img 
                      src={project.images[0].url} 
                      alt={project.images[0].alt || project.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">Image coming soon</p>
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-2">{project.title}</h3>
                  {project.type && (
                    <p className="text-sm text-muted-foreground mb-2">{project.type}</p>
                  )}
                  {project.location && (
                    <p className="text-sm text-muted-foreground mb-4">{project.location}</p>
                  )}
                  <Button variant="outline" className="w-full">View Project →</Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-6">No projects published yet</p>
            <Link href="/products">
              <Button variant="primary">Browse Products</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      <div className="mt-12 bg-muted/50 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Have a Project in Mind?</h2>
        <p className="text-muted-foreground mb-6">Let's discuss your fabrication needs</p>
        <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
          <Button variant="primary" size="lg">Start on WhatsApp</Button>
        </a>
      </div>
    </div>
  )
}
