import type { MetadataRoute } from "next"

export const revalidate = 60
import { prisma } from "@/lib/db"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/projects`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.6 },
  ]

  const [categories, products, projects] = await Promise.all([
    prisma.diyCategory.findMany({
      where: { isActive: true },
      select: { slug: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.diyProduct.findMany({
      where: { isActive: true },
      select: { slug: true, category: { select: { slug: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.diyProject.findMany({
      where: { isActive: true },
      select: { slug: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  return [
    ...staticRoutes,
    ...categories.map((category) => ({
      url: `${siteUrl}/products/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${siteUrl}/products/${product.category.slug}/${product.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...projects.map((project) => ({
      url: `${siteUrl}/projects/${project.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ]
}
