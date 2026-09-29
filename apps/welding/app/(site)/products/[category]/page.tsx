import Link from "next/link"
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

interface CategoryPageProps {
  params: Promise<{ category: string }>
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params
  const category = await getCategoryBySlug(categorySlug)

  if (!category) {
    return {
      title: "Category Not Found - TijwaWelders",
      description: "The requested category could not be found.",
    }
  }

  return {
    title: `${category.name} | TijwaWelders`,
    description:
      category.description ||
      `Browse ${category.name} fabricated by TijwaWelders. Request a quotation for your project.`,
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params
  const category = await getCategoryBySlug(categorySlug)

  if (!category) {
    notFound()
  }

  const products = await getProductsByCategory(categorySlug)
  const categories = await getAllCategories()
  const counts = await getCategoryCounts()

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
          <Link href="/products" className="hover:text-foreground">
            Products
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span aria-current="page">{category.name}</span>
        </nav>
        <h1 className="text-4xl font-bold mb-4">{category.name}</h1>
        {category.description && (
          <p className="text-xl text-muted-foreground max-w-2xl">{category.description}</p>
        )}
      </div>

      {/* Category filters */}
      <CategoryChips categories={categories} counts={counts} activeSlug={category.slug} />

      {/* Products */}
      {products.length > 0 ? (
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">
            {category.name} Products
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-16 bg-muted/50 rounded-lg p-8">
          <p className="text-muted-foreground mb-6">
            No products are published in this category yet.
          </p>
          <Link href="/products">
            <Button variant="outline">Browse All Products</Button>
          </Link>
        </div>
      )}

      {/* CTA */}
      <div className="bg-muted/50 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Need a Quote for {category.name}?</h2>
        <p className="text-muted-foreground mb-6">
          Tell us what you need and we&apos;ll come back with pricing and next steps
        </p>
        <Link href="/quote">
          <Button variant="primary" size="lg">Request a Quote</Button>
        </Link>
      </div>
    </div>
  )
}
