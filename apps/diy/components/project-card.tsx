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
              sizes="(min-width: 1024px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground sm:text-sm">Image coming soon</p>
            </div>
          )}
        </div>

        <CardContent className="flex flex-col gap-1.5 p-3 sm:gap-2 sm:p-6">
          <div className="hidden flex-wrap gap-2 sm:flex">
            {project.category && (
              <Badge variant="neutral" shape="pill" className="self-start">
                {project.category}
              </Badge>
            )}
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold sm:text-lg">
            {project.title}
          </h3>
          {project.shortDesc && (
            <p className="line-clamp-1 text-xs text-muted-foreground sm:line-clamp-2 sm:text-sm">
              {project.shortDesc}
            </p>
          )}
          <span className="mt-1 text-xs font-medium text-primary sm:mt-2 sm:text-sm">
            View project →
          </span>
        </CardContent>
      </Link>
    </Card>
  )
}
