export type ProjectImage = { url: string; alt?: string }

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
