export interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
}

export interface UploadImageResult {
  secureUrl: string
  publicId: string
  bytes: number
  format: string
  width?: number
  height?: number
}

export interface UploadImageOptions {
  /** Cloudinary folder, e.g. `sisohomes/properties/<id>`. Sanitized. */
  folder: string
  /** Override the default 10 MB cap (bytes). */
  maxBytes?: number
  /** Override the default image mime allowlist. */
  allowedMimeTypes?: readonly string[]
  /** Unique filename prefix (defaults to `img`). */
  resourceType?: 'image' | 'video' | 'raw'
}

export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const DEFAULT_ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const
