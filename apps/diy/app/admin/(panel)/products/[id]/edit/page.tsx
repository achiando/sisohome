import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { getAllCategories } from "@/lib/products"
import { ProductForm, type ProductFormProduct } from "../../product-form"

export const metadata: Metadata = {
  title: "Edit Product - ODHERU Electronics Admin",
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const product = await prisma.diyProduct.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true, slug: true } } },
  })

  if (!product) notFound()

  const categories = await getAllCategories()
  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }))

  if (
    !categoryOptions.some((category) => category.id === product.category.id)
  ) {
    categoryOptions.push({
      id: product.category.id,
      name: product.category.name,
    })
  }

  const formProduct: ProductFormProduct = {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    slug: product.slug,
    shortDesc: product.shortDesc,
    description: product.description,
    unit: product.unit,
    price: product.priceCents / 100,
    sortOrder: product.sortOrder,
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    seoTitle: product.seoTitle,
    seoDesc: product.seoDesc,
    specifications: product.specifications,
    images: product.images,
  }

  return <ProductForm product={formProduct} categories={categoryOptions} />
}
