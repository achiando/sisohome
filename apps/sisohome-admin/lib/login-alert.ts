import type { NextRequest } from 'next/server'

import { sendEmail } from '@workspace/email'

import { appUrl } from '@/lib/base-url'
import { loginAlertEmail } from '@/lib/email/login-alert'

/**
 * Sign-in notification: every successful sign-in emails the account owner
 * where and from what device it happened. Reads the request headers
 * synchronously, then resolves device/IP/location off the request path so
 * login latency never depends on the geo lookup — failures are logged,
 * never surfaced.
 */

interface LoginUser {
  email: string
  displayName?: string | null
}

/** "Chrome on macOS (Desktop)" — best-effort from the User-Agent. */
export function describeDevice(userAgent: string | null): string {
  const ua = userAgent ?? ''
  if (!ua.trim()) return 'Unknown device'

  const browser =
    /\bEdg[A-Za-z]*\//.test(ua) ? 'Edge'
    : /\bOPR\/|\bOpera\//.test(ua) ? 'Opera'
    : /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
    : /FxiOS\/|Firefox\//.test(ua) ? 'Firefox'
    : /CriOS\/|Chrome\//.test(ua) ? 'Chrome'
    : /Version\/[\d.]+.*Safari\//.test(ua) || /Safari\//.test(ua) ? 'Safari'
    : null

  const os =
    /iPhone|iPod/.test(ua) ? 'iOS'
    : /iPad/.test(ua) ? 'iPadOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows NT/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : null

  const type = /iPad|Tablet/.test(ua) || /Android(?!.*Mobile)/.test(ua)
    ? 'Tablet'
    : /Mobile|iPhone|iPod|Android.*Mobile|IEMobile|Opera Mini/.test(ua)
      ? 'Mobile'
      : 'Desktop'

  const core = [browser, os].filter(Boolean).join(' on ')
  return core ? `${core} (${type})` : `Unknown browser (${type})`
}

/** First hop IP — honours the reverse-proxy headers this app sits behind. */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || request.headers.get('x-real-ip')?.trim() || ''
}

function isLoopbackOrPrivate(ip: string): boolean {
  return (
    !ip ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  )
}

/** City/region/country for a public IP, or null when unknown/unreachable. */
export async function lookupLocation(ip: string): Promise<string | null> {
  if (isLoopbackOrPrivate(ip)) return null
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      city?: string
      region?: string
      country_name?: string
      reserved?: boolean
    }
    if (data.reserved) return null
    const place = [data.city, data.region, data.country_name].filter(Boolean).join(', ')
    return place || null
  } catch {
    return null
  }
}

function formatUtcNow(): string {
  const when = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date())
  return `${when} UTC`
}

/**
 * Send the sign-in notice. Never throws — call sites fire and forget.
 */
export async function notifyNewLogin(request: NextRequest, user: LoginUser): Promise<void> {
  // Read request headers before any await — the response may already be on
  // its way out by the time the geo lookup finishes.
  const device = describeDevice(request.headers.get('user-agent'))
  const ip = clientIp(request)
  const location = isLoopbackOrPrivate(ip)
    ? 'Local machine'
    : (await lookupLocation(ip)) ?? 'Unknown location'

  try {
    await sendEmail(
      loginAlertEmail({
        to: user.email,
        recipientName: user.displayName ?? undefined,
        device,
        location,
        ip: ip || 'Unknown',
        time: formatUtcNow(),
        settingsUrl: `${appUrl()}/settings`,
      }),
    )
  } catch (error) {
    console.error('Login alert email failed:', error)
  }
}
