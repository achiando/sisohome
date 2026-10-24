/**
 * Client-safe agreement-template metadata (People plan Slice 6).
 * Type-only imports — safe in browser bundles (see document-constants.ts).
 * Rendering lives server-side in `agreement-templates.ts`.
 */

export type AgreementTemplateCategory = 'TENANT' | 'MANAGER' | 'MAINTAINER';

export interface AgreementTemplateMeta {
  id: string;
  category: AgreementTemplateCategory;
  label: string;
  description: string;
}

/** The six built-in templates — two per category. */
export const AGREEMENT_TEMPLATES: AgreementTemplateMeta[] = [
  {
    id: 'tenant-residential',
    category: 'TENANT',
    label: 'Standard residential tenancy',
    description: 'Fixed-term residential lease: rent, deposit, notice and house rules.',
  },
  {
    id: 'tenant-licence',
    category: 'TENANT',
    label: 'Short-term licence',
    description: 'Casual occupation — kiosk, ATM bay or short-stay unit (licence, not lease).',
  },
  {
    id: 'manager-full-service',
    category: 'MANAGER',
    label: 'Full-service management',
    description: 'Leasing, rent collection, maintenance and reporting, end to end.',
  },
  {
    id: 'manager-letting-only',
    category: 'MANAGER',
    label: 'Letting-only management',
    description: 'Tenant placement and rent collection — the owner runs day-to-day operations.',
  },
  {
    id: 'maintainer-retainer',
    category: 'MAINTAINER',
    label: 'Maintenance retainer',
    description: 'Ongoing preventive maintenance visits for a fixed term.',
  },
  {
    id: 'maintainer-adhoc',
    category: 'MAINTAINER',
    label: 'Ad-hoc work contract',
    description: 'Reactive repairs and call-off works over a contract window.',
  },
];

export const AGREEMENT_TEMPLATE_IDS = AGREEMENT_TEMPLATES.map((t) => t.id);

export function templatesForCategory(category: AgreementTemplateCategory): AgreementTemplateMeta[] {
  return AGREEMENT_TEMPLATES.filter((t) => t.category === category);
}

export function templateMeta(id: string): AgreementTemplateMeta | undefined {
  return AGREEMENT_TEMPLATES.find((t) => t.id === id);
}

/** Shape returned by the `/agreement-preview` routes (lease + management).
 *  A type alias (not interface) so `ok()`'s implicit index signature works. */
export type AgreementPreviewResponse = {
  templates: AgreementTemplateMeta[];
  templateId: string;
  html: string;
  signerLabel: string;
};
