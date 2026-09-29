import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import {
  getAllCategories,
  getAllProducts,
  getCategoryCounts,
  type ProductWithCategory,
} from "@/lib/products"
import { CategoryChips } from "@/components/category-chips"
import { ProductCard } from "@/components/product-card"

export const metadata = {
  title: "Products - TijwaWelders Steel Fabrication",
  description: "Browse our premium steel gates, doors, windows, railings, and custom metal fabrication products. Request quotations for your project.",
}

export default async function ProductsPage() {
  const categories = await getAllCategories()
  const products = await getAllProducts()
  const counts = await getCategoryCounts()

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Products</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Browse every design we fabricate — from gates and railings to custom
          steelwork.
        </p>
      </div>

      {/* Category filters */}
      <CategoryChips categories={categories} counts={counts} />

      {/* All Products */}
      {products.length > 0 ? (
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">All Products</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product: ProductWithCategory) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-16 bg-muted/50 rounded-lg p-8">
          <p className="text-muted-foreground">No products published yet</p>
        </div>
      )}

      {/* CTA */}
      <div className="bg-muted/50 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-6">Add products to your quote and we&apos;ll help you with pricing and next steps</p>
        <Link href="/quote">
          <Button variant="primary" size="lg">View Your Quote</Button>
        </Link>
      </div>
    </div>
  )
}
