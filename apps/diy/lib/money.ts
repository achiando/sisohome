export function formatKsh(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return null
  }
  return `KSh ${(cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`
}
