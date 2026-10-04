"use client"

import { useState } from "react"
import { Check, Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { formatKsh } from "@/lib/money"
import { addToQuoteBasket, type QuoteItem } from "@/lib/quote-basket"

interface AddToQuoteButtonProduct {
  id: string
  name: string
  slug: string
  unit: string | null
  priceCents: number
  category: { slug: string }
}

export function AddToQuoteButton({
  product,
}: {
  product: AddToQuoteButtonProduct
}) {
  const [added, setAdded] = useState(false)

  const handleAdd = () => {
    const quoteItem: QuoteItem = {
      id: product.id,
      name: product.name,
      categorySlug: product.category.slug,
      slug: product.slug,
      quantity: 1,
      unit: product.unit,
      price: formatKsh(product.priceCents),
      sourceProject: null,
    }

    addToQuoteBasket(quoteItem)
    setAdded(true)
    setTimeout(() => setAdded(false), 2500)
  }

  return (
    <Button
      type="button"
      variant={added ? "secondary" : "primary"}
      size="md"
      className="w-full"
      leftIcon={added ? Check : Plus}
      onClick={handleAdd}
    >
      {added ? "Added to Quote" : "Add to Quote"}
    </Button>
  )
}
