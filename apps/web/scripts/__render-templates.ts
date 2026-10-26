/**
 * Untracked smoke helper — renders every email template to HTML so the
 * output can be opened at phone and desktop widths and checked visually.
 *
 *   ../../packages/database/node_modules/.bin/tsx scripts/__render-templates.ts
 */

import { writeFileSync } from 'node:fs'

import { loginAlertEmail } from '../lib/email/login-alert'
import { memberAddedEmail } from '../lib/email/member-added'
import { passwordResetEmail } from '../lib/email/password-reset'
import { portalInviteEmail } from '../lib/email/portal-invite'
import { twoFactorCodeEmail } from '../lib/email/two-factor-code'
import { verifyEmailTemplate } from '../lib/email/verify-email'

const out = '/tmp/opencode'

const messages = {
  'email-verify': verifyEmailTemplate({
    to: 'ada@example.test',
    verifyUrl: 'http://localhost:3000/verify-email?token=VyBJ4cquyaMyO0N5thM49Ao_PtQ2l3dkghSRKXwdAq',
    expiresInHours: 24,
    recipientName: 'Ada Lovelace',
  }),
  'email-login-alert': loginAlertEmail({
    to: 'ada@example.test',
    recipientName: 'Ada Lovelace',
    device: 'Chrome on macOS (Desktop)',
    location: 'Lisbon, Portugal',
    ip: '203.0.113.42',
    time: '17 Oct 2026, 18:05 UTC',
    settingsUrl: 'http://localhost:3000/settings',
  }),
  'email-member-added': memberAddedEmail({
    to: 'grace@example.test',
    recipientName: 'Grace Hopper',
    inviterName: 'Ada Lovelace',
    organizationName: 'Seaside Property Group',
    tempPassword: 'Kf9mQ2xR7pLs',
    signInUrl: 'http://localhost:3000/login',
  }),
  'email-password-reset': passwordResetEmail({
    to: 'ada@example.test',
    resetUrl: 'http://localhost:3000/reset-password?token=VyBJ4cquyaMyO0N5thM49Ao_PtQ2l3dkghSRKXwdAq',
    expiresInMinutes: 30,
    recipientName: 'Ada Lovelace',
  }),
  'email-two-factor': twoFactorCodeEmail({
    to: 'ada@example.test',
    code: '481920',
    expiresInMinutes: 10,
    purpose: 'sign-in',
  }),
  'email-portal-invite': portalInviteEmail({
    to: 'ada@example.test',
    acceptUrl: 'http://localhost:3000/portal/accept?token=VyBJ4cquyaMyO0N5thM49Ao_PtQ2l3dkghSRKXwdAq',
    tenantName: 'Ada Lovelace',
    organizationName: 'Seaside Property Group',
    expiresInDays: 7,
  }),
}

for (const [name, message] of Object.entries(messages)) {
  writeFileSync(`${out}/${name}.html`, message.html, 'utf8')
  writeFileSync(`${out}/${name}.txt`, message.text ?? '', 'utf8')
  console.log('wrote', `${out}/${name}.html`)
}
