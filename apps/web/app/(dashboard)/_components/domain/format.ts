/**
 * Domain formatting helpers (no existing helpers in @workspace/ui — checked).
 * Pure functions, safe on server and client.
 */

const KES = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
})

const MONEY = new Map<string, Intl.NumberFormat>()

function moneyFormatter(currency: string): Intl.NumberFormat {
  let fmt = MONEY.get(currency)
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })
    MONEY.set(currency, fmt)
  }
  return fmt
}

/** KES default — 0-decimal whole shillings ("KES 120,000"). */
export function formatMoney(amount: number | string | { toString(): string }, currency = 'KES'): string {
  const value = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(value)) return String(amount)
  if (currency === 'KES') return KES.format(value)
  try {
    return moneyFormatter(currency).format(value)
  } catch {
    return `${currency} ${value.toLocaleString('en-KE')}`
  }
}

/** Short date — "12 Mar 2026" (UTC-safe for date-only values). */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Compact relative label — "Today", "Tomorrow", "in 5 days", "3 days ago". */
export function formatRelativeDay(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 0) return `in ${diffDays} days`
  return `${-diffDays} days ago`
}
