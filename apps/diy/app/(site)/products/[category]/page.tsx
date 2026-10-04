import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import {
  getAllCategories,
  getCategoryBySlug,
  getCategoryCounts,
  getProductsByCategory,
} from "@/lib/products"
import { CategoryChips } from "@/components/category-chips"
import { ProductCard } from "@/components/product-card"
import { Breadcrumbs } from "@/components/breadcrumbs"

interface CategoryPageProps {
  params: Promise<{ category: string }>
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) return { title: "Category Not Found" }

  return {
    title: category.name,
    description:
      category.description ||
      `Browse ${category.name} products. Add what you need to your quote and request a quotation on WhatsApp.`,
    alternates: { canonical: `/products/${category.slug}` },
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) notFound()

  const products = await getProductsByCategory(slug)
  const categories = await getAllCategories()
  const counts = await getCategoryCounts()

  return (
    <div className="container mx-auto px-4 py-12">
      <Breadcrumbs
        items={[
          { name: "Products", path: "/products" },
          { name: category.name, path: `/products/${category.slug}` },
        ]}
      />

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{category.name}</h1>
        {category.description && (
          <p className="text-xl text-muted-foreground max-w-2xl">
            {category.description}
          </p>
        )}
      </div>

      <CategoryChips categories={categories} counts={counts} activeSlug={slug} />

      {products.length > 0 ? (
        <div className="mb-16">
          <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-16 bg-muted/50 rounded-2xl p-8">
          <p className="text-muted-foreground">No products published in this category yet</p>
        </div>
      )}

      <div className="bg-muted/50 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Can&apos;t Find What You Need?</h2>
        <p className="text-muted-foreground mb-6">
          Tell us what you&apos;re looking for and we&apos;ll help you source it
        </p>
        <Link href="/quote">
          <Button variant="primary" size="lg">
            Request a Quote
          </Button>
        </Link>
      </div>
    </div>
  )
}
