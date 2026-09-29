import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

const COOKIE_NAME = "tijwa_admin_session"
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface SessionPayload {
  adminId: string
  expiresAt: number
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET is not set")
  return secret
}

function sign(body: string): string {
  return createHmac("sha256", getSecret()).update(body).digest("base64url")
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${body}.${sign(body)}`
}

export function decodeSession(token: string | null | undefined): SessionPayload | null {
  if (!token) return null
  const [body, signature] = token.split(".")
  if (!body || !signature) return null

  const expected = Buffer.from(sign(body))
  const provided = Buffer.from(signature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload
    if (typeof payload.adminId !== "string" || typeof payload.expiresAt !== "number") return null
    if (payload.expiresAt < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export async function createSession(adminId: string): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, encodeSession({ adminId, expiresAt }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  return decodeSession(cookieStore.get(COOKIE_NAME)?.value)
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
