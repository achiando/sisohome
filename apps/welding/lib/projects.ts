import { prisma } from './db'

export type ProjectWithImages = {
  id: string
  title: string
  slug: string
  type: string
  location: string | null
  description: string | null
  images: any
  seoTitle: string | null
  seoDesc: string | null
}

export async function getAllProjects() {
  return await prisma.project.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

export async function getFeaturedProjects() {
  return await prisma.project.findMany({
    where: { 
      isActive: true,
      isFeatured: true,
    },
    orderBy: { sortOrder: 'asc' },
    take: 6,
  })
}

export async function getProjectBySlug(slug: string): Promise<ProjectWithImages | null> {
  return await prisma.project.findUnique({
    where: { 
      slug,
      isActive: true,
    },
  })
}

export async function getProjectsByType(type: string) {
  return await prisma.project.findMany({
    where: { 
      isActive: true,
      type,
    },
    orderBy: { sortOrder: 'asc' },
  })
}
