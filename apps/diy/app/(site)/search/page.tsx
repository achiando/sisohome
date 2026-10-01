import type { Metadata } from "next"
import Link from "next/link"
import { Search } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { searchProducts, searchCategories, type ProductWithCategory } from "@/lib/products"
import { searchProjects, type ProjectListItem } from "@/lib/projects"
import { ProductCard } from "@/components/product-card"
import { ProjectCard } from "@/components/project-card"

export const metadata: Metadata = {
  title: "Search",
  description: "Search products and projects.",
  robots: { index: false },
}

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const query = (q ?? "").trim()

  const [products, projects, categories] = query
    ? await Promise.all([
        searchProducts(query),
        searchProjects(query),
        searchCategories(query),
      ])
    : [[], [], []] as [ProductWithCategory[], ProjectListItem[], { id: string; name: string; slug: string; description: string | null }[]]

  const hasResults = products.length > 0 || projects.length > 0 || categories.length > 0

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-4xl font-bold mb-4">Search</h1>
        <p className="text-muted-foreground">
          Search across products, projects and categories.
        </p>
      </div>

      <form action="/search" method="get" className="mb-10 max-w-xl">
        <div className="flex gap-3">
          <Input
            name="q"
            defaultValue={query}
            placeholder="Try &quot;sensor&quot;, &quot;arduino&quot;, &quot;wiring&quot;..."
            aria-label="Search products and projects"
            leftIcon={<Search className="size-4" aria-hidden="true" />}
          />
          <Button type="submit" variant="primary">
            Search
          </Button>
        </div>
      </form>

      {query && !hasResults && (
        <div className="bg-muted/50 rounded-2xl p-8">
          <p className="text-muted-foreground mb-4">
            No products or projects matched &quot;{query}&quot;.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/products">
              <Button variant="outline" size="sm">Browse Products</Button>
            </Link>
            <Link href="/projects">
              <Button variant="outline" size="sm">Browse Projects</Button>
            </Link>
          </div>
        </div>
      )}

      {hasResults && (
        <div className="space-y-12">
          {categories.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold mb-4">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Link key={category.id} href={`/products/${category.slug}`}>
                    <Badge variant="neutral" size="lg" shape="pill" className="cursor-pointer hover:opacity-85">
                      {category.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {products.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold mb-4">
                Products <span className="text-muted-foreground">({products.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          {projects.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold mb-4">
                Projects <span className="text-muted-foreground">({projects.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {!query && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Type a search above to find products and projects.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
