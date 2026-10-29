/**
 * Client-side row shapes for the sales UI (plan-slice-5 §3). These mirror
 * the API responses from lib/domain/{sales,offer,handoff}.ts — never Prisma
 * models directly.
 */

export type ListingAccess = 'owner' | 'shared'

export type ListingRow = {
  id: string
  access: ListingAccess
  organizationId: string
  marketingOrganizationId: string | null
  propertyId: string
  unitId: string | null
  purpose: 'SALE' | 'RENT'
  status: string
  title: string
  description: string | null
  highlights: string[]
  askingPrice: string | null
  currency: string
  priceFrequency: string
  priceOnRequest: boolean
  commissionRate: string | null
  commissionBasis: string
  sourceChannel: string
  publishedAt: string | null
  expiresAt: string | null
  contactPhone: string | null
  contactEmail: string | null
  createdAt: string
  updatedAt: string
  property: {
    id: string
    name: string
    locality: string | null
    addressLine1?: string | null
    latitude?: number | string | null
    longitude?: number | string | null
    category?: string
  }
  unit: { id: string; unitRef: string; label: string | null } | null
  priceHistory?: Array<{
    id: string
    price: string
    event: string
    note: string | null
    changedAt: string
    changedByUserId: string | null
  }>
  counts?: { leads: number; offers: number } | null
  offers?: Array<{
    id: string
    amount: string
    currency: string
    status: string
    offerDate: string
    lead: { id: string; displayName: string } | null
  }>
}

export type LeadRow = {
  id: string
  organizationId: string
  displayName: string
  phone: string | null
  email: string | null
  preferredChannel: string
  source: string
  status: string
  budgetMin: number | null
  budgetMax: number | null
  criteria: unknown
  notes: string | null
  nextActionAt: string | null
  assignedToUserId: string | null
  propertyId: string | null
  listingId: string | null
  createdAt: string
  updatedAt: string
  assignedTo: { id: string; displayName: string } | null
  listing: { id: string; title: string; status: string; purpose: string } | null
  property: { id: string; name: string; locality: string | null } | null
  viaHandoffFrom: { id: string; name: string; acceptedAt: string | null } | null
  needsAction?: boolean
  viewings?: Array<{
    id: string
    scheduledAt: string
    status: string
    feedback: string | null
    property: { id: string; name: string }
  }>
  offers?: Array<{
    id: string
    amount: string
    currency: string
    status: string
    offerDate: string
    listing: { id: string; title: string } | null
    deal: { id: string; status: string } | null
  }>
  handoffs?: Array<{
    id: string
    status: string
    message: string | null
    createdAt: string
    respondedAt: string | null
    fromOrganization: { id: string; name: string }
    toOrganization: { id: string; name: string }
    direction: 'OUTGOING' | 'INCOMING'
    canRespond: boolean
  }>
}

export type ViewingRow = {
  id: string
  organizationId: string
  propertyId: string
  unitId: string | null
  leadId: string | null
  scheduledAt: string
  durationMinutes: number | null
  agentUserId: string | null
  agentName: string | null
  status: string
  feedback: string | null
  notes: string | null
  property: { id: string; name: string; locality: string | null }
  unit: { id: string; unitRef: string; label: string | null } | null
  lead: { id: string; displayName: string; status: string } | null
}

export type OfferRow = {
  id: string
  organizationId: string
  listingId: string
  propertyId: string
  leadId: string | null
  amount: string
  currency: string
  offerDate: string
  status: string
  terms: unknown
  expiresAt: string | null
  supersedesOfferId: string | null
  respondedByUserId: string | null
  respondedAt: string | null
  acceptedAt: string | null
  createdAt: string
  updatedAt: string
  listing: { id: string; title: string; status: string; purpose: string } | null
  property: { id: string; name: string; locality: string | null; category: string } | null
  lead: { id: string; displayName: string; phone: string | null; status: string } | null
  deal: { id: string; status: string } | null
  supersedes: {
    id: string
    amount: string
    currency: string
    status: string
    offerDate: string
    terms: unknown
  } | null
  counters: Array<{
    id: string
    amount: string
    status: string
    offerDate: string
    supersedesOfferId: string | null
  }>
}

export type DealRow = {
  id: string
  organizationId: string
  offerId: string
  propertyId: string
  buyerLeadId: string | null
  buyerOwnerPartyId: string | null
  salePrice: string
  currency: string
  status: string
  checklist: unknown
  commissionAmount: string | null
  completionDate: string | null
  notes: string | null
  openedAt: string
  offer: {
    id: string
    amount: string
    currency: string
    status: string
    offerDate: string
    supersedesOfferId: string | null
    listing: { id: string; title: string; status: string; purpose: string } | null
  } | null
  property: { id: string; name: string; locality: string | null; category: string }
  buyerLead: { id: string; displayName: string; phone: string | null; status: string } | null
  buyerOwnerParty: { id: string; name: string; organizationId: string } | null
}

export type HandoffRow = {
  id: string
  status: string
  message: string | null
  leadId: string
  listingId: string | null
  fromOrganizationId: string
  toOrganizationId: string
  createdAt: string
  updatedAt: string
  respondedAt: string | null
  respondedByUserId: string | null
  direction: 'OUTGOING' | 'INCOMING'
  canRespond: boolean
  lead: { id: string; displayName: string; phone: string | null; email: string | null; status: string }
  listing: { id: string; title: string; status: string; purpose: string } | null
  fromOrganization: { id: string; name: string; kind: string | null }
  toOrganization: { id: string; name: string; kind: string | null }
}

export type DealChecklistItem = {
  key: string
  label: string
  mandatory: boolean
  done: boolean
  doneByUserId: string | null
  doneAt: string | null
}

export function parseChecklist(raw: unknown): DealChecklistItem[] {
  return Array.isArray(raw) ? (raw as DealChecklistItem[]) : []
}
