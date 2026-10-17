import type { RenderedEmail } from './types'

/** Email HTML is string-built, so every interpolated value is escaped here. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface RenderEmailOptions {
  heading: string
  intro?: string
  /** One-time code shown as a large monospace block. */
  code?: string
  codeHint?: string
  paragraphs?: string[]
  cta?: { label: string; url: string }
  outro?: string[]
  footer?: string
}

const BRAND = 'SisoHome'
const MUTED = '#64748b'
const FOREGROUND = '#0f172a'
const BORDER = '#e2e8f0'
const ACCENT = '#0f172a'

/**
 * Single layout used by every template: inline styles, system fonts and no
 * external assets, so it renders in Gmail, Outlook, Apple Mail and the dev
 * outbox alike. Returns the HTML body plus the plain-text alternative.
 */
export function renderEmail(options: RenderEmailOptions): RenderedEmail {
  const { heading, intro, code, codeHint, paragraphs = [], cta, outro = [], footer } = options

  const preheader = [intro ?? heading, codeHint].filter(Boolean).join(' · ')

  const textLines: string[] = [BRAND, '', heading, '']
  if (intro) textLines.push(intro, '')
  if (code) textLines.push(code, '')
  for (const p of paragraphs) textLines.push(p, '')
  if (cta) textLines.push(`${cta.label}: ${cta.url}`, '')
  for (const p of outro) textLines.push(p, '')
  textLines.push('—', footer ?? 'Property operations, calmly organized.')

  const htmlCode = code
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td align="center" style="background:${FOREGROUND};border-radius:12px;padding:16px 28px;">
        <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;letter-spacing:8px;color:#ffffff;font-weight:700;">${escapeHtml(code)}</span>
      </td></tr></table>`
    : ''

  const htmlCta = cta
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:12px;">${escapeHtml(cta.label)}</a></p>
       <p style="margin:0 0 24px;font-size:13px;color:${MUTED};word-break:break-all;">Or paste this link into your browser:<br/><a href="${escapeHtml(cta.url)}" style="color:${MUTED};">${escapeHtml(cta.url)}</a></p>`
    : ''

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${FOREGROUND};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;padding:32px;">
          <tr><td>
            <p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${BRAND}</p>
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">${escapeHtml(heading)}</h1>
            ${intro ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>` : ''}
            ${htmlCode}
            ${codeHint ? `<p style="margin:0 0 8px;font-size:14px;color:${MUTED};">${escapeHtml(codeHint)}</p>` : ''}
            ${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(p)}</p>`).join('')}
            ${htmlCta}
            ${outro.map((p) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(p)}</p>`).join('')}
            <hr style="border:none;border-top:1px solid ${BORDER};margin:24px 0;" />
            <p style="margin:0;font-size:12px;color:${MUTED};">${escapeHtml(footer ?? 'Property operations, calmly organized.')}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

  return { html, text: textLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() }
}
