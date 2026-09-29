import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const KEY_LENGTH = 64
const SALT_BYTES = 16
const SCHEME = "scrypt"

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("base64")
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("base64")
  return `${SCHEME}$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, expected] = stored.split("$")
  if (scheme !== SCHEME || !salt || !expected) return false

  const candidate = scryptSync(password, salt, KEY_LENGTH)
  const expectedBuffer = Buffer.from(expected, "base64")

  return (
    candidate.length === expectedBuffer.length &&
    timingSafeEqual(candidate, expectedBuffer)
  )
}
