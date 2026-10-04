import { prisma } from './db'
import { tokenizeQuery } from './search'

export type ProductWithCategory = {
  id: string
  categoryId: string
  name: string
  slug: string
  shortDesc: string
  description: string | null
  unit: string | null
  specifications: any
  priceCents: number
  images: any
  category: {
    id: string
    name: string
    slug: string
  }
  seoTitle: string | null
  seoDesc: string | null
}

export async function getAllProducts() {
  return await prisma.diyProduct.findMany({
    where: { isActive: true },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })
}

export async function getFeaturedProducts() {
  return await prisma.diyProduct.findMany({
    where: { 
      isActive: true,
      isFeatured: true,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
    take: 6,
  })
}

export async function getProductBySlug(slug: string): Promise<ProductWithCategory | null> {
  const product = await prisma.diyProduct.findUnique({
    where: { 
      slug,
      isActive: true,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  return product
}

export async function getProductsByCategory(categorySlug: string, take?: number) {
  return await prisma.diyProduct.findMany({
    where: { 
      isActive: true,
      category: { slug: categorySlug },
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
    ...(take ? { take } : {}),
  })
}

export type CategoryList = {
  id: string
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isActive: boolean
}

export async function getAllCategories(): Promise<CategoryList[]> {
  return await prisma.diyCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const rows = await prisma.diyProduct.findMany({
    where: { isActive: true },
    select: { category: { select: { slug: true } } },
  })

  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.category.slug] = (counts[row.category.slug] ?? 0) + 1
    return counts
  }, {})
}

export async function getCategoryBySlug(slug: string) {
  return await prisma.diyCategory.findUnique({
    where: { 
      slug,
      isActive: true,
    },
  })
}

export async function getRelatedProducts(categoryId: string, excludeId: string) {
  return await prisma.diyProduct.findMany({
    where: { 
      isActive: true,
      categoryId,
      id: { not: excludeId },
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
    take: 12,
  })
}

function productTokenWhere(tokens: string[][]) {
  const perToken = tokens.map((variants) => ({
    OR: variants.flatMap((v) => [
      { name: { contains: v, mode: 'insensitive' as const } },
      { shortDesc: { contains: v, mode: 'insensitive' as const } },
      { description: { contains: v, mode: 'insensitive' as const } },
      { category: { name: { contains: v, mode: 'insensitive' as const } } },
      { category: { slug: { contains: v, mode: 'insensitive' as const } } },
    ]),
  }))
  return {
    all: { AND: perToken },
    any: { OR: perToken },
  }
}

export async function searchProducts(q: string, take = 10) {
  const tokens = tokenizeQuery(q)
  if (tokens.length === 0) return []
  const where = productTokenWhere(tokens)
  const include = {
    category: {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    },
  }
  const exact = await prisma.diyProduct.findMany({
    where: { isActive: true, ...where.all },
    include,
    orderBy: { sortOrder: 'asc' },
    take,
  })
  if (exact.length > 0) return exact
  return await prisma.diyProduct.findMany({
    where: { isActive: true, ...where.any },
    include,
    orderBy: { sortOrder: 'asc' },
    take,
  })
}

export async function searchCategories(q: string, take = 5): Promise<CategoryList[]> {
  const tokens = tokenizeQuery(q)
  if (tokens.length === 0) return []
  const perToken = tokens.map((variants) => ({
    OR: variants.flatMap((v) => [
      { name: { contains: v, mode: 'insensitive' as const } },
      { description: { contains: v, mode: 'insensitive' as const } },
      { slug: { contains: v, mode: 'insensitive' as const } },
    ]),
  }))
  const exact = await prisma.diyCategory.findMany({
    where: { isActive: true, AND: perToken },
    orderBy: { sortOrder: 'asc' },
    take,
  })
  if (exact.length > 0) return exact
  return await prisma.diyCategory.findMany({
    where: { isActive: true, OR: perToken },
    orderBy: { sortOrder: 'asc' },
    take,
  })
}
