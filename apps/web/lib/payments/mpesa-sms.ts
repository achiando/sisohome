/**
 * Safaricom M-Pesa confirmation SMS parser (first PaymentSourceAdapter).
 *
 * Handles the common confirmations a landlord forwards:
 *
 *   SJ12GH78LK Confirmed. Ksh30,000.00 paid to ACME PROPERTIES for account
 *   UNIT-B4 on 31/10/26 at 10:30 AM. New M-PESA balance is Ksh3,400.00. …
 *
 *   SJ99... Confirmed. Ksh1,500.00 received from 254712345678 JOHN KAMAU.
 *   …
 *
 * Multiple messages per paste split on line breaks and on `… Confirmed.`
 * boundaries (forwarded blobs often land on one line). Dates are D/M/Y
 * (Kenyan convention), times AM/PM, interpreted as UTC — the exact hour
 * matters far less than the day for allocation.
 */
import type { ParsedPayment, PaymentSourceAdapter } from './adapter';

const AMOUNT_RE = /Ksh\s*([\d,]+(?:\.\d{1,2})?)/i;
const RECEIPT_RE = /\b([A-Z0-9]{8,12})\s+Confirmed\b/i;
const LEADING_CODE_RE = /^([A-Z0-9]{8,12})\b/;
const ACCOUNT_RE = /account\s+(.+?)(?=\s+(?:on|at|for|new|you|the)\b|[.,]|$)/i;
const PHONE_FROM_RE = /(?:received|paid|sent)?\s*from\s*\(?\s*(\+?[\d][\d\s-]{7,16})\s*\)?/i;
const PHONE_BARE_RE = /\b(?:\+?254|0)(?:7|1)\d{8}\b/;
const DATE_RE = /\bon\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*(?:at\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i;

/** 0712345678 / +254712345678 / 254712345678 → 254712345678 (null when not Kenyan-mobile). */
export function normalizeMsisdn(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('254')) return digits;
  if (digits.length === 10 && digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) {
    return `254${digits}`;
  }
  return null;
}

/** Split a paste into one-message chunks (line breaks + `… Confirmed.` starts). */
function splitMessages(raw: string): string[] {
  const byLine = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (const line of byLine) {
    // A forwarded blob may pack several confirmations on one line. The
    // lookbehind keeps the split AT message boundaries only — without it
    // the lookahead also matches mid-code (SJ12GH78LK → 'SJ' + '12GH…').
    const parts = line.split(
      /(?<![A-Za-z0-9])(?=[A-Z0-9]{8,12}\s+Confirmed\.)/i,
    );
    for (const part of parts) {
      const t = part.trim();
      if (t) chunks.push(t);
    }
  }
  return chunks;
}

function parseOne(chunk: string): ParsedPayment | null {
  const amountMatch = chunk.match(AMOUNT_RE);
  if (!amountMatch?.[1]) return null;
  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const receipt = chunk.match(RECEIPT_RE);
  const leading = chunk.match(LEADING_CODE_RE);
  const externalId = (receipt?.[1] ?? leading?.[1])?.toUpperCase();

  const account = chunk.match(ACCOUNT_RE);
  const reference = account?.[1]?.trim().replace(/[.,;]+$/, '');

  let senderPhone: string | undefined;
  const phoneFrom = chunk.match(PHONE_FROM_RE);
  const phoneRaw = phoneFrom?.[1] ?? chunk.match(PHONE_BARE_RE)?.[0];
  if (phoneRaw) senderPhone = normalizeMsisdn(phoneRaw) ?? undefined;

  let paidAt: string | undefined;
  const date = chunk.match(DATE_RE);
  if (date) {
    const day = Number(date[1]);
    const month = Number(date[2]);
    const yRaw = date[3] ?? '';
    const year = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    const hasTime = date[4] != null && date[5] != null;
    let hour = hasTime ? Number(date[4]) : 0;
    const minute = hasTime ? Number(date[5]) : 0;
    const meridiem = date[6]?.toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      paidAt = new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
    }
  }

  return {
    amount,
    currency: 'KES',
    reference: reference || undefined,
    externalId,
    senderPhone,
    paidAt,
    raw: chunk,
  };
}

export const mpesaSmsAdapter: PaymentSourceAdapter = {
  id: 'mpesa-sms',
  label: 'M-Pesa SMS',
  parse(raw: string): ParsedPayment[] {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    const out: ParsedPayment[] = [];
    for (const chunk of splitMessages(raw)) {
      const parsed = parseOne(chunk);
      if (parsed) out.push(parsed);
    }
    return out;
  },
};
