import type { SpecificationItem } from "./specifications"

export type ProductImageInput = {
  url: string
  alt: string
}

export const PRODUCT_UNITS = [
  "Each",
  "Pair",
  "Pack",
  "Set",
  "Meter",
  "Roll",
  "Kit",
] as const

export interface ProductInput {
  name: string
  slug: string
  categoryId: string
  shortDesc: string
  description: string
  unit: string
  price: string
  sortOrder: number
  isFeatured: boolean
  isActive: boolean
  seoTitle: string
  seoDesc: string
  specifications: SpecificationItem[]
  images: ProductImageInput[]
}

export interface ProductSaveResult {
  ok: boolean
  fieldErrors?: Record<string, string>
  error?: string
}

export function parseProductImages(raw: unknown): ProductImageInput[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((entry): ProductImageInput[] => {
    if (entry && typeof entry === "object") {
      const item = entry as { url?: unknown; alt?: unknown }
      if (typeof item.url === "string" && item.url.trim()) {
        return [{ url: item.url, alt: typeof item.alt === "string" ? item.alt : "" }]
      }
    }
    return []
  })
}

export function firstProductImageUrl(raw: unknown): string | null {
  return parseProductImages(raw)[0]?.url ?? null
}
