import { prisma } from './db'

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

export async function getProductsByCategory(categorySlug: string) {
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
    take: 4,
  })
}

export async function searchProducts(q: string, take = 10) {
  if (!q) return []
  return await prisma.diyProduct.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { shortDesc: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
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
    take,
  })
}

export async function searchCategories(q: string, take = 5): Promise<CategoryList[]> {
  if (!q) return []
  return await prisma.diyCategory.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { sortOrder: 'asc' },
    take,
  })
}
