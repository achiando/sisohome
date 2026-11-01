/**
 * Payment-source abstraction (roadmap Phase 1, locked decision #4).
 *
 * Every ingestion path — pasted M-Pesa SMS today, a Daraja webhook or a
 * bank CSV tomorrow — implements `PaymentSourceAdapter` and registers in
 * `PAYMENT_SOURCES`. The match → preview → commit pipeline downstream is
 * source-agnostic: it only ever sees `ParsedPayment[]`.
 */

export interface ParsedPayment {
  amount: number;
  currency: string;
  /** Account/for-field text as typed by the sender (unitRef / lease ref). */
  reference?: string;
  /** M-Pesa receipt code — the per-org-unique dedupe key (`Payment.externalId`). */
  externalId?: string;
  senderPhone?: string;
  /** ISO 8601 when the message carries a date. */
  paidAt?: string;
  raw: string;
}

export interface PaymentSourceAdapter {
  id: string;
  label: string;
  /** Split a pasted blob into parsed payments; unparseable chunks are dropped. */
  parse(raw: string): ParsedPayment[];
}

import { mpesaSmsAdapter } from './mpesa-sms';

export const PAYMENT_SOURCES: PaymentSourceAdapter[] = [mpesaSmsAdapter];

export function getPaymentSourceAdapter(id: string): PaymentSourceAdapter {
  const found = PAYMENT_SOURCES.find((a) => a.id === id);
  if (!found) {
    throw new Error(
      `Unknown payment source '${id}' (available: ${PAYMENT_SOURCES.map((a) => a.id).join(', ')})`,
    );
  }
  return found;
}
