export function formatKsh(price: number | null | undefined): string | null {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return null
  }
  return `KSh ${price.toLocaleString("en-KE")}`
}
