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

export interface RenderEmailDetail {
  label: string
  value: string
  /** Render the value in the monospace face (keys, codes, URLs). */
  mono?: boolean
}

export interface RenderEmailOptions {
  heading: string
  intro?: string
  /** One-time code shown as a large monospace block. */
  code?: string
  codeHint?: string
  paragraphs?: string[]
  /** Label/value rows — device, location, temporary password, etc. */
  details?: RenderEmailDetail[]
  /** Highlighted callout box (expiry warning, security note). */
  note?: string
  cta?: { label: string; url: string }
  outro?: string[]
  footer?: string
}

const BRAND = 'SisoHome'
const BRAND_LINE = 'Property operations, calmly organized.'

// Palette — light values inline (Outlook desktop ignores media queries),
// dark values applied through prefers-color-scheme where the client honors it.
const PAGE_BG = '#f1f5f9'
const CARD_BG = '#ffffff'
const FOREGROUND = '#0f172a'
const MUTED = '#64748b'
const BORDER = '#e2e8f0'
const ACCENT = '#0f172a'
const WHITE = '#ffffff'

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO_STACK =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace"

/**
 * One layout used by every template so every inbox gets the same message:
 *
 * - table layout with `bgcolor` + inline styles everywhere (Gmail, Outlook
 *   desktop, Yahoo strip classes but keep both);
 * - a `<style>` block only for what inline can't do — the <620px breakpoint
 *   and dark mode (honored by Gmail/Apple Mail, ignored harmlessly elsewhere);
 * - no external assets, no SVG, no background images, bulletproof button;
 * - hidden preheader preview text and a plain-text alternative part.
 *
 * Returns the HTML body plus the plain-text alternative.
 */
