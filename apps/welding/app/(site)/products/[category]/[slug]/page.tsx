import { notFound } from "next/navigation"
import { getProductBySlug, getRelatedProducts } from "@/lib/products"
import { ProductClient } from "./product-client"

interface ProductPageProps {
  params: Promise<{ category: string; slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { category, slug } = await params
  const product = await getProductBySlug(slug)

  if (!product || product.category.slug !== category) {
    return {
      title: "Product Not Found - TijwaWelders",
      description: "The requested product could not be found.",
    }
  }

  return {
    title: product.seoTitle || `${product.name} | TijwaWelders`,
    description: product.seoDesc || product.shortDesc,
  }
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { category, slug } = await params
  const product = await getProductBySlug(slug)

  if (!product || product.category.slug !== category) {
    notFound()
  }

  const relatedProducts = await getRelatedProducts(product.categoryId, product.id)

  return <ProductClient product={product} relatedProducts={relatedProducts} />
}
