import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { CategoriesList, type AdminCategory } from "./categories-list"

export const metadata: Metadata = {
  title: "Categories - TijwaWelders DIY Admin",
}

export default async function AdminCategoriesPage() {
  const [categories, counts] = await Promise.all([
    prisma.diyCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.diyProduct.groupBy({ by: ["categoryId"], _count: true }),
  ])

  const countByCategory = new Map(counts.map((row) => [row.categoryId, row._count]))

  const rows: AdminCategory[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    productCount: countByCategory.get(category.id) ?? 0,
  }))

  return <CategoriesList categories={rows} />
}
