/** Tenant domain constants (plan-slice-2 §2.1). */

import type { SelectOption } from '@workspace/ui/types/components';

export const TENANT_STATUSES: SelectOption[] = [
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'APPLICANT', label: 'Applicant' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAST', label: 'Past' },
];

export const TENANT_STATUS_VALUES = ['PROSPECT', 'APPLICANT', 'ACTIVE', 'PAST'] as const;

export const TENANT_PORTAL_STATUSES: SelectOption[] = [
  { value: 'NOT_INVITED', label: 'Not invited' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'ACTIVE', label: 'Portal active' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

export const TENANT_PORTAL_STATUS_VALUES = ['NOT_INVITED', 'INVITED', 'ACTIVE', 'SUSPENDED'] as const;

export const TENANT_PARTY_TYPES: SelectOption[] = [
  { value: 'PERSON', label: 'Person' },
  { value: 'COMPANY', label: 'Company' },
];

export const TENANT_PARTY_TYPE_VALUES = ['PERSON', 'COMPANY'] as const;

export const TENANT_ID_TYPES: SelectOption[] = [
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'ALIEN_ID', label: 'Alien ID' },
  { value: 'REG_NO', label: 'Registration no.' },
];

export const TENANT_ID_TYPE_VALUES = ['NATIONAL_ID', 'PASSPORT', 'ALIEN_ID', 'REG_NO'] as const;

export const CONTACT_CHANNELS: SelectOption[] = [
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
];

export const CONTACT_CHANNEL_VALUES = ['SMS', 'WHATSAPP', 'EMAIL'] as const;

export function tenantStatusLabel(value: string): string {
  return TENANT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function tenantPortalStatusLabel(value: string): string {
  return TENANT_PORTAL_STATUSES.find((s) => s.value === value)?.label ?? value;
}
