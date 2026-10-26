/**
 * CSV helpers for register exports (Slice 9 gap pass).
 * RFC-4180-ish quoting: fields with commas/quotes/newlines are quoted and
 * inner quotes doubled. A UTF-8 BOM is prepended so Excel opens Kenyan
 * currency symbols correctly.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

function escapeField(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return escapeField(String(value));
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => escapeField(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(','));
  return [header, ...body].join('\r\n');
}

/** Browser download — client-side only, rows are already authorized. */
export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
  const csv = '\ufeff' + toCsv(columns, rows) + '\r\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe.replace(/\.csv$/i, '')}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
