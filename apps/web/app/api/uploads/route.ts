import { uploadImage, sanitizeFolder, CloudinaryUploadError, CloudinaryConfigError, DEFAULT_ALLOWED_IMAGE_MIME_TYPES } from '@workspace/cloudinary';
import { apiRoute, RouteError } from '@/lib/api-route';

/**
 * POST /api/uploads — multipart file → Cloudinary (signed server-side), no
 * bytes stored in our DB. Returns `{ url, publicId, bytes, format }`; the
 * caller registers the URL as a PropertyDocument `storageKey`.
 *
 * Folder policy: everything lives under `sisohomes/` — the client sends a
 * subfolder like `properties/<id>` or `properties/pending/<uuid>`.
 * Gated `document.upload` (the same key needed to register the result).
 *
 * Images + PDFs ride Cloudinary's `image` resource type; office/text files
 * go to `raw` (Cloudinary rejects those under image/upload).
 */
const DOCUMENT_MIME_TYPES = [
  ...DEFAULT_ALLOWED_IMAGE_MIME_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

const IMAGE_MIME_TYPES: readonly string[] = DEFAULT_ALLOWED_IMAGE_MIME_TYPES;
const RAW_MIME_TYPES = DOCUMENT_MIME_TYPES.filter(
  (m) => m !== 'application/pdf' && !IMAGE_MIME_TYPES.includes(m),
);

export const POST = apiRoute({
  permissions: 'document.upload',
  async handler({ request }) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new RouteError(400, 'Expected multipart form data');
    }

    const file = form.get('file');
    if (!(file instanceof File)) throw new RouteError(400, 'No file provided');

    const subRaw = typeof form.get('folder') === 'string' ? String(form.get('folder')) : '';
    const sub = sanitizeFolder(subRaw.replace(/^\/+/, ''));
    if (subRaw.trim() !== '' && !sub) throw new RouteError(400, 'Invalid folder');

    try {
      const result = await uploadImage(file, {
        folder: ['sisohomes', sub].filter(Boolean).join('/'),
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        maxBytes: 20 * 1024 * 1024,
        resourceType: RAW_MIME_TYPES.includes(file.type) ? 'raw' : 'image',
      });
      return {
        url: result.secureUrl,
        publicId: result.publicId,
        bytes: result.bytes,
        format: result.format,
      };
    } catch (err) {
      if (err instanceof CloudinaryUploadError) throw new RouteError(err.status, err.message);
      if (err instanceof CloudinaryConfigError) throw new RouteError(500, err.message);
      throw err;
    }
  },
});
