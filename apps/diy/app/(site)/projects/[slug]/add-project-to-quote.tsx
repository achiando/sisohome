"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  addProjectToQuoteBasket,
  getQuoteBasketCount,
  type QuoteItem,
} from "@/lib/quote-basket"

type ProjectProduct = {
  id: string
  name: string
  categorySlug: string
  slug: string
  quantity: number
  unit: string | null
  price: string | null
  priceCents?: number | null
}

type ProjectPayload = {
  id: string
  title: string
  products: ProjectProduct[]
}

export function AddProjectToQuote({ project }: { project: ProjectPayload }) {
  const [added, setAdded] = useState(false)
  const [quoteCount, setQuoteCount] = useState(0)

  if (project.products.length === 0) return null

  const handleAdd = () => {
    const items: QuoteItem[] = project.products.map((product) => ({
      id: product.id,
      name: product.name,
      categorySlug: product.categorySlug,
      slug: product.slug,
      quantity: product.quantity,
      unit: product.unit,
      price: product.price,
      priceCents: product.priceCents ?? null,
      sourceProject: project.title,
    }))

    addProjectToQuoteBasket(items)
    setQuoteCount(getQuoteBasketCount())
    setAdded(true)
    setTimeout(() => setAdded(false), 4000)
  }

  return (
    <div className="mt-4">
      <Button variant="primary" size="lg" className="w-full" onClick={handleAdd}>
        {added ? `Added to Quote ✓ (${quoteCount})` : "Add Project to Quote"}
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Adds all {project.products.length} products with their suggested
        quantities. You can edit everything in your quote.
      </p>
    </div>
  )
}
