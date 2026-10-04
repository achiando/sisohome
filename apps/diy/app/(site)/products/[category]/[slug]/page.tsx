import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getProductBySlug, getRelatedProducts } from "@/lib/products"
import {
  getProjectsUsingProduct,
  getFeaturedProjects,
  type ProjectListItem,
} from "@/lib/projects"
import { jsonLdScript, productJsonLd } from "@/lib/seo"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { ProductClient } from "./product-client"

interface ProductPageProps {
  params: Promise<{ category: string; slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { category, slug } = await params
  const product = await getProductBySlug(slug)

  if (!product || product.category.slug !== category) {
    return {
      title: "Product Not Found",
      description: "The requested product could not be found.",
    }
  }

  return {
    title: product.seoTitle || product.name,
    description: product.seoDesc || product.shortDesc,
    alternates: { canonical: `/products/${product.category.slug}/${product.slug}` },
  }
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { category, slug } = await params
  const product = await getProductBySlug(slug)

  if (!product || product.category.slug !== category) {
    notFound()
  }

  const relatedProducts = await getRelatedProducts(product.categoryId, product.id)

  let relatedProjects = await getProjectsUsingProduct(product.id, 8)
  let projectsTitle = "Projects Using This Product"
  if (relatedProjects.length === 0) {
    relatedProjects = (await getFeaturedProjects()).slice(0, 8)
    projectsTitle = "Projects to Explore"
  }

  const images = Array.isArray(product.images)
    ? (product.images as { url?: string }[])
        .filter((image): image is { url: string } => Boolean(image && typeof image.url === "string"))
        .map((image) => image.url)
    : []

  const productLd = productJsonLd({
    name: product.name,
    description: product.seoDesc || product.shortDesc,
    image: images,
    url: `/products/${product.category.slug}/${product.slug}`,
    priceCents: product.priceCents,
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productLd) }}
      />
      <div className="container mx-auto px-4 py-12">
        <Breadcrumbs
          items={[
            { name: "Products", path: "/products" },
            { name: product.category.name, path: `/products/${product.category.slug}` },
            { name: product.name, path: `/products/${product.category.slug}/${product.slug}` },
          ]}
        />

        <ProductClient
          product={product}
          relatedProducts={relatedProducts}
          relatedProjects={relatedProjects}
          projectsTitle={projectsTitle}
        />
      </div>
    </>
  )
}
