import guidesData from "@/data/guides.json"

export interface Guide {
  title: string
  slug: string
  description: string
  content: string
  relatedProducts: string[]
}

export async function getAllGuides(): Promise<Guide[]> {
  return guidesData as Guide[]
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const guides = await getAllGuides()
  return guides.find((guide) => guide.slug === slug) || null
}
