import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { firstProductImageUrl } from "@/lib/product-input"
import { ProjectsList, type AdminProject } from "./projects-list"

export const metadata: Metadata = {
  title: "Projects - ODHERU Electronics Admin",
}

export default async function AdminProjectsPage() {
  const projects = await prisma.diyProject.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  })

  const rows: AdminProject[] = projects.map((project) => ({
    id: project.id,
    title: project.title,
    slug: project.slug,
    category: project.category,
    shortDesc: project.shortDesc,
    isActive: project.isActive,
    isFeatured: project.isFeatured,
    sortOrder: project.sortOrder,
    image: firstProductImageUrl(project.images),
    productCount: project._count.products,
  }))

  return <ProjectsList projects={rows} />
}
