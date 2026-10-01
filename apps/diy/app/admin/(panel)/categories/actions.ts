"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import type { CategoryInput, SaveResult } from "@/lib/validate"
import { SLUG_PATTERN, cleanText, slugify } from "@/lib/validate"

interface ValidatedCategory {
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isActive: boolean
}

async function validateCategory(
  input: CategoryInput,
): Promise<{ valid: ValidatedCategory } | { fieldErrors: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {}

  const name = cleanText(input.name)
  const slugInput = cleanText(input.slug)
  const slug = slugInput || slugify(name)

  if (name.length < 2) {
    fieldErrors.name = "Enter a category name of at least 2 characters."
  }

  if (!slug) {
    fieldErrors.slug = "Enter a slug, or a category name to generate one from."
  } else if (!SLUG_PATTERN.test(slug)) {
    fieldErrors.slug = "Use lowercase letters, numbers and hyphens only."
  }

  const parsedSortOrder = Number(input.sortOrder)
  const sortOrder = Number.isFinite(parsedSortOrder)
    ? Math.max(0, Math.trunc(parsedSortOrder))
    : 0

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  return {
    valid: {
      name,
      slug,
      description: cleanText(input.description) || null,
      sortOrder,
      isActive: input.isActive !== false,
    },
  }
}

async function assertSlugAvailable(
  slug: string,
  editingId?: string,
): Promise<SaveResult | null> {
  const existing = await prisma.diyCategory.findUnique({
    where: { slug },
    select: { id: true },
  })

  if (existing && existing.id !== editingId) {
    return { ok: false, fieldErrors: { slug: "This slug is already in use." } }
  }

  return null
}

export async function createCategory(input: CategoryInput): Promise<SaveResult> {
  await requireAdmin()

  const result = await validateCategory(input)
  if ("fieldErrors" in result) return { ok: false, fieldErrors: result.fieldErrors }

  const conflict = await assertSlugAvailable(result.valid.slug)
  if (conflict) return conflict

  await prisma.diyCategory.create({ data: result.valid })
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function updateCategory(id: string, input: CategoryInput): Promise<SaveResult> {
  await requireAdmin()

  const existing = await prisma.diyCategory.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    return { ok: false, error: "That category no longer exists." }
  }

  const result = await validateCategory(input)
  if ("fieldErrors" in result) return { ok: false, fieldErrors: result.fieldErrors }

  const conflict = await assertSlugAvailable(result.valid.slug, id)
  if (conflict) return conflict

  await prisma.diyCategory.update({ where: { id }, data: result.valid })
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<SaveResult> {
  await requireAdmin()

  const existing = await prisma.diyCategory.findUnique({
    where: { id },
    select: { id: true, _count: { select: { products: true } } },
  })
  if (!existing) {
    return { ok: false, error: "That category no longer exists." }
  }

  if (existing._count.products > 0) {
    return {
      ok: false,
      error: `This category still has ${existing._count.products} ${
        existing._count.products === 1 ? "product" : "products"
      }. Move or delete them first.`,
    }
  }

  await prisma.diyCategory.delete({ where: { id } })
  revalidatePath("/", "layout")
  return { ok: true }
}
