/**
 * Smoke helper: print a live TOTP for a base32 secret (or a random 6-digit
 * code when called with no argument — used as a guaranteed-mismatch token).
 */
import { generate } from 'otplib';

const secret = process.argv[2];
if (secret) {
  const token = await generate({ secret });
  console.log(token);
} else {
  console.log(String(Math.floor(100000 + Math.random() * 900000)));
}
