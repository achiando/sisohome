export type SpecificationItem = {
  label: string
  material: string
  pieces: number | null
}

export function parseSpecifications(raw: unknown): SpecificationItem[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry): SpecificationItem[] => {
      if (entry && typeof entry === "object") {
        const item = entry as { label?: unknown; material?: unknown; pieces?: unknown }
        if (typeof item.label === "string" && typeof item.material === "string") {
          return [
            {
              label: item.label,
              material: item.material,
              pieces: typeof item.pieces === "number" ? item.pieces : null,
            },
          ]
        }
      }
      return []
    })
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([label, material]) => ({
      label,
      material: typeof material === "string" ? material : String(material),
      pieces: null,
    }))
  }

  return []
}
