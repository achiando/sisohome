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

const CATEGORY_SEO: Record<
  string,
  { title: string; description: string; h1: string }
> = {
  gates: {
    title: "Steel Gates in Kenya - Prices & Designs | TijwaWelders",
    description:
      "Custom steel gates in Kenya — sliding, swing and pedestrian gates made to your opening size. Compare designs and prices, quote on WhatsApp.",
    h1: "Steel Gates",
  },
  doors: {
    title: "Steel Security Doors in Kenya | TijwaWelders",
    description:
      "Steel security doors and double doors fabricated in Kenya to your opening. View designs and prices, request a quote on WhatsApp.",
    h1: "Steel Security Doors",
  },
  windows: {
    title: "Window Grills & Steel Windows in Kenya | TijwaWelders",
    description:
      "Window grills, steel window frames and security screens made to measure in Kenya. See designs and prices, quote on WhatsApp.",
    h1: "Window Grills & Steel Windows",
  },
  railings: {
    title: "Balcony & Stair Railings in Kenya | TijwaWelders",
    description:
      "Steel balcony railings, stair railings and handrails fabricated to your measurement in Kenya. Prices per meter, quote on WhatsApp.",
    h1: "Steel Railings",
  },
  structural: {
    title: "Structural Steel Fabrication in Kenya | TijwaWelders",
    description:
      "Beams, columns and structural steel fabricated to your drawing in Kenya. Request a quotation on WhatsApp.",
    h1: "Structural Steel",
  },
  "custom-fabrication": {
    title: "Custom Metal Fabrication in Nairobi | TijwaWelders",
    description:
      "One-off metal fabrication in Nairobi from your drawing, sketch or sample. Get a custom quote on WhatsApp.",
    h1: "Custom Metal Fabrication",
  },
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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"
  const seo = CATEGORY_SEO[categorySlug]

  return {
    title: seo?.title || `${category.name} | TijwaWelders`,
    description:
      seo?.description ||
      category.description ||
      `Browse ${category.name} fabricated by TijwaWelders. Request a quotation for your project.`,
    alternates: {
      canonical: `${baseUrl}/products/${categorySlug}`,
    },
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
  const seo = CATEGORY_SEO[categorySlug]

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
        <h1 className="text-4xl font-bold mb-4">{seo?.h1 || category.name}</h1>
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
