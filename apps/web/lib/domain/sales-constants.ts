/**
 * Sales slice constants (plan-slice-5 §3.4) — client-safe, type-only imports
 * (see property-constants.ts). Transition maps live here so the domain, the
 * status steppers and the smoke all agree on one table.
 */

import type {
  DealStatus,
  HandoffStatus,
  LeadSource,
  LeadStatus,
  ListingPurpose,
  ListingPriceFrequency,
  ListingSourceChannel,
  ListingStatus,
  OfferStatus,
  PropertyCategory,
  ViewingFeedback,
  ViewingStatus,
} from '@workspace/database';

import { type Option } from './property-constants';

export const LISTING_PURPOSES: Option<ListingPurpose>[] = [
  { value: 'SALE', label: 'For sale' },
  { value: 'RENT', label: 'For rent' },
];

export const LISTING_STATUSES: Option<ListingStatus>[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'UNDER_OFFER', label: 'Under offer' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'RENTED', label: 'Rented' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'EXPIRED', label: 'Expired' },
];

export const LISTING_FREQUENCIES: Option<ListingPriceFrequency>[] = [
  { value: 'TOTAL', label: 'Total price' },
  { value: 'MONTHLY', label: 'Per month' },
  { value: 'PER_SQM', label: 'Per m²' },
  { value: 'ON_REQUEST', label: 'On request' },
];

export const LISTING_SOURCE_CHANNELS: Option<ListingSourceChannel>[] = [
  { value: 'DIRECT', label: 'Direct' },
  { value: 'MARKETING_AGENT', label: 'Marketing agent' },
  { value: 'IMPORT', label: 'Import' },
];

export const LEAD_STATUSES: Option<LeadStatus>[] = [
  { value: 'NEW', label: 'New' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'VIEWING', label: 'Viewing' },
  { value: 'OFFERING', label: 'Offering' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

export const LEAD_SOURCES: Option<LeadSource>[] = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'SIGNBOARD', label: 'Signboard' },
  { value: 'PORTAL', label: 'Portal' },
  { value: 'CALL_IN', label: 'Call in' },
  { value: 'OTHER', label: 'Other' },
];

export const CONTACT_CHANNELS: Option<'SMS' | 'WHATSAPP' | 'EMAIL'>[] = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
];

export const VIEWING_STATUSES: Option<ViewingStatus>[] = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NO_SHOW', label: 'No show' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const VIEWING_FEEDBACKS: Option<ViewingFeedback>[] = [
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'REVIEWING', label: 'Reviewing' },
  { value: 'DECLINED', label: 'Declined' },
];

export const OFFER_STATUSES: Option<OfferStatus>[] = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'COUNTERED', label: 'Countered' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'EXPIRED', label: 'Expired' },
];

export const DEAL_STATUSES: Option<DealStatus>[] = [
  { value: 'AGREED', label: 'Agreed' },
  { value: 'DUE_DILIGENCE', label: 'Due diligence' },
  { value: 'COMPLETION_PENDING', label: 'Completion pending' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'COLLAPSED', label: 'Collapsed' },
];

export const HANDOFF_STATUSES: Option<HandoffStatus>[] = [
  { value: 'OFFERED', label: 'Offered' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'EXPIRED', label: 'Expired' },
];

/** Statuses `POST /api/listings/[id]/publish` accepts as the "from" state. */
export const LISTING_PUBLISHABLE: ListingStatus[] = ['DRAFT', 'PAUSED'];

/** Close targets per current status (`POST /api/listings/[id]/close`). */
export const LISTING_CLOSEABLE: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ['WITHDRAWN', 'EXPIRED'],
  PAUSED: ['WITHDRAWN', 'EXPIRED'],
  PUBLISHED: ['SOLD', 'RENTED', 'WITHDRAWN', 'EXPIRED'],
  UNDER_OFFER: ['SOLD', 'RENTED', 'WITHDRAWN', 'EXPIRED'],
  SOLD: [],
  RENTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
};

/** Pause/resume is the only status edit allowed through PATCH. */
export const LISTING_PAUSE_PAIRS: Array<[ListingStatus, ListingStatus]> = [
  ['PUBLISHED', 'PAUSED'],
  ['PAUSED', 'PUBLISHED'],
];

export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['QUALIFIED', 'LOST', 'WITHDRAWN'],
  QUALIFIED: ['MATCHED', 'LOST', 'WITHDRAWN'],
  MATCHED: ['VIEWING', 'LOST', 'WITHDRAWN'],
  VIEWING: ['OFFERING', 'LOST', 'WITHDRAWN'],
  OFFERING: ['WON', 'LOST', 'WITHDRAWN'],
  WON: [],
  LOST: [],
  WITHDRAWN: [],
};

/** Happy-path pipeline order for the status stepper. */
export const LEAD_STAGE_ORDER: LeadStatus[] = ['NEW', 'QUALIFIED', 'MATCHED', 'VIEWING', 'OFFERING', 'WON'];

export const LEAD_TERMINAL: LeadStatus[] = ['WON', 'LOST', 'WITHDRAWN'];

export const VIEWING_TRANSITIONS: Record<ViewingStatus, ViewingStatus[]> = {
  SCHEDULED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

/** Statuses an offer may be accepted/rejected from (counter chain states). */
export const OFFER_APPROVABLE: OfferStatus[] = ['SUBMITTED', 'COUNTERED'];

export const DEAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  AGREED: ['DUE_DILIGENCE', 'COLLAPSED'],
  DUE_DILIGENCE: ['COMPLETION_PENDING', 'COLLAPSED'],
  COMPLETION_PENDING: ['COLLAPSED'],
  COMPLETED: [],
  COLLAPSED: [],
};

export type DealChecklistItem = {
  key: string;
  label: string;
  mandatory: boolean;
  done: boolean;
  doneByUserId: string | null;
  doneAt: string | null;
};

/**
 * Category-aware deal checklist (research-property-4 §4). SOFT-gated in v1:
 * completion does not require every mandatory box, it just orders the room.
 */
export function dealChecklistTemplate(category: PropertyCategory | string): DealChecklistItem[] {
  const base = (key: string, label: string, mandatory = true): DealChecklistItem => ({
    key,
    label,
    mandatory,
    done: false,
    doneByUserId: null,
    doneAt: null,
  });

  if (category === 'LAND') {
    return [
      base('lands_search', 'Official lands search'),
      base('survey_plan', 'Survey plan / beacon certificate'),
      base('lcb_consent', 'LCB consent to transfer'),
      base('deposit_paid', 'Deposit received'),
      base('title_transfer', 'Title transfer lodged'),
      base('stamp_duty', 'Stamp duty paid'),
    ];
  }

  return [
    base('title_deed', 'Title deed verified'),
    base('official_search', 'Official search (recent)'),
    base('rates_clearance', 'Rates clearance certificate'),
    base('inspection', 'Property inspection report', false),
    base('deposit_paid', 'Deposit received'),
    base('completion_docs', 'Completion documents signed'),
  ];
}
