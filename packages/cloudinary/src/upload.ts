import { resolveCloudinaryConfig } from './config'
import { CloudinaryUploadError } from './errors'
import { sanitizeFolder, signUpload } from './sign'
import {
  DEFAULT_ALLOWED_IMAGE_MIME_TYPES,
  DEFAULT_MAX_UPLOAD_BYTES,
  type UploadImageOptions,
  type UploadImageResult,
} from './types'

type CloudinaryResponse = {
  secure_url?: string
  public_id?: string
  bytes?: number
  format?: string
  width?: number
  height?: number
  error?: { message?: string }
}

/**
 * Server-side direct upload to Cloudinary (no SDK — REST + signed params).
 * The file bytes go browser→route→Cloudinary; this helper is for the route
 * side only (never expose the API secret to the client).
 */
export async function uploadImage(
  file: File,
  options: UploadImageOptions,
  env: NodeJS.ProcessEnv = process.env,
): Promise<UploadImageResult> {
  const config = resolveCloudinaryConfig(env)

  const folder = sanitizeFolder(options.folder)
  if (!folder) throw new CloudinaryUploadError('Invalid upload folder.', 400)

  const allowed = options.allowedMimeTypes ?? DEFAULT_ALLOWED_IMAGE_MIME_TYPES
  if (!allowed.includes(file.type)) {
    throw new CloudinaryUploadError(
      `Unsupported file type "${file.type}". Use: ${allowed.join(', ')}.`,
      415,
    )
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES
  if (file.size > maxBytes) {
    throw new CloudinaryUploadError(
      `File is larger than ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      413,
    )
  }

  const timestamp = Math.round(Date.now() / 1000)
  const { signature } = signUpload({ folder, timestamp }, config.apiSecret)

  const form = new FormData()
  form.append('file', file)
  form.append('api_key', config.apiKey)
  form.append('timestamp', String(timestamp))
  form.append('signature', signature)
  form.append('folder', folder)

  let response: Response
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/${options.resourceType ?? 'image'}/upload`,
      { method: 'POST', body: form },
    )
  } catch {
    throw new CloudinaryUploadError('Could not reach Cloudinary. Try again.', 502)
  }

  const data = (await response.json().catch(() => null)) as CloudinaryResponse | null
  if (!response.ok || !data?.secure_url || !data.public_id) {
    throw new CloudinaryUploadError(
      data?.error?.message || 'Cloudinary rejected the upload.',
      502,
    )
  }

  return {
    secureUrl: data.secure_url,
    publicId: data.public_id,
    bytes: data.bytes ?? file.size,
    format: data.format ?? file.type.split('/')[1] ?? 'bin',
    width: data.width,
    height: data.height,
  }
}
