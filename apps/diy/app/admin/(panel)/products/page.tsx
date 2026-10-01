import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { firstProductImageUrl } from "@/lib/product-input"
import { ProductsList, type AdminProduct } from "./products-list"

export const metadata: Metadata = {
  title: "Products - TijwaWelders DIY Admin",
}

export default async function AdminProductsPage() {
  const products = await prisma.diyProduct.findMany({
    include: { category: { select: { id: true, name: true, slug: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  const rows: AdminProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDesc: product.shortDesc,
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    sortOrder: product.sortOrder,
    image: firstProductImageUrl(product.images),
    category: product.category,
  }))

  return <ProductsList products={rows} />
}
