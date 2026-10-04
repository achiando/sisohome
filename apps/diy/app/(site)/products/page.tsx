import Link from "next/link"
import type { Metadata } from "next"
import { Button } from "@workspace/ui/components/button"
import {
  getAllCategories,
  getAllProducts,
  getCategoryCounts,
  type ProductWithCategory,
} from "@/lib/products"
import { CategoryChips } from "@/components/category-chips"
import { ProductCard } from "@/components/product-card"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Products",
  description:
    "Browse DIY tools, electronics components, sensors, modules, wiring and workshop equipment. Add products to your quote and request a quotation on WhatsApp.",
  alternates: { canonical: "/products" },
}

export default async function ProductsPage() {
  const categories = await getAllCategories()
  const products = await getAllProducts()
  const counts = await getCategoryCounts()

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Products</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Browse the full catalog — tools, electronics and project parts. Add
          what you need to your quote and request a quotation.
        </p>
      </div>

      <CategoryChips categories={categories} counts={counts} />

      {products.length > 0 ? (
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">All Products</h2>
          <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-3">
            {products.map((product: ProductWithCategory) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-16 bg-muted/50 rounded-2xl p-8">
          <p className="text-muted-foreground">No products published yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Products are added regularly. You can still tell us what you need on
            WhatsApp.
          </p>
        </div>
      )}

      <div className="bg-muted/50 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-6">
          Add products to your quote and we&apos;ll come back with pricing and
          next steps
        </p>
        <Link href="/quote">
          <Button variant="primary" size="lg">
            View Your Quote
          </Button>
        </Link>
      </div>
    </div>
  )
}
