import Link from "next/link"
import Image from "next/image"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { parseProjectImages, type ProjectListItem } from "@/lib/projects"

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const images = parseProjectImages(project.images)
  const first = images[0]

  return (
    <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
      <Link href={`/projects/${project.slug}`} className="group block h-full">
        <div className="relative aspect-video overflow-hidden bg-muted">
          {first ? (
            <Image
              src={first.url}
              alt={first.alt || project.title}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Image coming soon</p>
            </div>
          )}
        </div>

        <CardContent className="flex flex-col gap-2 p-6">
          <div className="flex flex-wrap gap-2">
            {project.category && (
              <Badge variant="neutral" shape="pill" className="self-start">
                {project.category}
              </Badge>
            )}
          </div>
          <h3 className="text-lg font-semibold">{project.title}</h3>
          {project.shortDesc && (
            <p className="text-sm text-muted-foreground line-clamp-2">{project.shortDesc}</p>
          )}
          <span className="mt-2 text-sm font-medium text-primary">View project →</span>
        </CardContent>
      </Link>
    </Card>
  )
}
