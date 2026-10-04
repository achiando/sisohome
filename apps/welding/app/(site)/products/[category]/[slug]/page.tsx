import { notFound } from "next/navigation"
import { getProductBySlug, getRelatedProducts } from "@/lib/products"
import { ProductClient } from "./product-client"
import { ProductSchema, BreadcrumbSchema } from "@/components/structured-data"

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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"
  const url = `/products/${category}/${slug}`

  return {
    title: product.seoTitle || `${product.name} | TijwaWelders`,
    description: product.seoDesc || product.shortDesc,
    alternates: {
      canonical: `${baseUrl}${url}`,
    },
  }
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { category, slug } = await params
  const product = await getProductBySlug(slug)

  if (!product || product.category.slug !== category) {
    notFound()
  }

  const relatedProducts = await getRelatedProducts(product.categoryId, product.id)
  
  const images = Array.isArray(product.images) 
    ? product.images.map((img: any) => img.url).filter(Boolean)
    : []

  return (
    <>
      <ProductSchema
        name={product.name}
        description={product.description || product.shortDesc}
        category={product.category.name}
        priceRange={product.priceRange || undefined}
        images={images}
        url={`/products/${category}/${slug}`}
      />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Products", url: "/products" },
          { name: product.category.name, url: `/products/${category}` },
          { name: product.name, url: `/products/${category}/${slug}` },
        ]}
      />
      <ProductClient product={product} relatedProducts={relatedProducts} />
    </>
  )
}
