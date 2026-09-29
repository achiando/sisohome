"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import type {
  ProductImageInput,
  ProductInput,
  ProductSaveResult,
} from "@/lib/product-input"
import type { SpecificationItem } from "@/lib/specifications"

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function sanitizeSpecifications(
  raw: unknown,
  fieldErrors: Record<string, string>,
): SpecificationItem[] {
  if (!Array.isArray(raw)) return []

  const items: SpecificationItem[] = []

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue

    const item = entry as { label?: unknown; material?: unknown; pieces?: unknown }
    const label = cleanText(item.label)
    const material = cleanText(item.material)

    if (!label && !material) continue

    if (!label) {
      fieldErrors.specifications = "Every specification needs a label."
      continue
    }

    let pieces: number | null = null
    if (item.pieces !== null && item.pieces !== undefined && item.pieces !== "") {
      const parsed = Math.trunc(Number(item.pieces))
      if (Number.isFinite(parsed) && parsed > 0) {
        pieces = parsed
      } else {
        fieldErrors.specifications = "Pieces must be a whole number above zero."
        continue
      }
    }

    items.push({ label, material, pieces })
  }

  return items
}

function sanitizeImages(
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

interface ValidatedProduct {
  name: string
  slug: string
  categoryId: string
  shortDesc: string
  description: string | null
  priceRange: string | null
  sortOrder: number
  isFeatured: boolean
  isActive: boolean
  seoTitle: string | null
  seoDesc: string | null
  specifications: SpecificationItem[]
  images: ProductImageInput[]
}

async function validateProduct(
  input: ProductInput,
): Promise<{ valid: ValidatedProduct } | { fieldErrors: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {}

  const name = cleanText(input.name)
  const slugInput = cleanText(input.slug)
  const categoryId = cleanText(input.categoryId)
  const shortDesc = cleanText(input.shortDesc)
  const slug = slugInput || slugify(name)

  if (name.length < 3) {
    fieldErrors.name = "Enter a product name of at least 3 characters."
  }

  if (!slug) {
    fieldErrors.slug = "Enter a slug, or a product name to generate one from."
  } else if (!SLUG_PATTERN.test(slug)) {
    fieldErrors.slug = "Use lowercase letters, numbers and hyphens only."
  }

  if (!categoryId) {
    fieldErrors.categoryId = "Choose a category."
  } else {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    })
    if (!category) fieldErrors.categoryId = "That category does not exist."
  }

  if (!shortDesc) {
    fieldErrors.shortDesc = "Add a short description."
  }

  const parsedSortOrder = Number(input.sortOrder)
  const sortOrder = Number.isFinite(parsedSortOrder)
    ? Math.max(0, Math.trunc(parsedSortOrder))
    : 0

  const specifications = sanitizeSpecifications(input.specifications, fieldErrors)
  const images = sanitizeImages(input.images, fieldErrors)

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  return {
    valid: {
      name,
      slug,
      categoryId,
      shortDesc,
      description: cleanText(input.description) || null,
      priceRange: cleanText(input.priceRange) || null,
      sortOrder,
      isFeatured: input.isFeatured === true,
      isActive: input.isActive !== false,
      seoTitle: cleanText(input.seoTitle) || null,
      seoDesc: cleanText(input.seoDesc) || null,
      specifications,
      images,
    },
  }
}

async function assertSlugAvailable(
  slug: string,
  editingId?: string,
): Promise<ProductSaveResult | null> {
  const existing = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  })

  if (existing && existing.id !== editingId) {
    return { ok: false, fieldErrors: { slug: "This slug is already in use." } }
  }

  return null
}

export async function createProduct(input: ProductInput): Promise<ProductSaveResult> {
  await requireAdmin()

  const result = await validateProduct(input)
  if ("fieldErrors" in result) return { ok: false, fieldErrors: result.fieldErrors }

  const conflict = await assertSlugAvailable(result.valid.slug)
  if (conflict) return conflict

  await prisma.product.create({ data: { ...result.valid } })
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ProductSaveResult> {
  await requireAdmin()

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    return { ok: false, error: "That product no longer exists." }
  }

  const result = await validateProduct(input)
  if ("fieldErrors" in result) return { ok: false, fieldErrors: result.fieldErrors }

  const conflict = await assertSlugAvailable(result.valid.slug, id)
  if (conflict) return conflict

  await prisma.product.update({ where: { id }, data: { ...result.valid } })
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function deleteProduct(id: string): Promise<ProductSaveResult> {
  await requireAdmin()

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    return { ok: false, error: "That product no longer exists." }
  }

  await prisma.product.delete({ where: { id } })
  revalidatePath("/", "layout")
  return { ok: true }
}
