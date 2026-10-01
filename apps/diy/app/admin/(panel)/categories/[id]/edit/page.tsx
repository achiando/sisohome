import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { CategoryForm, type CategoryFormCategory } from "../../category-form"

export const metadata: Metadata = {
  title: "Edit Category - TijwaWelders DIY Admin",
}

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const category = await prisma.diyCategory.findUnique({ where: { id } })
  if (!category) notFound()

  const formCategory: CategoryFormCategory = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  }

  return <CategoryForm category={formCategory} />
}
