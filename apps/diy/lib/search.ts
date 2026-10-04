export type TokenVariants = string[]

function variants(token: string): TokenVariants {
  const set = new Set<string>([token])
  if (/^\d+(\.\d+)?k$/.test(token)) set.add(token.slice(0, -1) + " k")
  if (token === "ohm" || token === "ohms") set.add("Ω")
  if (token === "kohm" || token === "kohms") {
    set.add("kΩ")
    set.add("k ohm")
  }
  return [...set]
}

export function tokenizeQuery(q: string): TokenVariants[] {
  if (!q.trim()) return []
  return q
    .toLowerCase()
    .split(/[^a-z0-9Ωµ]+/)
    .filter(Boolean)
    .map(variants)
}
