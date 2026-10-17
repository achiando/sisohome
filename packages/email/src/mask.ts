/**
 * `jane.doe@example.com` → `j***e@example.com`.
 *
 * Used in two-factor prompts so the user recognises their own address without
 * the UI echoing a full address back at sign-in (a small enumeration surface).
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at)
  if (local.length <= 2) return `${local.charAt(0)}***${domain}`
  return `${local.charAt(0)}***${local.charAt(local.length - 1)}${domain}`
}
