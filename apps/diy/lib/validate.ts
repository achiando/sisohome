import type { ProductImageInput } from "./product-input"

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function sanitizeImages(
  raw: unknown,
  fieldErrors: Record<string, string>,
): ProductImageInput[] {
  if (!Array.isArray(raw)) return []

  const items: ProductImageInput[] = []

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue

    const item = entry as { url?: unknown; alt?: unknown }
    const url = cleanText(item.url)
    const alt = cleanText(item.alt)

    if (!url && !alt) continue

    if (!/^https?:\/\//i.test(url)) {
      fieldErrors.images = "Image URLs must start with http:// or https://."
      continue
    }

    if (!alt) {
      fieldErrors.images = "Describe each image so it works for search and screen readers."
      continue
    }

    items.push({ url, alt })
  }

  return items
}

export interface SaveResult {
  ok: boolean
  fieldErrors?: Record<string, string>
  error?: string
}

export interface CategoryInput {
  name: string
  slug: string
  description: string
  sortOrder: number
  isActive: boolean
}

export type ProjectStepInput = {
  title: string
  body: string
}

export interface ProjectProductLinkInput {
  productId: string
  quantity: number
  isRequired: boolean
}

export interface ProjectInput {
  title: string
  slug: string
  category: string
  shortDesc: string
  description: string
  steps: ProjectStepInput[]
  images: ProductImageInput[]
  sortOrder: number
  isFeatured: boolean
  isActive: boolean
  seoTitle: string
  seoDesc: string
  products: ProjectProductLinkInput[]
}

export function sanitizeSteps(
  raw: unknown,
  fieldErrors: Record<string, string>,
): ProjectStepInput[] {
  if (!Array.isArray(raw)) return []

  const steps: ProjectStepInput[] = []

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue

    const item = entry as { title?: unknown; body?: unknown }
    const title = cleanText(item.title)
    const body = cleanText(item.body)

    if (!title && !body) continue

    if (!title) {
      fieldErrors.steps = "Every build step needs a title."
      continue
    }

    if (!body) {
      fieldErrors.steps = "Add the instructions for this build step."
      continue
    }

    steps.push({ title, body })
  }

  return steps
}

export function sanitizeProductLinks(
  raw: unknown,
  fieldErrors: Record<string, string>,
): ProjectProductLinkInput[] {
  if (!Array.isArray(raw)) return []

  const links: ProjectProductLinkInput[] = []
  const seen = new Set<string>()

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue

    const item = entry as { productId?: unknown; quantity?: unknown; isRequired?: unknown }
    const productId = cleanText(item.productId)

    if (!productId) continue

    const quantity = Math.trunc(Number(item.quantity))
    if (!Number.isFinite(quantity) || quantity < 1) {
      fieldErrors.products = "Quantities must be whole numbers above zero."
      continue
    }

    if (seen.has(productId)) {
      fieldErrors.products = "Each product can only be listed once."
      continue
    }

    seen.add(productId)
    links.push({ productId, quantity, isRequired: item.isRequired !== false })
  }

  return links
}