export function renderEmail(options: RenderEmailOptions): RenderedEmail {
  const {
    heading,
    intro,
    code,
    codeHint,
    paragraphs = [],
    details = [],
    note,
    cta,
    outro = [],
    footer,
  } = options

  const preheader = [intro ?? heading, codeHint].filter(Boolean).join(' · ')
  const footerText = footer ?? BRAND_LINE

  /* ── Plain-text alternative ─────────────────────────────────────────── */
  const textLines: string[] = [BRAND, '', heading, '']
  if (intro) textLines.push(intro, '')
  if (code) textLines.push(code, '')
  if (codeHint) textLines.push(codeHint, '')
  for (const p of paragraphs) textLines.push(p, '')
  for (const d of details) textLines.push(`${d.label}: ${d.value}`, '')
  if (note) textLines.push(`> ${note}`, '')
  if (cta) textLines.push(`${cta.label}: ${cta.url}`, '')
  for (const p of outro) textLines.push(p, '')
  textLines.push('—', footerText)

  /* ── Pieces ─────────────────────────────────────────────────────────── */
  const htmlCode = code
    ? `<table role="presentation" class="code-table" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:20px 0 4px 0;mso-table-lspace:0;mso-table-rspace:0;">
        <tr>
          <td class="code" align="center" bgcolor="${FOREGROUND}" style="background:${FOREGROUND};border-radius:12px;padding:18px 24px;font-family:${MONO_STACK};font-size:30px;line-height:1.2;letter-spacing:8px;color:${WHITE};font-weight:700;mso-line-height-rule:exactly;">${escapeHtml(code)}</td>
        </tr>
      </table>`
    : ''

  const htmlDetails = details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:20px 0 4px 0;border-collapse:separate;mso-table-lspace:0;mso-table-rspace:0;">${details
        .map(
          (d) => `<tr>
            <td class="detail-label" valign="top" width="150" style="width:150px;padding:8px 16px 8px 0;font-size:12px;line-height:1.5;letter-spacing:0.6px;text-transform:uppercase;color:${MUTED};font-weight:600;">${escapeHtml(d.label)}</td>
            <td class="detail-value" valign="top" style="padding:8px 0;font-size:15px;line-height:1.5;color:${FOREGROUND};word-break:break-word;${d.mono ? `font-family:${MONO_STACK};font-size:14px;` : ''}">${escapeHtml(d.value)}</td>
          </tr>`,
        )
        .join('')}
      </table>`
    : ''

  const htmlNote = note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:20px 0 4px 0;mso-table-lspace:0;mso-table-rspace:0;">
        <tr>
          <td class="soft note" bgcolor="#eef2f7" style="background:#eef2f7;border-left:4px solid ${FOREGROUND};border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(note)}</td>
        </tr>
      </table>`
    : ''

  // Bulletproof button: the anchor carries its own background and padding so
  // it hugs the label; the td's bgcolor is only a fallback backdrop for
  // clients that flatten inline styles. No align attribute here — it maps to
  // float:left and swallows the fallback-link paragraph beside it. The table
  // stays content-width on desktop and stretches full-width on mobile.
  const htmlCta = cta
    ? `<table role="presentation" class="btn-table" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 6px 0;text-align:left;mso-table-lspace:0;mso-table-rspace:0;">
        <tr>
          <td bgcolor="${ACCENT}" style="background:${ACCENT};border-radius:12px;mso-line-height-rule:exactly;">
            <a class="btn" href="${escapeHtml(cta.url)}" style="display:inline-block;background:${ACCENT};padding:14px 26px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:${WHITE};text-decoration:none;border-radius:12px;mso-line-height-rule:exactly;">${escapeHtml(cta.label)}</a>
          </td>
        </tr>
      </table>
      <p style="margin:10px 0 4px 0;font-size:12px;line-height:1.6;color:${MUTED};word-break:break-all;">Or paste this link into your browser:<br /><a href="${escapeHtml(cta.url)}" style="color:${MUTED};text-decoration:underline;word-break:break-all;">${escapeHtml(cta.url)}</a></p>`
    : ''

  const divider = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0 16px 0;mso-table-lspace:0;mso-table-rspace:0;"><tr><td style="border-top:1px solid ${BORDER};font-size:0;line-height:0;">&nbsp;</td></tr></table>`

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
    <title>${escapeHtml(heading)}</title>
    <style type="text/css">
      /* Only what inline styles cannot express: the mobile breakpoint and
         dark mode. Stripped clients simply keep the inline (light) styles. */
      @media only screen and (max-width:620px) {
        .wrap { width:100% !important; }
        .outer { padding:16px 8px !important; }
        .card { padding:24px 18px !important; }
        .h1 { font-size:22px !important; }
        .code { font-size:26px !important; letter-spacing:6px !important; padding:14px 14px !important; }
        .btn-table { display:table !important; width:100% !important; }
        .btn-table td { width:100% !important; box-sizing:border-box !important; text-align:center !important; }
        .btn { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
        .detail-label { display:block !important; width:auto !important; padding:8px 0 0 0 !important; }
        .detail-value { display:block !important; padding:2px 0 8px 0 !important; }
      }
      @media (prefers-color-scheme: dark) {
        .page { background:#0b1220 !important; }
        .card { background:#111827 !important; border-color:#1f2937 !important; }
        .txt { color:#e5e7eb !important; }
        .h1 { color:#f8fafc !important; }
        .mut { color:#94a3b8 !important; }
        .soft { background:#0f172a !important; }
        .note { color:#94a3b8 !important; }
      }
      a[x-apple-data-detectors], .x-apple-data-detectors, .x-gmail-data-detectors {
        color:inherit !important; text-decoration:none !important; font-size:inherit !important; font-family:inherit !important; font-weight:inherit !important; line-height:inherit !important;
      }
    </style>
  </head>
  <body class="page" style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT_STACK};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    <div style="display:none;mso-hide:all;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}${'&zwnj;&nbsp;'.repeat(30)}</div>
    <table role="presentation" class="outer" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="width:100%;background:${PAGE_BG};padding:32px 16px;mso-table-lspace:0;mso-table-rspace:0;">
      <tr>
        <td align="center">
          <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;mso-table-lspace:0;mso-table-rspace:0;">
            <tr>
              <td class="card" bgcolor="${CARD_BG}" style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;padding:32px;">
                <p class="mut" style="margin:0 0 20px 0;font-size:13px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED};">${BRAND}</p>
                <h1 class="h1" style="margin:0 0 16px 0;font-size:24px;line-height:1.3;color:${FOREGROUND};font-weight:700;">${escapeHtml(heading)}</h1>
                ${intro ? `<p class="txt" style="margin:0 0 4px 0;font-size:15px;line-height:1.65;color:${FOREGROUND};">${escapeHtml(intro)}</p>` : ''}
                ${htmlCode}
                ${codeHint ? `<p class="mut" style="margin:8px 0 4px 0;font-size:13px;line-height:1.6;color:${MUTED};text-align:center;">${escapeHtml(codeHint)}</p>` : ''}
                ${paragraphs.map((p) => `<p class="txt" style="margin:12px 0 0 0;font-size:15px;line-height:1.65;color:${FOREGROUND};">${escapeHtml(p)}</p>`).join('')}
                ${htmlDetails}
                ${htmlNote}
                ${htmlCta}
                ${outro.map((p) => `<p class="mut note" style="margin:12px 0 0 0;font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(p)}</p>`).join('')}
                ${divider}
                <p class="mut" style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">${escapeHtml(footerText)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { html, text: textLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() }
}
