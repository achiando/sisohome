/**
 * Shared document shell for printable financial docs (invoices, receipts).
 * Stateless HTML — rendered on demand inside a sandboxed iframe dialog,
 * print-styled via the embedded stylesheet. Nothing is stored.
 */

export function esc(v: string | null | undefined): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function money(currency: string, amount: string | number): string {
  const n = typeof amount === 'number' ? amount : Number(amount || 0);
  const formatted = Number.isFinite(n)
    ? n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(amount);
  return `${esc(currency)} ${formatted}`;
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const DOC_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #0f172a; background: #f8fafc; margin: 0; padding: 32px; line-height: 1.5; }
  .doc { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0;
    border-radius: 16px; padding: 40px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
    border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px; }
  h1 { font-size: 26px; letter-spacing: 0.08em; margin: 0; text-transform: uppercase; }
  .org { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
  .muted { color: #64748b; font-size: 13px; margin: 0; }
  .meta { text-align: right; font-size: 13px; }
  .meta .num { font-weight: 700; font-size: 15px; color: #0f172a; }
  .parties { display: flex; gap: 32px; margin-bottom: 24px; font-size: 14px; }
  .parties h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
    color: #64748b; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 8px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
    color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 8px 10px; }
  td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .meta-table { width: 100%; margin-bottom: 12px; font-size: 13px; }
  .meta-table td { padding: 5px 10px; color: #64748b; border-bottom: none; }
  .totals { margin-left: auto; width: 280px; font-size: 14px; }
  .totals tr td { border: none; padding: 5px 10px; }
  .totals .grand td { border-top: 2px solid #0f172a; font-weight: 700; font-size: 16px; padding-top: 10px; }
  .chip { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
    padding: 3px 10px; border-radius: 999px; text-transform: uppercase; }
  .chip.paid { background: #dcfce7; color: #166534; }
  .chip.due { background: #fef3c7; color: #92400e; }
  .chip.overdue { background: #fee2e2; color: #991b1b; }
  .foot { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0;
    font-size: 12px; color: #64748b; display: flex; justify-content: space-between; gap: 16px; }
  @media print { body { background: #fff; padding: 0; } .doc { border: none; border-radius: 0; padding: 8px; } }
`;

export function htmlDoc(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${DOC_STYLES}</style></head><body><div class="doc">${body}</div></body></html>`;
}
