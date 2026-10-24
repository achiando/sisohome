/**
 * Field-level encryption for sensitive PII columns (plan People §Slice 4).
 *
 * Same AES-256-GCM envelope as lib/two-factor.ts (`v1.<iv>.<tag>.<ct>`, all
 * base64) but a SEPARATE key (FIELD_ENCRYPTION_KEY) so TOTP secrets and PII
 * fields can be rotated independently. Encryption fails closed: no key, no
 * store or read of an encrypted payload.
 *
 * Decrypt is LAZY on legacy plaintext: a value that does not carry the `v1.`
 * envelope is returned unchanged, so pre-encryption rows (e.g. Tenant.idNumber
 * written before this slice) keep working and are sealed on their next write.
 * A value that LOOKS like our envelope but fails authentication throws — we
 * never silently treat a corrupted ciphertext as plaintext.
 *
 * At rest the ciphertext lives in the SAME column as the plaintext did; the
 * Prisma schema is unchanged. Callers encrypt on the write path (domain
 * parse/create/update) and decrypt on the read path (get/detail shapes) —
 * list endpoints that do not expose the field need no change.
 */

import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const ENC_PREFIX = 'v1';

function encryptionKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY is not set — refusing to encrypt or decrypt a PII field without it.'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes, base64-encoded.');
  }
  return key;
}

/** True when the stored value carries our encryption envelope. */
export function isEncrypted(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 4 && parts[0] === ENC_PREFIX && !!parts[1] && !!parts[2] && !!parts[3];
}

/** AES-256-GCM → `v1.<iv>.<tag>.<ciphertext>` (all base64). */
export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENC_PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

/** Decrypt an encrypted payload; legacy plaintext passes through unchanged. */
export function decryptField(payload: string): string {
  if (!isEncrypted(payload)) return payload; // lazy migration for pre-slice rows
  const [version, ivB64, tagB64, ctB64] = payload.split('.');
  if (version !== ENC_PREFIX) {
    throw new Error('Unrecognised field-encryption format.');
  }
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivB64!, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64!, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64!, 'base64')), decipher.final()]).toString('utf8');
}

/**
 * Write-path helper: encrypt a submitted string; `undefined` (field not in
 * the payload) and `null`/`''` (clear the column) pass through so partial
 * updates keep their usual semantics. Already-encrypted values are left
 * alone (idempotent PATCH of an unchanged field).
 */
export function encryptFieldInput(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value as never;
  if (value === '') return null;
  if (isEncrypted(value)) return value;
  return encryptField(value);
}

/** Read-path helper: decrypt or pass through; null/undefined stay null. */
export function decryptFieldOutput(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return decryptField(value);
}
