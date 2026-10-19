/**
 * Deep-link (`?next=`) helpers — shared by the auth pages and onboarding.
 *
 * A `next` value is only trusted when it is a same-site absolute path
 * (starts with a single `/`), which blocks open redirects such as
 * `//evil.example` or `https://evil.example`.
 */

export function sanitizeNext(next: string | string[] | undefined | null): string | null {
  const value = Array.isArray(next) ? next[0] : next
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return null
}

/** Read + sanitize `?next=` from the current browser location (client-side). */
export function readNextParam(): string | null {
  const value = new URLSearchParams(window.location.search).get('next')
  return sanitizeNext(value)
}
