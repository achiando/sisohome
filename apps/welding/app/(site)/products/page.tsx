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
  title: "Steel Gates, Doors & Railings in Kenya | TijwaWelders",
  description: "Browse steel gates, security doors, window grills, railings and structural steel made to measure in Kenya. Prices shown. Request a WhatsApp quote.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"}/products`,
  },
}

export default async function ProductsPage() {
  const categories = await getAllCategories()
  const products = await getAllProducts()
  const counts = await getCategoryCounts()

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Steel Products</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Browse every design we fabricate in Kenya — steel gates, doors, window
          grills, railings and custom steelwork.
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
