"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import type { ProductImageInput } from "@/lib/product-input"
import type {
  ProjectInput,
  ProjectProductLinkInput,
  ProjectStepInput,
  SaveResult,
} from "@/lib/validate"
import {
  SLUG_PATTERN,
  cleanText,
  sanitizeImages,
  sanitizeProductLinks,
  sanitizeSteps,
  slugify,
} from "@/lib/validate"

interface ValidatedProject {
  title: string
  slug: string
  category: string | null
  shortDesc: string
  description: string | null
  steps: ProjectStepInput[]
  images: ProductImageInput[]
  sortOrder: number
  isFeatured: boolean
  isActive: boolean
  seoTitle: string | null
  seoDesc: string | null
  products: ProjectProductLinkInput[]
}

async function validateProject(
  input: ProjectInput,
): Promise<{ valid: ValidatedProject } | { fieldErrors: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {}

  const title = cleanText(input.title)
  const slugInput = cleanText(input.slug)
  const slug = slugInput || slugify(title)
  const shortDesc = cleanText(input.shortDesc)

  if (title.length < 3) {
    fieldErrors.title = "Enter a project title of at least 3 characters."
  }

  if (!slug) {
    fieldErrors.slug = "Enter a slug, or a project title to generate one from."
  } else if (!SLUG_PATTERN.test(slug)) {
    fieldErrors.slug = "Use lowercase letters, numbers and hyphens only."
  }

  if (!shortDesc) {
    fieldErrors.shortDesc = "Add a short description for listings and cards."
  }

  const parsedSortOrder = Number(input.sortOrder)
  const sortOrder = Number.isFinite(parsedSortOrder)
    ? Math.max(0, Math.trunc(parsedSortOrder))
    : 0

  const steps = sanitizeSteps(input.steps, fieldErrors)
  const images = sanitizeImages(input.images, fieldErrors)
  const products = sanitizeProductLinks(input.products, fieldErrors)

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  return {
    valid: {
      title,
      slug,
      category: cleanText(input.category) || null,
      shortDesc,
      description: cleanText(input.description) || null,
      steps,
      images,
      sortOrder,
      isFeatured: input.isFeatured === true,
      isActive: input.isActive !== false,
      seoTitle: cleanText(input.seoTitle) || null,
      seoDesc: cleanText(input.seoDesc) || null,
      products,
    },
  }
}

async function assertSlugAvailable(
  slug: string,
  editingId?: string,
): Promise<SaveResult | null> {
  const existing = await prisma.diyProject.findUnique({
    where: { slug },
    select: { id: true },
  })

  if (existing && existing.id !== editingId) {
    return { ok: false, fieldErrors: { slug: "This slug is already in use." } }
  }

  return null
}

async function assertProductsExist(
  links: ProjectProductLinkInput[],
): Promise<SaveResult | null> {
  if (links.length === 0) return null

  const ids = links.map((link) => link.productId)
  const found = await prisma.diyProduct.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  })

  if (found.length !== ids.length) {
    return {
      ok: false,
      fieldErrors: { products: "One of the selected products no longer exists." },
    }
  }

  return null
}

export async function createProject(input: ProjectInput): Promise<SaveResult> {
  await requireAdmin()

  const result = await validateProject(input)
  if ("fieldErrors" in result) return { ok: false, fieldErrors: result.fieldErrors }

  const conflict = await assertSlugAvailable(result.valid.slug)
  if (conflict) return conflict

  const productConflict = await assertProductsExist(result.valid.products)
  if (productConflict) return productConflict

  const { products, ...data } = result.valid

  await prisma.$transaction(async (tx) => {
    const project = await tx.diyProject.create({ data })
    if (products.length > 0) {
      await tx.diyProjectProduct.createMany({
        data: products.map((link, index) => ({
          projectId: project.id,
          productId: link.productId,
          quantity: link.quantity,
          isRequired: link.isRequired,
          sortOrder: index,
        })),
      })
    }
  })

  revalidatePath("/", "layout")
  return { ok: true }
}

export async function updateProject(
  id: string,
  input: ProjectInput,
): Promise<SaveResult> {
  await requireAdmin()

  const existing = await prisma.diyProject.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    return { ok: false, error: "That project no longer exists." }
  }

  const result = await validateProject(input)
  if ("fieldErrors" in result) return { ok: false, fieldErrors: result.fieldErrors }

  const conflict = await assertSlugAvailable(result.valid.slug, id)
  if (conflict) return conflict

  const productConflict = await assertProductsExist(result.valid.products)
  if (productConflict) return productConflict

  const { products, ...data } = result.valid

  await prisma.$transaction(async (tx) => {
    await tx.diyProject.update({ where: { id }, data })
    await tx.diyProjectProduct.deleteMany({ where: { projectId: id } })
    if (products.length > 0) {
      await tx.diyProjectProduct.createMany({
        data: products.map((link, index) => ({
          projectId: id,
          productId: link.productId,
          quantity: link.quantity,
          isRequired: link.isRequired,
          sortOrder: index,
        })),
      })
    }
  })

  revalidatePath("/", "layout")
  return { ok: true }
}

export async function deleteProject(id: string): Promise<SaveResult> {
  await requireAdmin()

  const existing = await prisma.diyProject.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    return { ok: false, error: "That project no longer exists." }
  }

  await prisma.diyProject.delete({ where: { id } })
  revalidatePath("/", "layout")
  return { ok: true }
}
