/**
 * Agreement templates (People plan Slice 6) — server-side rendering for the
 * type-name e-sign preview and the signed record's fingerprint.
 *
 * - Templates are static markup; EVERY interpolated value is HTML-escaped.
 * - Rendering is pure — contexts are gathered by `agreement-sign.ts`.
 * - The signed HTML is fingerprinted (sha256) and the hash + typed name land
 *   in the audit trail. The text itself is NOT stored (evidence-only
 *   decision, STATUS §5): the PropertyDocument row is the durable pointer.
 */

import { createHash } from 'node:crypto';
import { RouteError } from '@/lib/api-route';
import { templateMeta } from './agreement-constants';

// ── helpers ──────────────────────────────────────────────────────────────────

function esc(v: string | null | undefined): string {
  if (v === null || v === undefined) return '';
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const FREQ_LABEL: Record<string, string> = {
  MONTHLY: 'monthly',
  WEEKLY: 'weekly',
  BIWEEKLY: 'fortnightly',
  QUARTERLY: 'quarterly',
  ANNUAL: 'annually',
  YEARLY: 'annually',
};

function freqLabel(frequency: string): string {
  return FREQ_LABEL[frequency] ?? frequency.toLowerCase();
}

function fmtMoney(amount: string | null, currency: string): string {
  if (!amount) return 'As recorded in the billing schedule';
  const n = Number(amount);
  const body = Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : amount;
  return `${currency} ${body}`;
}

function bulletList(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

// ── contexts ─────────────────────────────────────────────────────────────────

export interface LeaseTemplateContext {
  /** leaseRef or id slice — shown as the document reference. */
  reference: string;
  tenureType: 'LEASE' | 'LICENSE';
  property: { name: string; address: string; locality: string };
  units: string[];
  /** Per-unit monthly rent from the lease's LeaseUnit rows. */
  unitRents: { label: string; rent: string }[];
  tenants: string[];
  /** Landlord / managing agent — the lease's owning organization. */
  ownerName: string;
  startsAt: Date;
  endsAt: Date | null;
  currency: string;
  billingFrequency: string;
  depositMonths: string | null;
  noticeDays: number | null;
  autoRenew: boolean;
  terms: string | null;
}

export interface ManagementTemplateContext {
  /** Property code or agreement id slice. */
  reference: string;
  property: { name: string; address: string; locality: string };
  ownerName: string;
  managerName: string;
  startsAt: Date;
  endsAt: Date | null;
  scopeNotes: string | null;
}

export interface SignatureBlock {
  /** The acting user's account label — typed back to confirm the signature. */
  signerLabel: string;
  /** null → preview placeholder ("Signature pending"). */
  signedAt: Date | null;
}

// ── layout ───────────────────────────────────────────────────────────────────

const STYLE = `
body { font-family: Georgia, 'Times New Roman', serif; color: #141414; max-width: 720px;
  margin: 24px auto; padding: 0 20px; line-height: 1.55; font-size: 15px; }
h1 { font-size: 22px; margin: 0 0 4px; }
.meta { color: #666; font-size: 12px; margin-bottom: 20px; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; margin: 22px 0 6px;
  border-bottom: 1px solid #ddd; padding-bottom: 4px; }
ul { margin: 6px 0 6px 20px; padding: 0; }
li { margin: 3px 0; }
dl { display: grid; grid-template-columns: 170px 1fr; gap: 4px 12px; margin: 0; }
dt { font-weight: bold; }
dd { margin: 0; }
p { margin: 6px 0; }
.schedule { border-left: 3px solid #ccc; padding: 6px 12px; background: #f8f8f8; white-space: pre-wrap; }
.sig { border: 1px solid #ccc; padding: 12px; background: #fafafa; margin-top: 10px; }
.pending { color: #888; font-style: italic; }
`.trim();

function page(title: string, reference: string, bodyHtml: string, sig: SignatureBlock): string {
  const signature = sig.signedAt
    ? `<strong>${esc(sig.signerLabel)}</strong><br />Signed on ${fmtIso(sig.signedAt)}`
    : `<strong>${esc(sig.signerLabel)}</strong><br /><span class="pending">Signature pending — preview only</span>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<article>
<h1>${esc(title)}</h1>
<p class="meta">Reference: ${esc(reference)} · Generated ${fmtIso(new Date())} · Executed electronically by typed name</p>
${bodyHtml}
<section>
<h2>Execution</h2>
<p>This agreement is executed electronically: the signatory types their full name to sign, and the
signature, timestamp and document fingerprint are recorded in the audit trail.</p>
<div class="sig">${signature}</div>
</section>
</article>
</body>
</html>`;
}

function parties(rows: [string, string][]): string {
  return `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}

function premiseRows(ctx: { property: { name: string; address: string; locality: string } }): [string, string][] {
  return [
    ['Property', ctx.property.name],
    ['Address', [ctx.property.address, ctx.property.locality].filter(Boolean).join(', ')],
  ];
}

function premises(ctx: { property: { name: string; address: string; locality: string } }): string {
  return parties(premiseRows(ctx));
}

function termRow(startsAt: Date, endsAt: Date | null, note?: string): [string, string] {
  const term = endsAt ? `${fmtIso(startsAt)} to ${fmtIso(endsAt)}` : `${fmtIso(startsAt)} onwards (no fixed end date)`;
  return ['Term', note ? `${term} — ${note}` : term];
}

function scopeBlock(scopeNotes: string | null): string {
  const body = scopeNotes?.trim()
    ? esc(scopeNotes.trim())
    : '<span class="pending">Fees and special conditions as agreed between the parties.</span>';
  return `<div class="schedule">${body}</div>`;
}

// ── lease templates ──────────────────────────────────────────────────────────

function leaseDefaults(ctx: LeaseTemplateContext): { tenantNames: string; unitLine: string } {
  return {
    tenantNames: ctx.tenants.length ? ctx.tenants.join(', ') : 'To be recorded',
    unitLine: ctx.units.length ? ctx.units.join(', ') : 'All units covered by this lease',
  };
}

function tenantResidential(ctx: LeaseTemplateContext): string {
  const d = leaseDefaults(ctx);
  const freq = freqLabel(ctx.billingFrequency);
  const rentRows: [string, string][] =
    ctx.unitRents.length === 1
      ? [['Rent', `${fmtMoney(ctx.unitRents[0]!.rent, ctx.currency)} payable ${freq}`]]
      : [
          ...ctx.unitRents.map((u): [string, string] => [`Rent — ${u.label}`, fmtMoney(u.rent, ctx.currency)]),
          ['Billing', `payable ${freq}`],
        ];
  const deposit = ctx.depositMonths ? `${ctx.depositMonths} month(s) of rent` : 'As agreed';
  const notice = ctx.noticeDays ? `${ctx.noticeDays} days' written notice` : 'Notice as required by law';
  const renewal = ctx.autoRenew
    ? 'Renews automatically for successive terms unless either party gives notice.'
    : 'Ends on the end date unless renewed in writing.';
  const ruleBullets = [
    'The tenant pays rent on time and keeps the premises clean and in good order.',
    'Utilities and service charges billed for the premises are paid by the tenant.',
    'The tenant may not sublet or assign the premises without written consent.',
    'The landlord maintains the structure, common areas and installations in reasonable repair.',
    'The tenant enjoys quiet enjoyment of the premises subject to these terms.',
  ];
  const terms = ctx.terms?.trim()
    ? `<section><h2>Special terms</h2><div class="schedule">${esc(ctx.terms.trim())}</div></section>`
    : '';
  return `
<section>
<h2>Parties</h2>
${parties([
  ['Tenant(s)', d.tenantNames],
  ['Landlord / agent', ctx.ownerName],
])}
</section>
<section>
<h2>Premises</h2>
${parties([
  ...premiseRows(ctx),
  ['Unit(s)', d.unitLine],
])}
</section>
<section>
<h2>Term</h2>
${parties([termRow(ctx.startsAt, ctx.endsAt), ['Renewal', renewal]])}
</section>
<section>
<h2>Rent &amp; deposit</h2>
${parties([
  ...rentRows,
  ['Deposit', deposit],
  ['Notice', notice],
])}
</section>
<section>
<h2>Obligations</h2>
${bulletList(ruleBullets)}
</section>
${terms}`;
}

function tenantLicence(ctx: LeaseTemplateContext): string {
  const d = leaseDefaults(ctx);
  const total = ctx.unitRents.reduce((sum, u) => sum + (Number(u.rent) || 0), 0);
  const feeLine = `${fmtMoney(String(total), ctx.currency)} ${freqLabel(ctx.billingFrequency)} licence fee`;
  const notice = ctx.noticeDays ? `${ctx.noticeDays} days' written notice to withdraw the licence` : 'Licence withdrawable on reasonable notice';
  return `
<section>
<h2>Parties</h2>
${parties([
  ['Licensor', ctx.ownerName],
  ['Licensee', d.tenantNames],
])}
</section>
<section>
<h2>Premises &amp; permitted use</h2>
${parties([
  ['Property', ctx.property.name],
  ['Address', [ctx.property.address, ctx.property.locality].filter(Boolean).join(', ')],
  ['Area', d.unitLine],
  ['Permitted use', 'Short-term casual occupation (kiosk, bay or short stay) only'],
])}
</section>
<section>
<h2>Licence period &amp; fee</h2>
${parties([
  termRow(ctx.startsAt, ctx.endsAt, 'licence, not a tenancy'),
  ['Fee', feeLine],
  ['Withdrawal', notice],
])}
</section>
<section>
<h2>Conditions</h2>
${bulletList([
  'This licence confers no security of tenure and creates no tenancy or lease.',
  'The licence is personal to the licensee and revocable on the notice stated above.',
  'The licensee complies with the property rules and lawful use of shared areas.',
  'The licensee leaves the area free of goods on expiry or withdrawal of the licence.',
])}
</section>`;
}

// ── management / maintenance templates ───────────────────────────────────────

function managerParties(ctx: ManagementTemplateContext): string {
  return parties([
    ['Owner', ctx.ownerName],
    ['Managing agent', ctx.managerName],
  ]);
}

function maintainerParties(ctx: ManagementTemplateContext): string {
  return parties([
    ['Client', ctx.ownerName],
    ['Contractor', ctx.managerName],
  ]);
}

function managerFullService(ctx: ManagementTemplateContext): string {
  return `
<section>
<h2>Parties</h2>
${managerParties(ctx)}
</section>
<section>
<h2>Property</h2>
${premises(ctx)}
</section>
<section>
<h2>Term</h2>
${parties([termRow(ctx.startsAt, ctx.endsAt)])}
</section>
<section>
<h2>Scope of services</h2>
${bulletList([
  'Market and let vacancies, viewings, referencing and tenant placement.',
  'Collect rent and service charges, issue statements and pursue arrears.',
  'Coordinate repairs, maintenance and contractor access up to agreed limits.',
  'Keep owner records: tenancies, charges, payments and periodic reporting.',
  'Handle tenancy renewals, notices and end-of-tenancy matters.',
])}
</section>
<section>
<h2>Fees &amp; schedule</h2>
${scopeBlock(ctx.scopeNotes)}
</section>
<section>
<h2>Responsibilities</h2>
${bulletList([
  'The agent acts as the owner’s appointed manager for the agreed scope.',
  'The owner remains responsible for insurance, major works and structural decisions.',
  'Neither party may vary the scope or fees except in writing.',
])}
</section>`;
}

function managerLettingOnly(ctx: ManagementTemplateContext): string {
  return `
<section>
<h2>Parties</h2>
${managerParties(ctx)}
</section>
<section>
<h2>Property</h2>
${premises(ctx)}
</section>
<section>
<h2>Term</h2>
${parties([termRow(ctx.startsAt, ctx.endsAt)])}
</section>
<section>
<h2>Scope of services</h2>
${bulletList([
  'Market and let vacancies: advertising, viewings and referencing.',
  'Place tenants and prepare the tenancy paperwork for the owner’s approval.',
  'Collect rent and remit it to the owner, with statements of account.',
  'Do NOT manage day-to-day operations — those remain with the owner.',
])}
</section>
<section>
<h2>Fees &amp; schedule</h2>
${scopeBlock(ctx.scopeNotes)}
</section>
<section>
<h2>Responsibilities</h2>
${bulletList([
  'The owner retains maintenance, insurance, approvals and property inspections.',
  'The agent accounts for rent collected and returns keys/records on termination.',
  'Either party may end this agreement in writing, subject to the stated notice.',
])}
</section>`;
}

function maintainerRetainer(ctx: ManagementTemplateContext): string {
  return `
<section>
<h2>Parties</h2>
${maintainerParties(ctx)}
</section>
<section>
<h2>Property</h2>
${premises(ctx)}
</section>
<section>
<h2>Term</h2>
${parties([termRow(ctx.startsAt, ctx.endsAt, 'retainer period')])}
</section>
<section>
<h2>Services</h2>
${bulletList([
  'Scheduled preventive maintenance visits at the agreed frequency.',
  'Priority response for breakdowns reported through the agreed channel.',
  'Routine servicing of installations, common areas and grounds.',
  'Work records and visit reports retained for the client.',
  'Parts and materials beyond the retainer quoted before installation.',
])}
</section>
<section>
<h2>Rates &amp; call-out</h2>
${scopeBlock(ctx.scopeNotes)}
</section>
<section>
<h2>Conditions</h2>
${bulletList([
  'Contractor carries reasonable insurance and observes safety requirements on site.',
  'Client grants access for agreed visits and notified emergency works.',
  'Neither party assumes the other’s statutory duties.',
])}
</section>`;
}

function maintainerAdhoc(ctx: ManagementTemplateContext): string {
  return `
<section>
<h2>Parties</h2>
${maintainerParties(ctx)}
</section>
<section>
<h2>Property</h2>
${premises(ctx)}
</section>
<section>
<h2>Contract window</h2>
${parties([termRow(ctx.startsAt, ctx.endsAt, 'call-off window')])}
</section>
<section>
<h2>Call-off works</h2>
${bulletList([
  'The client requests works by work order; each accepted order is executed under this contract.',
  'The contractor acknowledges each order within one business day and schedules the works.',
  'Rates for call-offs, materials and out-of-hours attendance follow the schedule below.',
  'Completed works are signed off on the work order and invoiced against it.',
])}
</section>
<section>
<h2>Rates &amp; schedule</h2>
${scopeBlock(ctx.scopeNotes)}
</section>
<section>
<h2>Conditions</h2>
${bulletList([
  'Contractor maintains insurance and complies with site safety rules.',
  'Defects in completed works are remedied at no charge within 30 days of sign-off.',
])}
</section>`;
}

// ── entry points ─────────────────────────────────────────────────────────────

const LEASE_RENDERERS: Record<string, (ctx: LeaseTemplateContext) => string> = {
  'tenant-residential': tenantResidential,
  'tenant-licence': tenantLicence,
};

const MANAGEMENT_RENDERERS: Record<string, (ctx: ManagementTemplateContext) => string> = {
  'manager-full-service': managerFullService,
  'manager-letting-only': managerLettingOnly,
  'maintainer-retainer': maintainerRetainer,
  'maintainer-adhoc': maintainerAdhoc,
};

function requireLeaseRenderer(templateId: string): (ctx: LeaseTemplateContext) => string {
  const meta = templateMeta(templateId);
  const render = LEASE_RENDERERS[templateId];
  if (!meta || meta.category !== 'TENANT' || !render) {
    throw new RouteError(400, `Unknown or wrong-category template: ${templateId}`);
  }
  return render;
}

function requireManagementRenderer(templateId: string): (ctx: ManagementTemplateContext) => string {
  const meta = templateMeta(templateId);
  const render = MANAGEMENT_RENDERERS[templateId];
  if (!meta || (meta.category !== 'MANAGER' && meta.category !== 'MAINTAINER') || !render) {
    throw new RouteError(400, `Unknown or wrong-category template: ${templateId}`);
  }
  return render;
}

export function renderLeaseTemplate(
  templateId: string,
  ctx: LeaseTemplateContext,
  sig: SignatureBlock,
): string {
  const render = requireLeaseRenderer(templateId);
  const meta = templateMeta(templateId)!;
  return page(meta.label, ctx.reference, render(ctx), sig);
}

export function renderManagementTemplate(
  templateId: string,
  ctx: ManagementTemplateContext,
  sig: SignatureBlock,
): string {
  const render = requireManagementRenderer(templateId);
  const meta = templateMeta(templateId)!;
  return page(meta.label, ctx.reference, render(ctx), sig);
}

/** Fingerprint of the signed HTML — recorded in the audit trail as evidence. */
export function sha256Hex(html: string): string {
  return createHash('sha256').update(html, 'utf8').digest('hex');
}
