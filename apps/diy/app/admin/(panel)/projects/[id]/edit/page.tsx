import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { ProjectForm, type ProjectFormProject } from "../../project-form"

export const metadata: Metadata = {
  title: "Edit Project - TijwaWelders DIY Admin",
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const project = await prisma.diyProject.findUnique({
    where: { id },
    include: { products: { orderBy: { sortOrder: "asc" } } },
  })
  if (!project) notFound()

  const products = await prisma.diyProduct.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  const formProject: ProjectFormProject = {
    id: project.id,
    title: project.title,
    slug: project.slug,
    category: project.category,
    shortDesc: project.shortDesc,
    description: project.description,
    steps: project.steps,
    images: project.images,
    sortOrder: project.sortOrder,
    isFeatured: project.isFeatured,
    isActive: project.isActive,
    seoTitle: project.seoTitle,
    seoDesc: project.seoDesc,
    productLinks: project.products.map((link) => ({
      productId: link.productId,
      quantity: link.quantity,
      isRequired: link.isRequired,
    })),
  }

  return <ProjectForm project={formProject} products={products} />
}
