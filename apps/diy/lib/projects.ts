import { prisma } from "./db"

export type ProjectImage = { url: string; alt?: string }

export type ProjectListItem = {
  id: string
  title: string
  slug: string
  category: string | null
  shortDesc: string | null
  images: unknown
  isFeatured: boolean
  seoTitle: string | null
  seoDesc: string | null
}

export type ProjectProductLink = {
  quantity: number
  isRequired: boolean
  product: {
    id: string
    name: string
    slug: string
    shortDesc: string
    unit: string | null
    priceCents: number
    images: unknown
    category: { name: string; slug: string }
  }
}

export type ProjectWithProducts = ProjectListItem & {
  description: string | null
  steps: unknown
  products: ProjectProductLink[]
}

export function parseProjectImages(raw: unknown): ProjectImage[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    if (entry && typeof entry === "object" && typeof (entry as ProjectImage).url === "string") {
      const image = entry as ProjectImage
      return [{ url: image.url, alt: typeof image.alt === "string" ? image.alt : undefined }]
    }
    return []
  })
}

export type ProjectStep = { title: string; body: string }

export function parseProjectSteps(raw: unknown): ProjectStep[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    if (entry && typeof entry === "object") {
      const step = entry as { title?: unknown; body?: unknown }
      if (typeof step.title === "string" && typeof step.body === "string") {
        return [{ title: step.title, body: step.body }]
      }
    }
    return []
  })
}

const listItemSelect = {
  id: true,
  title: true,
  slug: true,
  category: true,
  shortDesc: true,
  images: true,
  isFeatured: true,
  seoTitle: true,
  seoDesc: true,
} as const

export async function getAllProjects(): Promise<ProjectListItem[]> {
  return await prisma.diyProject.findMany({
    where: { isActive: true },
    select: listItemSelect,
    orderBy: { sortOrder: "asc" },
  })
}

export async function getFeaturedProjects(): Promise<ProjectListItem[]> {
  return await prisma.diyProject.findMany({
    where: { isActive: true, isFeatured: true },
    select: listItemSelect,
    orderBy: { sortOrder: "asc" },
    take: 6,
  })
}

export async function getProjectsByCategory(category: string): Promise<ProjectListItem[]> {
  return await prisma.diyProject.findMany({
    where: { isActive: true, category },
    select: listItemSelect,
    orderBy: { sortOrder: "asc" },
  })
}

export async function getProjectCategories(): Promise<string[]> {
  const rows = await prisma.diyProject.findMany({
    where: { isActive: true },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  })
  return rows.map((row) => row.category).filter((c): c is string => Boolean(c))
}

export async function getProjectBySlug(slug: string): Promise<ProjectWithProducts | null> {
  return await prisma.diyProject.findUnique({
    where: { slug, isActive: true },
    select: {
      ...listItemSelect,
      description: true,
      steps: true,
      products: {
        orderBy: { sortOrder: "asc" },
        where: { product: { isActive: true } },
        select: {
          quantity: true,
          isRequired: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              shortDesc: true,
              unit: true,
              priceCents: true,
              images: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  })
}

export async function getRelatedProjects(
  project: { id: string; category: string | null },
  take = 3,
): Promise<ProjectListItem[]> {
  if (project.category) {
    const sameCategory = await prisma.diyProject.findMany({
      where: { isActive: true, category: project.category, id: { not: project.id } },
      select: listItemSelect,
      orderBy: { sortOrder: "asc" },
      take,
    })
    if (sameCategory.length > 0) return sameCategory
  }

  return await prisma.diyProject.findMany({
    where: { isActive: true, id: { not: project.id } },
    select: listItemSelect,
    orderBy: { sortOrder: "asc" },
    take,
  })
}

export async function getProjectsUsingProduct(productId: string, take = 3): Promise<ProjectListItem[]> {
  return await prisma.diyProject.findMany({
    where: { isActive: true, products: { some: { productId } } },
    select: listItemSelect,
    orderBy: { sortOrder: "asc" },
    take,
  })
}

export type SearchResult = {
  projects: ProjectListItem[]
  categories: { id: string; name: string; slug: string; description: string | null }[]
}

export async function searchProjects(q: string, take = 10): Promise<ProjectListItem[]> {
  if (!q) return []
  return await prisma.diyProject.findMany({
    where: {
      isActive: true,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { shortDesc: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ],
    },
    select: listItemSelect,
    orderBy: { sortOrder: "asc" },
    take,
  })
}
