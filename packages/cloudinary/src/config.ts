import { CloudinaryConfigError } from './errors'
import type { CloudinaryConfig } from './types'

/**
 * Read Cloudinary credentials from the environment on every upload so tests
 * and dev servers can switch clouds without a rebuild.
 *
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = ...
 *   CLOUDINARY_API_KEY                = ...
 *   CLOUDINARY_API_SECRET             = ...
 */
export function resolveCloudinaryConfig(
  env: NodeJS.ProcessEnv = process.env,
): CloudinaryConfig {
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim()
  const apiKey = env.CLOUDINARY_API_KEY?.trim()
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim()
  if (!cloudName || !apiKey || !apiSecret) {
    throw new CloudinaryConfigError(
      'Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
    )
  }
  return { cloudName, apiKey, apiSecret }
}
