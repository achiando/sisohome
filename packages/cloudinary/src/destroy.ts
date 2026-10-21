import { createHash } from 'node:crypto'
import { resolveCloudinaryConfig } from './config'

/**
 * Recover the Cloudinary `public_id` from a secure_url we stored earlier:
 *   https://res.cloudinary.com/<cloud>/image/upload/v1712345678/folder/name.jpg
 * → `folder/name.jpg` (version stripped, trailing Cloudinary upload extension
 * stripped — it is not part of the public_id).
 * Returns null for URLs that aren't Cloudinary upload URLs.
 */
export function publicIdFromUrl(secureUrl: string): string | null {
  let pathname: string
  try {
    pathname = new URL(secureUrl).pathname
  } catch {
    return null
  }
  const marker = '/upload/'
  const idx = pathname.indexOf(marker)
  if (idx < 0) return null
  let rest = decodeURIComponent(pathname.slice(idx + marker.length))
  const versioned = /^v\d+\//.test(rest)
  rest = rest.replace(/^v\d+\//, '')
  if (versioned) rest = rest.replace(/\.[A-Za-z0-9]{1,8}$/, '')
  return rest === '' ? null : rest
}

/**
 * Best-effort removal of an asset from Cloudinary (media lifecycle: when a
 * document or its property is deleted, the stored file must not linger in the
 * cloud). Never throws — callers treat failure as a logged orphan, not an
 * error. Also returns true for already-missing assets (`not found`).
 */
export async function destroyImage(
  publicId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  let cloudName: string
  let apiKey: string
  let apiSecret: string
  try {
    const config = resolveCloudinaryConfig(env)
    cloudName = config.cloudName
    apiKey = config.apiKey
    apiSecret = config.apiSecret
  } catch {
    return false
  }

  const timestamp = Math.round(Date.now() / 1000)
  // Destroy signs `public_id=<id>&timestamp=<ts>` (alphabetical field order).
  const signature = createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex')

  try {
    const body = new URLSearchParams({
      api_key: apiKey,
      timestamp: String(timestamp),
      public_id: publicId,
      signature,
    })
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body,
    })
    if (!res.ok) return false
    const data = (await res.json().catch(() => null)) as { result?: string } | null
    return data?.result === 'ok' || data?.result === 'not found'
  } catch {
    return false
  }
}
