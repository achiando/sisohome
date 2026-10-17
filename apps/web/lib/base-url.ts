/**
 * Absolute base URL for links written into emails (verification, reset,
 * sign-in). APP_URL wins in production; localhost is the dev default.
 */
export function appUrl(): string {
  return process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}
