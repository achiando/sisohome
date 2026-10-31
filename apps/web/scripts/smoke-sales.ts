/**
 * Sales slice-5 smoke (plan-slice-5 acceptance 1-7): listing lifecycle +
 * price history, MK shared projection (content-only writes), offers →
 * auto-deal → completion ownership flip, leads + cross-org handoffs.
 *
 *   cd apps/web && set -a && source .env && set +a \
 *     && ../../packages/database/node_modules/.bin/tsx scripts/smoke-sales.ts
 *
 * Prints one line per case; exits 1 on any failure.
 */

import { OrganizationService } from '@workspace/database'

import { RouteError } from '@/lib/api-route'
import { prisma } from '@/lib/auth'
import { ensureOtherOrg } from './lib/ensure-other-org';
import * as sales from '@/lib/domain/sales'
import * as offers from '@/lib/domain/offer'
import * as handoffs from '@/lib/domain/handoff'
import * as units from '@/lib/domain/unit'

let passed = 0
let failed = 0

function ok(label: string) {
  passed += 1
  console.log(`  ✓ ${label}`)
}

function check(label: string, cond: boolean, detail = '') {
  if (cond) ok(label)
  else {
    failed += 1
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function expectStatus(label: string, status: number, fn: () => Promise<unknown>) {
  try {
    await fn()
    failed += 1
    console.log(`  ✗ ${label} — expected ${status}, succeeded`)
  } catch (err) {
    if (err instanceof RouteError && err.status === status) {
      ok(`${label} → ${status} (${err.message})`)
    } else {
      failed += 1
      console.log(`  ✗ ${label} — expected ${status}, got ${err instanceof Error ? err.message : err}`)
    }
  }
}

async function expectOk<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const result = await fn()
    ok(label)
    return result
  } catch (err) {
    failed += 1
    console.log(`  ✗ ${label} — ${err instanceof Error ? err.message : err}`)
    return null
  }
}

function futureIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

const org = await prisma.organization.findFirstOrThrow()
const otherOrg = await ensureOtherOrg(org.id)
const user = await prisma.user.findFirstOrThrow()

const actor = { userId: user.id, organizationId: org.id }
const stranger = otherOrg ? { userId: user.id, organizationId: otherOrg.id } : null

const stamp = Date.now()
const svc = new OrganizationService(prisma)

let mkUserId = ''
let mkOrgId = ''
let propertyId = ''
let propertyNoPinId = ''
let unitId = ''
let listingId = ''
let draftListingId = ''
let noPriceListingId = ''
let offerId = ''
let counterId = ''
let acceptedOfferId = ''
let dealId = ''
let leadId = ''
let viewingId = ''
let handoffId = ''
let declinedHandoffId = ''
let buyerPartyId = ''
let sellerPartyId = ''
let sellerOwnershipId = ''

