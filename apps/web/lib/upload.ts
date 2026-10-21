/**
 * Client-side upload helpers — send a file to POST /api/uploads (Cloudinary,
 * signed server-side) and receive the public URL to store as a document
 * `storageKey`. Progress reporting is coarse (fetch has no upload progress);
 * the FileUpload component treats 15→100 as an indeterminate hand-off.
 */

import type { UploadedFile } from '@workspace/ui/types/components'

export type UploadResult = {
  url: string
  publicId: string
  bytes: number
  format: string
}

export async function uploadToCloudinary(file: File, folder: string): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  if (folder) form.append('folder', folder)
  const res = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: form })
  const data = (await res.json().catch(() => ({}))) as Partial<UploadResult> & { error?: string }
  if (!res.ok || !data.url) throw new Error(data.error ?? 'Upload failed')
  return { url: data.url, publicId: data.publicId ?? '', bytes: data.bytes ?? file.size, format: data.format ?? '' }
}

/**
 * `onUpload` signature expected by @workspace/ui FileUpload:
 * returns the stored URL (Cloudinary secure_url) on success.
 */
export function cloudinaryUploadHandler(folder: string) {
  return async (file: File, onProgress: (pct: number) => void): Promise<string> => {
    onProgress(20)
    const result = await uploadToCloudinary(file, folder)
    onProgress(100)
    return result.url
  }
}

/**
 * Register photos as document rows (PropertyDocument: `storageKey` =
 * secure_url). Used after property / unit create+edit — the media lifecycle
 * pairs every row with a cloud asset, so document delete can destroy the
 * asset (ref-counted server-side).
 *
 * First photo becomes the cover ONLY when the gallery is still empty
 * (`existingCount === 0`). Returns per-call counts so callers can toast a
 * partial failure instead of hiding it.
 */
async function registerPhotos(opts: {
  entityType: 'PROPERTY' | 'UNIT' | 'BUILDING'
  entityId: string
  photos: { storageKey: string; fileName?: string; mimeType?: string | null; sizeBytes?: number | null }[]
  existingCount?: number
}): Promise<{ registered: number; failed: number }> {
  let registered = 0
  let failed = 0
  for (const [i, photo] of opts.photos.entries()) {
    if (!photo?.storageKey) continue
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: opts.entityType,
          entityId: opts.entityId,
          kind: 'PHOTO',
          storageKey: photo.storageKey,
          fileName: photo.fileName ?? photo.storageKey.split('/').filter(Boolean).pop() ?? 'photo',
          mimeType: photo.mimeType ?? null,
          sizeBytes: photo.sizeBytes ?? null,
          isCover: (opts.existingCount ?? 0) === 0 && i === 0,
        }),
      })
      if (res.ok) registered += 1
      else failed += 1
    } catch {
      failed += 1
    }
  }
  return { registered, failed }
}

/** Files a FileUpload field already pushed to Cloudinary → document rows. */
export async function registerUploadedPhotos(opts: {
  entityType: 'PROPERTY' | 'UNIT' | 'BUILDING'
  entityId: string
  media: unknown
  existingCount?: number
}): Promise<{ registered: number; failed: number }> {
  const files = (Array.isArray(opts.media) ? opts.media : []) as UploadedFile[]
  const fresh = files.filter((f) => f.status === 'success' && f.remoteUrl)
  return registerPhotos({
    entityType: opts.entityType,
    entityId: opts.entityId,
    existingCount: opts.existingCount,
    photos: fresh.map((f) => ({
      storageKey: f.remoteUrl as string,
      fileName: f.name,
      mimeType: f.type ?? null,
      sizeBytes: typeof f.size === 'number' ? f.size : null,
    })),
  })
}

/**
 * Link EXISTING property-gallery photos to a unit (`entityType=UNIT` rows
 * sharing the property's storageKey — ref-counted destroy keeps the
 * property's copy safe when the unit link is removed).
 */
export async function registerPhotoUrls(opts: {
  entityType: 'PROPERTY' | 'UNIT' | 'BUILDING'
  entityId: string
  photos: { storageKey: string; fileName?: string }[]
  existingCount?: number
}): Promise<{ registered: number; failed: number }> {
  return registerPhotos({
    entityType: opts.entityType,
    entityId: opts.entityId,
    existingCount: opts.existingCount,
    photos: opts.photos,
  })
}
