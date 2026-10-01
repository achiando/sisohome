import Link from "next/link"
import type { Metadata } from "next"
import { Button } from "@workspace/ui/components/button"
import {
  getAllProjects,
  getFeaturedProjects,
  getProjectCategories,
  getProjectsByCategory,
  type ProjectListItem,
} from "@/lib/projects"
import { Badge } from "@workspace/ui/components/badge"
import { ProjectCard } from "@/components/project-card"
import { Breadcrumbs } from "@/components/breadcrumbs"

interface ProjectsPageProps {
  searchParams: Promise<{ category?: string }>
}

export const revalidate = 60

export async function generateMetadata({ searchParams }: ProjectsPageProps): Promise<Metadata> {
  const { category } = await searchParams

  return {
    title: "Projects",
    description:
      "Practical DIY projects with the products you need, listed with quantities. Build, repair, automate and prototype — then request a quotation.",
    alternates: { canonical: "/projects" },
    robots: category ? { index: false } : undefined,
  }
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const { category } = await searchParams
  const categories = await getProjectCategories()

  const activeCategory =
    category && categories.includes(category) ? category : undefined

  const featured = await getFeaturedProjects()
  const all = activeCategory ? await getProjectsByCategory(activeCategory) : await getAllProjects()

  const shown: ProjectListItem[] = activeCategory
    ? all
    : [...featured, ...all.filter((p) => !featured.some((f) => f.id === p.id))].slice(0, 50)

  return (
    <div className="container mx-auto px-4 py-12">
      <Breadcrumbs items={[{ name: "Projects", path: "/projects" }]} />

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Projects</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Practical things you can build, repair or automate. Each project lists
          the products you need, with quantities, so you know exactly what to ask
          for.
        </p>
      </div>

      {categories.length > 0 && (
        <nav aria-label="Project categories" className="mb-10 flex flex-wrap gap-2">
          <Link href="/projects">
            <Badge
              variant="neutral"
              size="lg"
              shape="pill"
              className="cursor-pointer transition hover:opacity-85 active:scale-[0.98]"
              selected={!activeCategory}
            >
              All
            </Badge>
          </Link>
          {categories.map((cat) => (
            <Link key={cat} href={`/projects?category=${encodeURIComponent(cat)}`}>
              <Badge
                variant="neutral"
                size="lg"
                shape="pill"
                className="cursor-pointer transition hover:opacity-85 active:scale-[0.98]"
                selected={activeCategory === cat}
              >
                {cat}
              </Badge>
            </Link>
          ))}
        </nav>
      )}

      {shown.length > 0 ? (
        <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="mb-16 bg-muted/50 rounded-2xl p-8">
          <p className="text-muted-foreground">
            {activeCategory
              ? "No published projects in this category yet"
              : "No projects published yet"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us what you want to build and we&apos;ll help you get started.
          </p>
        </div>
      )}

      <div className="bg-muted/50 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Building One of These?</h2>
        <p className="text-muted-foreground mb-6">
          Add the products you need to your quote and send it to us on WhatsApp
        </p>
        <Link href="/quote">
          <Button variant="primary" size="lg">
            View Your Quote
          </Button>
        </Link>
      </div>
    </div>
  )
}