try {
  console.log('— setup: MARKETING_AGENT org (shared-listing receiver)')
  const mkUser = await prisma.user.create({
    data: { email: `smoke-sales-mk-${stamp}@example.com`, displayName: 'Smoke MK Agent', status: 'ACTIVE' },
  })
  mkUserId = mkUser.id
  const mkOrg = await svc.createOrganization({
    userId: mkUser.id,
    name: `Smoke Sales MK ${stamp}`,
    kind: 'MARKETING_AGENT',
  })
  mkOrgId = mkOrg.id
  const mkActor = { userId: mkUser.id, organizationId: mkOrg.id }
  ok(`MK org created (${mkOrgId})`)

  console.log('— setup: property + unit')
  const property = await prisma.property.create({
    data: {
      portfolioOrganizationId: org.id,
      name: `SMOKE Sales Property ${stamp}`,
      category: 'RESIDENTIAL',
      propertyType: 'APARTMENT',
      addressLine1: 'Smoke Sales Lane 5',
      locality: 'Smokeville',
      country: 'KE',
    },
  })
  propertyId = property.id
  const propertyNoPin = await prisma.property.create({
    data: {
      portfolioOrganizationId: org.id,
      name: `SMOKE Sales NoPin ${stamp}`,
      category: 'LAND',
      propertyType: 'RESIDENTIAL_PLOT',
      addressLine1: 'Smoke Unpinned Road',
      locality: 'Smokeville',
      country: 'KE',
    },
  })
  propertyNoPinId = propertyNoPin.id
  const unit = await expectOk('create unit', () =>
    units.createUnit(actor, property.id, { unitRef: `SMOKE-SLS-${stamp}`, unitType: 'BED_1', defaultRent: 30000 }),
  )
  unitId = unit?.id ?? ''
  ok('properties + unit created')

  console.log('— 1. listing lifecycle + price history')
  const listing = await expectOk('create DRAFT listing with price', () =>
    sales.createListing(actor, {
      propertyId,
      unitId,
      purpose: 'SALE',
      title: `SMOKE Sunset Villa ${stamp}`,
      description: 'A smoke-test villa with a garden.',
      askingPrice: 25_000_000,
      highlights: ['Garden', 'Pool'],
    }),
  )
  check('listing starts DRAFT + owner access', listing?.status === 'DRAFT' && listing.access === 'owner')
  listingId = listing?.id ?? ''

  const hist0 = await prisma.listingPriceHistory.findMany({ where: { listingId } })
  check('create with price writes LISTED history', hist0.length === 1 && hist0[0]?.event === 'LISTED')

  const noPin = await expectOk('create no-pin listing', () =>
    sales.createListing(actor, { propertyId: propertyNoPinId, purpose: 'SALE', title: `SMOKE NoPin ${stamp}` }),
  )
  draftListingId = noPin?.id ?? ''
  await expectStatus('publish without map pin → 400', 400, () => sales.publishListing(actor, draftListingId))

  const noPrice = await expectOk('create price-less listing on pinned property', () =>
    sales.createListing(actor, { propertyId, purpose: 'SALE', title: `SMOKE NoPrice ${stamp}` }),
  )
  noPriceListingId = noPrice?.id ?? ''
  await prisma.property.update({ where: { id: propertyId }, data: { latitude: -1.29, longitude: 36.82 } })
  await expectStatus('publish without price → 400', 400, () => sales.publishListing(actor, noPriceListingId))

  const published = await expectOk('publish listing (pin + price set)', () =>
    sales.publishListing(actor, listingId),
  )
  check('listing PUBLISHED with publishedAt', published?.status === 'PUBLISHED' && !!published.publishedAt)

  await expectOk('reduce asking price', () => sales.updateListing(actor, listingId, { askingPrice: 24_000_000 }))
  await expectOk('increase asking price', () => sales.updateListing(actor, listingId, { askingPrice: 26_000_000 }))
  const hist1 = await prisma.listingPriceHistory.findMany({
    where: { listingId },
    orderBy: { changedAt: 'asc' },
  })
  check(
    'price changes append REDUCED + INCREASED',
    hist1.length === 3 && hist1[1]?.event === 'REDUCED' && hist1[2]?.event === 'INCREASED',
    hist1.map((h) => h.event).join(','),
  )

  console.log('— 2. MK shared projection (content-only)')
  await expectOk('owner shares listing with MK org', () =>
    sales.updateListing(actor, listingId, { marketingOrganizationId: mkOrgId }),
  )
  const mkList = await expectOk('MK lists shared listing', () => sales.listListings(mkActor))
  const shared = (mkList ?? []).find((l) => l.id === listingId)
  check('MK sees exactly the shared listing as shared', !!shared && shared.access === 'shared')
  check(
    'MK projection excludes internal property fields',
    !!shared && !('defaults' in (shared.property as Record<string, unknown>)) && !('portfolioOrganizationId' in (shared.property as Record<string, unknown>)),
  )
  await expectStatus('MK askingPrice write → 400 (restricted)', 400, () =>
    sales.updateListing(mkActor, listingId, { askingPrice: 1 }),
  )
  await expectOk('MK content write (title) allowed', () =>
    sales.updateListing(mkActor, listingId, { title: `SMOKE Shared Title ${stamp}` }),
  )
  await expectStatus('MK close → 403 (portfolio side only)', 403, () =>
    sales.closeListing(mkActor, listingId, { to: 'WITHDRAWN' }),
  )
  await expectStatus('MK createOffer → 404 (owner-side reach only)', 404, () =>
    offers.createOffer(mkActor, { listingId, amount: 100 }),
  )

  console.log('— 3. offers → auto-deal → completion')
  const offer1 = await expectOk('create offer', () =>
    offers.createOffer(actor, { listingId, amount: 20_000_000, termsNote: undefined }),
  )
  offerId = offer1?.id ?? ''
  check('offer starts SUBMITTED', offer1?.status === 'SUBMITTED')

  const counter = await expectOk('counter offer', () => offers.counterOffer(actor, offerId, { amount: 21_000_000 }))
  counterId = counter?.id ?? ''
  const oldAfterCounter = await prisma.offer.findUnique({ where: { id: offerId } })
  check('counter supersedes: old COUNTERED, new SUBMITTED', oldAfterCounter?.status === 'COUNTERED' && counter?.status === 'SUBMITTED')
  check('counter row records supersedesOfferId', (counter as { supersedesOfferId?: string } | null)?.supersedesOfferId === offerId)

  const accepted = await expectOk('accept counter offer', () => offers.approveOffer(actor, counterId, { to: 'ACCEPTED' }))
  acceptedOfferId = (accepted as { id?: string } | null)?.id ?? counterId
  check('accepted offer status ACCEPTED', (accepted as { status?: string } | null)?.status === 'ACCEPTED')
  const listingAfter = await prisma.listing.findUnique({ where: { id: listingId } })
  check('listing moved to UNDER_OFFER', listingAfter?.status === 'UNDER_OFFER')

  const deal0 = await prisma.propertyDeal.findFirst({ where: { offerId: acceptedOfferId } })
  dealId = deal0?.id ?? ''
  check('accept auto-creates PropertyDeal with checklist', !!deal0 && Array.isArray(deal0.checklist) && (deal0.checklist as unknown[]).length > 0)
  check('deal starts AGREED', deal0?.status === 'AGREED')

  const offer2 = await expectOk('create second offer', () =>
    offers.createOffer(actor, { listingId, amount: 22_000_000 }),
  )
  await expectStatus('second accept → 409 (one live accepted per listing)', 409, () =>
    offers.approveOffer(actor, offer2?.id ?? '', { to: 'ACCEPTED' }),
  )
  await expectOk('reject second offer', () => offers.approveOffer(actor, offer2?.id ?? '', { to: 'REJECTED' }))

  const checklist = (deal0?.checklist ?? []) as { key: string }[]
  const firstKey = checklist[0]?.key ?? ''
  await expectOk('toggle checklist item', () => offers.patchDeal(actor, dealId, { checklist: [{ key: firstKey, done: true }] }))
  const deal1 = await offers.getDeal(actor, dealId)
  const doneItem = ((deal1 as unknown as { checklist?: { key: string; done: boolean }[] }).checklist ?? []).find((c) => c.key === firstKey)
  check('checklist item persisted as done', doneItem?.done === true)
  await expectOk('patch commission + notes', () =>
    offers.patchDeal(actor, dealId, { commissionAmount: 520_000, notes: 'Smoke completion' }),
  )
  await expectStatus('patch unknown field → 400', 400, () => offers.patchDeal(actor, dealId, { salePrice: 1 }))

  const sellerParty = await prisma.propertyOwnerParty.create({
    data: { organizationId: org.id, name: `SMOKE Seller ${stamp}`, partyType: 'PERSON' },
  })
  sellerPartyId = sellerParty.id
  const sellerOwn = await prisma.propertyOwnership.create({
    data: {
      organizationId: org.id,
      propertyId,
      ownerPartyId: sellerParty.id,
      sharePercent: 100,
      startsAt: new Date('2024-01-01'),
    },
  })
  sellerOwnershipId = sellerOwn.id
  const buyerParty = await prisma.propertyOwnerParty.create({
    data: { organizationId: org.id, name: `SMOKE Buyer ${stamp}`, partyType: 'PERSON' },
  })
  buyerPartyId = buyerParty.id

  await expectStatus('complete without buyer party → 400', 400, () => offers.completeDeal(actor, dealId, {}))
  await expectOk('set buyer party on deal', () => offers.patchDeal(actor, dealId, { buyerOwnerPartyId: buyerPartyId }))
  const completed = await expectOk('complete deal', () => offers.completeDeal(actor, dealId, {}))
  check('deal COMPLETED', (completed as { status?: string } | null)?.status === 'COMPLETED')

  const sellerAfter = await prisma.propertyOwnership.findUnique({ where: { id: sellerOwnershipId } })
  check('seller ownership closed', sellerAfter?.endsAt instanceof Date)
  const buyerOwn = await prisma.propertyOwnership.findFirst({
    where: { propertyId, ownerPartyId: buyerPartyId, endsAt: null },
  })
  check('buyer ownership opened at 100%', !!buyerOwn && Number(buyerOwn.sharePercent) === 100)
  const listingFinal = await prisma.listing.findUnique({ where: { id: listingId } })
  check('listing SOLD after completion', listingFinal?.status === 'SOLD')
  const hist2 = await prisma.listingPriceHistory.findFirst({ where: { listingId, event: 'SOLD' } })
  check('SOLD price-history row written', !!hist2)

  console.log('— 4. lead draft close (WITHDRAWN from DRAFT)')
  await expectOk('close draft listing as WITHDRAWN', () => sales.closeListing(actor, noPriceListingId, { to: 'WITHDRAWN' }))
  const hist3 = await prisma.listingPriceHistory.findFirst({ where: { listingId: noPriceListingId, event: 'WITHDRAWN' } })
  check('WITHDRAWN history only when priced — absent here', hist3 === null)

  console.log('— 5. leads + viewings')
  const lead = await expectOk('create lead with phone', () =>
    sales.createLead(actor, {
      displayName: `SMOKE Hunter ${stamp}`,
      phone: '+254700000123',
      preferredChannel: 'WHATSAPP',
      source: 'WEBSITE',
      listingId,
    }),
  )
  leadId = lead?.id ?? ''
  check('lead starts NEW', (lead as { status?: string } | null)?.status === 'NEW')
  await expectStatus('lead without phone/email → 400', 400, () =>
    sales.createLead(actor, { displayName: 'SMOKE Silent' }),
  )

  const viewing = await expectOk('book viewing against lead', () =>
    sales.createViewing(actor, { propertyId, leadId, scheduledAt: futureIso(2), durationMinutes: 30 }),
  )
  viewingId = viewing?.id ?? ''
  check('viewing SCHEDULED', (viewing as { status?: string } | null)?.status === 'SCHEDULED')
  const leadAfterViewing = await prisma.lead.findUnique({ where: { id: leadId } })
  check('booking bumps lead NEW → VIEWING', leadAfterViewing?.status === 'VIEWING')

  await expectOk('MK books viewing via shared listing property', () =>
    sales.createViewing(mkActor, { propertyId, scheduledAt: futureIso(3) }),
  )
  const mkViewing = await prisma.propertyViewing.findFirst({
    where: { propertyId, leadId: null },
  })
  check('MK viewing owned by portfolio org', !!mkViewing && mkViewing.organizationId === org.id)

  await expectStatus('MK reads un-handed lead → 404', 404, () => sales.getLead(mkActor, leadId))

  console.log('— 6. cross-org handoffs')
  await expectStatus('self-handoff → 400', 400, () =>
    handoffs.createHandoff(actor, { leadId, toOrganizationId: org.id }),
  )
  const ho = await expectOk('hand lead off to MK org', () =>
    handoffs.createHandoff(actor, { leadId, toOrganizationId: mkOrgId, listingId, message: 'Smoke referral' }),
  )
  handoffId = ho?.id ?? ''
  check('handoff OFFERED', (ho as { status?: string } | null)?.status === 'OFFERED')
  await expectStatus('duplicate pending handoff → 409', 409, () =>
    handoffs.createHandoff(actor, { leadId, toOrganizationId: mkOrgId }),
  )
  await expectStatus('sender cannot respond → 404', 404, () => handoffs.respondHandoff(actor, handoffId, { to: 'ACCEPTED' }))
  await expectStatus('MK cannot read lead before accept → 404', 404, () => sales.getLead(mkActor, leadId))

  const responded = await expectOk('MK accepts handoff', () => handoffs.respondHandoff(mkActor, handoffId, { to: 'ACCEPTED' }))
  check('handoff ACCEPTED', (responded as { status?: string } | null)?.status === 'ACCEPTED')
  await expectStatus('re-respond → 409', 409, () => handoffs.respondHandoff(mkActor, handoffId, { to: 'DECLINED' }))

  const mkLead = await expectOk('MK reads handed lead', () => sales.getLead(mkActor, leadId))
  check('lead row NOT re-pointed (still main org)', (mkLead as unknown as { organizationId?: string } | null)?.organizationId === org.id)
  const mkLeads = await sales.listLeads(mkActor)
  check('MK lead inbox includes handed lead', mkLeads.some((l) => l.id === leadId))

  if (stranger && otherOrg) {
    const ho2 = await expectOk('hand second (declined) handoff to other org', () =>
      handoffs.createHandoff(actor, { leadId, toOrganizationId: otherOrg.id }),
    )
    declinedHandoffId = ho2?.id ?? ''
    await expectOk('other org declines', () => handoffs.respondHandoff(stranger, declinedHandoffId, { to: 'DECLINED' }))
    await expectStatus('declined receiver cannot read lead → 404', 404, () => sales.getLead(stranger, leadId))
  } else {
    console.log('  · skipped declined-handoff negatives (no second org)')
  }

  const mkHandoffs = await handoffs.listHandoffs(mkActor, {})
  check('MK handoff register lists the accepted handoff', mkHandoffs.some((h) => h.id === handoffId))

  console.log('— 7. MK lead capture (own org)')
  const mkLeadCreated = await expectOk('MK captures own lead', () =>
    sales.createLead(mkActor, { displayName: `SMOKE MK Hunter ${stamp}`, phone: '+254711000222', source: 'REFERRAL' }),
  )
  check('MK lead owned by MK org', (mkLeadCreated as { organizationId?: string } | null)?.organizationId === mkOrgId)
} finally {
  console.log('— cleanup')
  const cleanup = async () => {
    if (viewingId) await prisma.propertyViewing.deleteMany({ where: { id: viewingId } })
    if (propertyId) await prisma.propertyViewing.deleteMany({ where: { propertyId } })
    if (handoffId || declinedHandoffId) {
      await prisma.handoff.deleteMany({ where: { id: { in: [handoffId, declinedHandoffId].filter(Boolean) } } })
    }
    if (dealId) await prisma.propertyDeal.deleteMany({ where: { id: dealId } })
    if (acceptedOfferId || offerId || counterId) {
      await prisma.offer.deleteMany({
        where: { id: { in: [acceptedOfferId, offerId, counterId].filter(Boolean) } },
      })
    }
    await prisma.offer.deleteMany({ where: { listingId: { in: [listingId, draftListingId, noPriceListingId].filter(Boolean) } } })
    if (leadId) await prisma.lead.deleteMany({ where: { id: leadId } })
    await prisma.lead.deleteMany({ where: { organizationId: mkOrgId || '__none__' } })
    await prisma.listingPriceHistory.deleteMany({
      where: { listingId: { in: [listingId, draftListingId, noPriceListingId].filter(Boolean) } },
    })
    await prisma.listing.deleteMany({
      where: { id: { in: [listingId, draftListingId, noPriceListingId].filter(Boolean) } },
    })
    if (sellerOwnershipId) await prisma.propertyOwnership.deleteMany({ where: { id: sellerOwnershipId } })
    await prisma.propertyOwnership.deleteMany({ where: { propertyId } })
    await prisma.propertyOwnerParty.deleteMany({ where: { id: { in: [buyerPartyId, sellerPartyId].filter(Boolean) } } })
    if (unitId) await prisma.unit.deleteMany({ where: { id: unitId } })
    await prisma.property.deleteMany({ where: { id: { in: [propertyId, propertyNoPinId].filter(Boolean) } } })
    if (mkOrgId) {
      await prisma.organizationMember.deleteMany({ where: { organizationId: mkOrgId } })
      const roles = await prisma.role.findMany({ where: { organizationId: mkOrgId }, select: { id: true } })
      await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map((r) => r.id) } } })
      await prisma.role.deleteMany({ where: { organizationId: mkOrgId } })
      await prisma.organization.deleteMany({ where: { id: mkOrgId } })
    }
    if (mkUserId) await prisma.user.deleteMany({ where: { id: mkUserId } })
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: [user.id, mkUserId].filter(Boolean) } } })
  }
  try {
    await cleanup()
    console.log('🧹 cleaned up')
  } catch (err) {
    console.error('cleanup failed:', err)
  }
  await prisma.$disconnect()
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
