import { NextResponse } from 'next/server';
import { apiRoute } from '@/lib/api-route';
import * as documents from '@/lib/domain/documents';

function safeFileName(name: string): string {
  const cleaned = name.replace(/["\\\r\n]/g, '_').trim();
  return cleaned || 'document';
}

/** text/* types without an explicit charset get UTF-8 — contracts are UTF-8 bytes. */
function contentType(mimeType: string | null): string {
  const type = mimeType ?? 'text/html';
  if (type.startsWith('text/') && !/charset=/i.test(type)) return `${type}; charset=utf-8`;
  return type;
}

/**
 * GET /api/documents/[id]/download — serve a document's content.
 *
 * Generated documents (roadmap Phase 2 signed contracts) store their HTML
 * inline, so the response bytes are exactly what the sha256 caption
 * fingerprints: `?disposition=inline` opens a view tab (scripts sandboxed),
 * the default downloads as an attachment. Uploaded objects redirect to their
 * storage URL; pointers without stored bytes 404.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'document.read',
  async handler({ actor, params, query }) {
    const file = await documents.downloadDocument(actor, params.id);
    if (file.url) return NextResponse.redirect(file.url, 307);
    const disposition = query.get('disposition') === 'inline' ? 'inline' : 'attachment';
    return new NextResponse(file.content, {
      headers: {
        'Content-Type': contentType(file.mimeType),
        'Content-Disposition': `${disposition}; filename="${safeFileName(file.fileName)}"`,
        'Content-Security-Policy': 'sandbox',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  },
});
