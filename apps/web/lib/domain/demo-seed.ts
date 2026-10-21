/**
 * Demo data seeder — a TEST-PAGE-only module that fills the caller's
 * organization with a realistic, kind-aware property portfolio.
 *
 * This is PURE DATA: it never touches the permission/role catalog or the
 * org-kind role templates (that is the foundation seed's job — see
 * packages/database/src/seed/). Every row is marked for idempotent wipe:
 *   - properties: code `DEMO-*` + tag `demo`
 *   - tenants/leases: refs `DEMO-T*` / `DEMO-L*`
 *   - owner parties: name prefix "Demo "
 * `seedDemoData` always wipes first, so re-running replaces rather than
 * duplicates. All rows are scoped to the actor's organization.
 *
 * Media uses exact, hotlink-friendly assets from reputable sources
 * (Unsplash CDN photos — verified 200; Pexels CC0 video — verified 206):
 * photo URLs are stored in `storageKey` (the Media tab renders https
 * keys as real images) and the property `videoUrl` points at the Pexels
 * tour clip.
 */

import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import type { ScopeActor } from './property-scope';
import { recomputeUnitStatus } from './unit';

export const DEMO_TAG = 'demo';
export const DEMO_CODE_PREFIX = 'DEMO-';
export const DEMO_REF_PREFIX = 'DEMO-';
export const DEMO_OWNER_PREFIX = 'Demo ';

// ── verified public media (reputable sources, checked 2026-10-21) ────────────

function photo(id: string): string {
  return `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;
}

/** Property tour clip — Pexels CC0 (verified 206 partial-content). */
const DEMO_VIDEO_URL =
  'https://videos.pexels.com/video-files/7578552/7578552-hd_1920_1080_30fps.mp4';

const APARTMENT_PHOTOS = [
  { url: photo('1493809842364-78817add7ffb'), caption: 'Block exterior — front elevation' },
  { url: photo('1560448204-e02f11c3d0e2'), caption: 'Furnished living room' },
  { url: photo('1484154218962-a197022b5858'), caption: 'Kitchen with quartz counters' },
  { url: photo('1502672260266-1c1ef2d93688'), caption: 'Studio layout — natural light' },
];

const VILLA_PHOTOS = [
  { url: photo('1600596542815-ffad4c1539a9'), caption: 'Garden facade at dusk' },
  { url: photo('1522708323590-d24dbb6b0267'), caption: 'Open-plan lounge' },
  { url: photo('1600607687939-ce8a6c25118c'), caption: 'Chef kitchen & island' },
  { url: photo('1600566753190-17f0baa2a6c3'), caption: 'Primary bedroom suite' },
];

const PLAZA_PHOTOS = [
  { url: photo('1460317442991-0ec209397118'), caption: 'Plaza exterior — Ngong Road' },
  { url: photo('1545324418-cc1a3fa10c00'), caption: 'Upper-floor apartments' },
  { url: photo('1570129477492-45c003edd2be'), caption: 'Entrance & parking bay' },
  { url: photo('1568605114967-8130f3a36994'), caption: 'Rooftop terrace view' },
];

// ── summary shapes ───────────────────────────────────────────────────────────

export interface DemoWipeSummary {
  properties: number;
  buildings: number;
  units: number;
  documents: number;
  leases: number;
  applications: number;
  agreements: number;
  ownerships: number;
  staffAssignments: number;
  tenants: number;
  ownerParties: number;
}

export interface DemoSeedSummary extends DemoWipeSummary {
  kind: string;
}

// ── wipe ─────────────────────────────────────────────────────────────────────

async function findDemoProperties(organizationId: string) {
  return db.property.findMany({
    where: {
      portfolioOrganizationId: organizationId,
      OR: [{ tags: { has: DEMO_TAG } }, { code: { startsWith: DEMO_CODE_PREFIX } }],
    },
    select: { id: true },
  });
}

/**
 * Remove every demo-marked row in the actor's org, children first so the
 * Restrict FKs on property/tenant/owner-party never block. Unknown kinds
 * and pre-existing (non-demo) rows are untouched.
 */
export async function wipeDemoData(actor: ScopeActor): Promise<DemoWipeSummary> {
  const organizationId = actor.organizationId;

  return db.$transaction(
    async (tx) => {
      const props = await findDemoProperties(organizationId);
      const propertyIds = props.map((p) => p.id);

      const demoTenants = await tx.tenant.findMany({
        where: { organizationId, tenantRef: { startsWith: DEMO_REF_PREFIX } },
        select: { id: true },
      });
      const tenantIds = demoTenants.map((t) => t.id);

      const demoLeases = await tx.lease.findMany({
        where: { organizationId, leaseRef: { startsWith: DEMO_REF_PREFIX } },
        select: { id: true },
      });
      const leaseIds = demoLeases.map((l) => l.id);

      const demoApps = await tx.rentalApplication.findMany({
        where: { organizationId, propertyId: { in: propertyIds } },
        select: { id: true },
      });
      const appIds = demoApps.map((a) => a.id);

      // 1. documents — property-family + tenant/lease/app entity pointers
      const documents = await tx.propertyDocument.deleteMany({
        where: {
          organizationId,
          OR: [
            { propertyId: { in: propertyIds } },
            { entityType: 'TENANT', entityId: { in: tenantIds } },
            { entityType: 'LEASE', entityId: { in: leaseIds } },
            { entityType: 'APPLICATION', entityId: { in: appIds } },
          ],
        },
      });

      // 2. leases (cascades lease_units + lease_tenants)
      const leases = await tx.lease.deleteMany({
        where: { organizationId, leaseRef: { startsWith: DEMO_REF_PREFIX } },
      });

      // 3. applications (Restrict from property)
      const applications = await tx.rentalApplication.deleteMany({
        where: { id: { in: appIds } },
      });

      // 4. agreements / ownerships / staff (Restrict or cascade from property)
      const agreements = await tx.propertyManagementAgreement.deleteMany({
        where: { organizationId, propertyId: { in: propertyIds } },
      });
      const ownerships = await tx.propertyOwnership.deleteMany({
        where: {
          organizationId,
          OR: [
            { propertyId: { in: propertyIds } },
            { ownerParty: { name: { startsWith: DEMO_OWNER_PREFIX } } },
          ],
        },
      });
      const staffAssignments = await tx.propertyStaffAssignment.deleteMany({
        where: { organizationId, propertyId: { in: propertyIds } },
      });

      // 5. properties (cascades buildings + units + remaining documents)
      const buildingsBefore = await tx.building.count({
        where: { propertyId: { in: propertyIds } },
      });
      const unitsBefore = await tx.unit.count({
        where: { propertyId: { in: propertyIds } },
      });
      const properties = await tx.property.deleteMany({
        where: { id: { in: propertyIds } },
      });

      // 6. tenants (Restrict from leases/applications — already gone)
      const tenants = await tx.tenant.deleteMany({
        where: { organizationId, tenantRef: { startsWith: DEMO_REF_PREFIX } },
      });

      // 7. owner parties (Restrict from ownerships/agreements — already gone)
      const ownerParties = await tx.propertyOwnerParty.deleteMany({
        where: { organizationId, name: { startsWith: DEMO_OWNER_PREFIX } },
      });

      return {
        properties: properties.count,
        buildings: buildingsBefore,
        units: unitsBefore,
        documents: documents.count,
        leases: leases.count,
        applications: applications.count,
        agreements: agreements.count,
        ownerships: ownerships.count,
        staffAssignments: staffAssignments.count,
        tenants: tenants.count,
        ownerParties: ownerParties.count,
      };
    },
    { timeout: 20_000 },
  );
}

// ── seed ─────────────────────────────────────────────────────────────────────

interface DemoPropertyPlan {
  code: string;
  name: string;
  description: string;
  category: 'RESIDENTIAL' | 'COMMERCIAL' | 'MIXED_USE';
  propertyType: 'APARTMENT_BLOCK' | 'VILLA' | 'MIXED_COMMERCIAL';
  addressLine1: string;
  locality: string;
  latitude: number;
  longitude: number;
  videoUrl?: string;
  photos: { url: string; caption: string }[];
  buildings?: { code: string; name: string; floors: number; units: DemoUnitPlan[] }[];
  looseUnits?: DemoUnitPlan[];
  amenities: string[];
  yearBuilt: number;
}

interface DemoUnitPlan {
  unitRef: string;
  label: string;
  unitType: 'BED_1' | 'BED_2' | 'BED_3' | 'SHOP' | 'OFFICE';
  floor?: number;
  bedrooms?: number;
  bathrooms?: number;
  defaultRent: number;
  status?: 'MAINTENANCE';
  amenities?: string[];
}

const PROPERTY_PLANS: DemoPropertyPlan[] = [
  {
    code: 'DEMO-001',
    name: 'Kilimani Court Apartments',
    description:
      'Twelve-unit apartment block in the heart of Kilimani, walking distance to Yaya Centre. Secure gated entry, borehole water, and backup generator.',
    category: 'RESIDENTIAL',
    propertyType: 'APARTMENT_BLOCK',
    addressLine1: 'Ring Road Kilimani, Near Yaya Centre',
    locality: 'Kilimani, Nairobi',
    latitude: -1.2921,
    longitude: 36.784,
    videoUrl: DEMO_VIDEO_URL,
    photos: APARTMENT_PHOTOS,
    amenities: ['Borehole', 'Generator', 'CCTV', 'Parking', 'Security'],
    yearBuilt: 2018,
    buildings: [
      {
        code: 'Block A',
        name: 'Block A — Studios & 1BR',
        floors: 4,
        units: [
          { unitRef: 'A-101', label: 'A-101 Studio', unitType: 'BED_1', floor: 1, bedrooms: 1, bathrooms: 1, defaultRent: 45000 },
          { unitRef: 'A-102', label: 'A-102 Studio', unitType: 'BED_1', floor: 1, bedrooms: 1, bathrooms: 1, defaultRent: 45000 },
          { unitRef: 'A-201', label: 'A-201 1BR', unitType: 'BED_1', floor: 2, bedrooms: 1, bathrooms: 1, defaultRent: 55000 },
          { unitRef: 'A-202', label: 'A-202 1BR', unitType: 'BED_1', floor: 2, bedrooms: 1, bathrooms: 1, defaultRent: 55000, status: 'MAINTENANCE' },
        ],
      },
      {
        code: 'Block B',
        name: 'Block B — 2BR & 3BR',
        floors: 4,
        units: [
          { unitRef: 'B-301', label: 'B-301 2BR', unitType: 'BED_2', floor: 3, bedrooms: 2, bathrooms: 2, defaultRent: 85000, amenities: ['Balcony', 'Ensuite'] },
          { unitRef: 'B-302', label: 'B-302 2BR', unitType: 'BED_2', floor: 3, bedrooms: 2, bathrooms: 2, defaultRent: 85000, amenities: ['Balcony'] },
          { unitRef: 'B-401', label: 'B-401 3BR', unitType: 'BED_3', floor: 4, bedrooms: 3, bathrooms: 2, defaultRent: 120000, amenities: ['DSQ', 'Terrace'] },
        ],
      },
    ],
  },
  {
    code: 'DEMO-002',
    name: 'Lavington Garden Villa',
    description:
      'Self-contained 4-bedroom villa on a quarter-acre plot off James Gichuru Road. Mature garden, DSQ, electric fence, and ample parking.',
    category: 'RESIDENTIAL',
    propertyType: 'VILLA',
    addressLine1: 'James Gichuru Road, Lavington',
    locality: 'Lavington, Nairobi',
    latitude: -1.2733,
    longitude: 36.773,
    photos: VILLA_PHOTOS,
    amenities: ['Garden', 'DSQ', 'Electric Fence', 'Parking', 'Solar Water'],
    yearBuilt: 2015,
    buildings: [
      {
        code: 'Main House',
        name: 'Main House',
        floors: 2,
        units: [
          { unitRef: 'VILLA-1', label: '4BR Villa', unitType: 'BED_3', floor: 1, bedrooms: 4, bathrooms: 3, defaultRent: 250000, amenities: ['Masters Ensuite', 'Family Lounge'] },
        ],
      },
      {
        code: 'Guest Wing',
        name: 'Guest Wing',
        floors: 1,
        units: [
          { unitRef: 'GW-1', label: '2BR Guest Wing', unitType: 'BED_2', floor: 1, bedrooms: 2, bathrooms: 1, defaultRent: 60000 },
        ],
      },
    ],
  },
  {
    code: 'DEMO-003',
    name: 'Ngong Road Plaza',
    description:
      'Mixed-use plaza on Ngong Road with ground-floor retail and upper-floor apartments. High foot traffic, generator backup, and managed parking.',
    category: 'MIXED_USE',
    propertyType: 'MIXED_COMMERCIAL',
    addressLine1: 'Ngong Road, Near Prestige Plaza',
    locality: 'Ngong Road, Nairobi',
    latitude: -1.2896,
    longitude: 36.7749,
    photos: PLAZA_PHOTOS,
    amenities: ['Generator', 'Managed Parking', 'CCTV', 'High Foot Traffic'],
    yearBuilt: 2020,
    looseUnits: [
      { unitRef: 'SHOP-1', label: 'Ground Shop 1', unitType: 'SHOP', floor: 0, defaultRent: 150000, amenities: ['Shopfront'] },
      { unitRef: 'SHOP-2', label: 'Ground Shop 2', unitType: 'SHOP', floor: 0, defaultRent: 120000, amenities: ['Shopfront'] },
      { unitRef: 'OFFICE-3A', label: 'Office Suite 3A', unitType: 'OFFICE', floor: 3, defaultRent: 90000, amenities: ['Open Plan'] },
      { unitRef: 'APT-4B', label: 'Apartment 4B', unitType: 'BED_2', floor: 4, bedrooms: 2, bathrooms: 2, defaultRent: 95000 },
    ],
  },
];

const TENANT_PLANS = [
  {
    tenantRef: 'DEMO-T1',
    displayName: 'Wanjiku Kamau',
    email: 'wanjiku.kamau.demo@example.com',
    phone: '+254 722 100 201',
    status: 'ACTIVE' as const,
    employer: 'Safaricom PLC',
    jobTitle: 'Product Manager',
    incomeVerified: true,
  },
  {
    tenantRef: 'DEMO-T2',
    displayName: 'Brian Ochieng',
    email: 'brian.ochieng.demo@example.com',
    phone: '+254 733 100 202',
    status: 'ACTIVE' as const,
    employer: 'KCB Bank',
    jobTitle: 'Relationship Manager',
    incomeVerified: true,
  },
  {
    tenantRef: 'DEMO-T3',
    displayName: 'Amina Hassan',
    email: 'amina.hassan.demo@example.com',
    phone: '+254 711 100 203',
    status: 'ACTIVE' as const,
    employer: 'UNON',
    jobTitle: 'Programme Officer',
    incomeVerified: true,
  },
  {
    tenantRef: 'DEMO-T4',
    displayName: 'Kevin Njoroge',
    email: 'kevin.njoroge.demo@example.com',
    phone: '+254 720 100 204',
    status: 'APPLICANT' as const,
    employer: 'Andela Kenya',
    jobTitle: 'Software Engineer',
    incomeVerified: false,
  },
  {
    tenantRef: 'DEMO-T5',
    displayName: 'Faith Mutiso',
    email: 'faith.mutiso.demo@example.com',
    phone: '+254 745 100 205',
    status: 'PROSPECT' as const,
    employer: 'Deloitte Kenya',
    jobTitle: 'Audit Associate',
    incomeVerified: false,
  },
];

/**
 * Seed a realistic portfolio for the actor's org, shaped by org kind:
 *   LANDLORD              — self-linked owner party, owned portfolio
 *   PROPERTY_MANAGEMENT   — third-party owners + ACTIVE mgmt agreements
 *   MAINTENANCE_COMPANY   — owner + agreements + caretaker staff assignment
 *   MARKETING_AGENT       — owned portfolio + full leasing stack
 * All kinds get 3 properties (with real photo galleries + tour video),
 * buildings/units, tenants, applications, and ACTIVE/SCHEDULED/DRAFT leases.
 */
export async function seedDemoData(actor: ScopeActor): Promise<DemoSeedSummary> {
  const organizationId = actor.organizationId;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { kind: true, name: true },
  });
  if (!org) throw new RouteError(404, 'Organization not found');
  const kind = org.kind ?? 'LANDLORD';

  // Idempotent: always replace a previous demo run.
  await wipeDemoData(actor);

  const summary = await db.$transaction(
    async (tx) => {
      // ── owner parties (kind-shaped) ────────────────────────────────────────
      const wantsThirdPartyOwners = kind === 'PROPERTY_MANAGEMENT' || kind === 'MAINTENANCE_COMPANY';

      const selfParty = await tx.propertyOwnerParty.create({
        data: {
          organizationId,
          partyType: 'ORGANIZATION',
          name: `${DEMO_OWNER_PREFIX}${org.name}`,
          linkedOrganizationId: organizationId,
          email: null,
        },
      });

      const externalCompany = wantsThirdPartyOwners
        ? await tx.propertyOwnerParty.create({
            data: {
              organizationId,
              partyType: 'COMPANY',
              name: `${DEMO_OWNER_PREFIX}Katiba Investments Ltd`,
              email: 'owners@katiba-investments.example.com',
              phone: '+254 720 500 100',
              kraPin: 'P051234567X',
              addressLine1: 'Kilima House, Kiambu Road',
              city: 'Nairobi',
              region: 'Nairobi',
              country: 'KE',
            },
          })
        : null;

      const externalPerson =
        kind === 'PROPERTY_MANAGEMENT'
          ? await tx.propertyOwnerParty.create({
              data: {
                organizationId,
                partyType: 'PERSON',
                name: `${DEMO_OWNER_PREFIX}Joseph Mwangi`,
                email: 'joseph.mwangi.owner.demo@example.com',
                phone: '+254 722 300 400',
                city: 'Nairobi',
                country: 'KE',
              },
            })
          : null;

      // ── properties + buildings + units ────────────────────────────────────
      const propertyIds: string[] = [];
      const allUnitIds: string[] = [];
      const unitIdByRef = new Map<string, string>();
      const propertyIdByCode = new Map<string, string>();

      let unitCursor = 0;
      for (const plan of PROPERTY_PLANS) {
        const property = await tx.property.create({
          data: {
            portfolioOrganizationId: organizationId,
            code: plan.code,
            name: plan.name,
            description: plan.description,
            category: plan.category,
            propertyType: plan.propertyType,
            status: 'ACTIVE',
            tags: [DEMO_TAG],
            currency: 'KES',
            addressLine1: plan.addressLine1,
            locality: plan.locality,
            region: 'Nairobi',
            country: 'KE',
            latitude: plan.latitude,
            longitude: plan.longitude,
            videoUrl: plan.videoUrl ?? null,
            yearBuilt: plan.yearBuilt,
            amenities: plan.amenities,
            defaults: { rentFrequency: 'MONTHLY', depositMonths: 2, noticeDays: 30 },
          },
        });
        propertyIds.push(property.id);
        propertyIdByCode.set(plan.code, property.id);

        for (const b of plan.buildings ?? []) {
          const building = await tx.building.create({
            data: {
              organizationId,
              propertyId: property.id,
              code: b.code,
              name: b.name,
              floors: b.floors,
            },
          });
          for (const u of b.units) {
            const unit = await tx.unit.create({
              data: {
                organizationId,
                propertyId: property.id,
                buildingId: building.id,
                unitRef: u.unitRef,
                label: u.label,
                unitType: u.unitType,
                floor: u.floor ?? null,
                bedrooms: u.bedrooms ?? null,
                bathrooms: u.bathrooms ?? null,
                status: u.status ?? 'VACANT',
                defaultRent: u.defaultRent,
                currency: 'KES',
                billingFrequency: 'MONTHLY',
                depositDefault: 2,
                amenities: u.amenities ?? [],
              },
            });
            allUnitIds.push(unit.id);
            unitIdByRef.set(u.unitRef, unit.id);
            unitCursor += 1;
          }
        }

        for (const u of plan.looseUnits ?? []) {
          const unit = await tx.unit.create({
            data: {
              organizationId,
              propertyId: property.id,
              buildingId: null,
              unitRef: u.unitRef,
              label: u.label,
              unitType: u.unitType,
              floor: u.floor ?? null,
              bedrooms: u.bedrooms ?? null,
              bathrooms: u.bathrooms ?? null,
              status: u.status ?? 'VACANT',
              defaultRent: u.defaultRent,
              currency: 'KES',
              billingFrequency: 'MONTHLY',
              depositDefault: 2,
              amenities: u.amenities ?? [],
            },
          });
          allUnitIds.push(unit.id);
          unitIdByRef.set(u.unitRef, unit.id);
          unitCursor += 1;
        }

        // gallery — real CDN photos, first row is the cover
        let sortOrder = 0;
        for (const p of plan.photos) {
          const doc = await tx.propertyDocument.create({
            data: {
              organizationId,
              propertyId: property.id,
              entityType: 'PROPERTY',
              entityId: property.id,
              kind: 'PHOTO',
              storageKey: p.url,
              fileName: `${plan.code.toLowerCase()}-photo-${sortOrder + 1}.jpg`,
              mimeType: 'image/jpeg',
              sizeBytes: 240_000 + sortOrder * 15_000,
              caption: p.caption,
              sortOrder,
              isCover: sortOrder === 0,
            },
          });
          await tx.documentVersion.create({
            data: {
              documentId: doc.id,
              version: 1,
              storageKey: doc.storageKey,
              fileName: doc.fileName,
              mimeType: doc.mimeType,
              sizeBytes: doc.sizeBytes,
            },
          });
          sortOrder += 1;
        }

        // title deed — bucket-style key (renders as a file row, not an image)
        const deed = await tx.propertyDocument.create({
          data: {
            organizationId,
            propertyId: property.id,
            entityType: 'PROPERTY',
            entityId: property.id,
            kind: 'TITLE_DEED',
            storageKey: `demo/${plan.code.toLowerCase()}/title-deed.pdf`,
            fileName: `${plan.code}-title-deed.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 1_800_000,
            caption: 'Certified title deed copy',
            sortOrder: 99,
            isCover: false,
          },
        });
        await tx.documentVersion.create({
          data: {
            documentId: deed.id,
            version: 1,
            storageKey: deed.storageKey,
            fileName: deed.fileName,
            mimeType: deed.mimeType,
            sizeBytes: deed.sizeBytes,
          },
        });
      }

      // ── ownerships (every property) + agreements (PM/MM) ──────────────────
      const primaryOwner = externalCompany ?? selfParty;
      const agreements = [];
      for (const propertyId of propertyIds) {
        await tx.propertyOwnership.create({
          data: {
            organizationId,
            propertyId,
            unitId: null,
            ownerPartyId: primaryOwner.id,
            sharePercent: 100,
            startsAt: new Date('2024-01-01'),
          },
        });

        // Second-owner split on the villa for the multi-investor shape (PM).
        if (externalPerson && propertyId === propertyIdByCode.get('DEMO-002')) {
          await tx.propertyOwnership.create({
            data: {
              organizationId,
              propertyId,
              unitId: null,
              ownerPartyId: externalPerson.id,
              sharePercent: 40,
              startsAt: new Date('2024-06-01'),
            },
          });
          // trim the primary to a 60/40 split
          await tx.propertyOwnership.updateMany({
            where: { organizationId, propertyId, ownerPartyId: primaryOwner.id },
            data: { sharePercent: 60 },
          });
        }

        if (wantsThirdPartyOwners) {
          agreements.push(
            await tx.propertyManagementAgreement.create({
              data: {
                organizationId,
                propertyId,
                managementOrganizationId: organizationId,
                ownerPartyId: primaryOwner.id,
                status: 'ACTIVE',
                startsAt: new Date('2024-01-01'),
                scope: { services: ['Letting', 'Rent collection', 'Maintenance coordination'] },
              },
            }),
          );
        }
      }

      // caretaker assignment (MM) — the actor themselves as site caretaker
      if (kind === 'MAINTENANCE_COMPANY' && propertyIds[0]) {
        await tx.propertyStaffAssignment.create({
          data: {
            organizationId,
            propertyId: propertyIds[0],
            userId: actor.userId,
            title: 'Site caretaker',
            isActive: true,
          },
        });
      }

      // ── tenants ───────────────────────────────────────────────────────────
      const tenants = [];
      for (const t of TENANT_PLANS) {
        tenants.push(
          await tx.tenant.create({
            data: {
              organizationId,
              tenantRef: t.tenantRef,
              displayName: t.displayName,
              partyType: 'PERSON',
              email: t.email,
              phone: t.phone,
              idType: 'NATIONAL_ID',
              idNumber: `2${String(10000000 + unitCursor * 7).slice(0, 8)}`,
              nationality: 'Kenyan',
              kraPin: `A${String(10000000 + unitCursor * 3).slice(0, 8)}X`,
              employer: t.employer,
              jobTitle: t.jobTitle,
              incomeVerified: t.incomeVerified,
              city: 'Nairobi',
              preferredChannel: 'WHATSAPP',
              status: t.status,
            },
          }),
        );
      }
      // TENANT_PLANS is a fixed 5-row literal — destructure with asserts.
      const t1 = tenants[0]!;
      const t2 = tenants[1]!;
      const t3 = tenants[2]!;
      const t4 = tenants[3]!;

      const now = Date.now();
      const day = 86_400_000;
      const twoMonthsAgo = new Date(now - 60 * day);
      const tenMonthsOut = new Date(now + 300 * day);
      const nextMonth = new Date(now + 30 * day);
      const thirteenMonthsOut = new Date(now + 390 * day);

      // ── leases ────────────────────────────────────────────────────────────
      const kilimaniId = propertyIdByCode.get('DEMO-001')!;
      const villaId = propertyIdByCode.get('DEMO-002')!;
      const plazaId = propertyIdByCode.get('DEMO-003')!;

      // ACTIVE — Kilimani B-301 → Wanjiku
      const lease1 = await tx.lease.create({
        data: {
          organizationId,
          propertyId: kilimaniId,
          leaseRef: 'DEMO-L1',
          status: 'ACTIVE',
          startsAt: twoMonthsAgo,
          endsAt: tenMonthsOut,
          signedAt: twoMonthsAgo,
          currency: 'KES',
          billingFrequency: 'MONTHLY',
          paymentDueDay: 5,
          depositMonths: 2,
          noticeDays: 30,
          autoRenew: false,
          units: {
            create: [
              {
                organizationId,
                unitId: unitIdByRef.get('B-301')!,
                monthlyRent: 85000,
                currency: 'KES',
                billingFrequency: 'MONTHLY',
              },
            ],
          },
          parties: {
            create: [
              { organizationId, tenantId: t1.id, relationship: 'PRIMARY' },
            ],
          },
        },
      });

      // ACTIVE — Villa VILLA-1 → Brian
      const lease2 = await tx.lease.create({
        data: {
          organizationId,
          propertyId: villaId,
          leaseRef: 'DEMO-L2',
          status: 'ACTIVE',
          startsAt: twoMonthsAgo,
          endsAt: tenMonthsOut,
          signedAt: twoMonthsAgo,
          currency: 'KES',
          billingFrequency: 'MONTHLY',
          paymentDueDay: 1,
          depositMonths: 3,
          noticeDays: 90,
          autoRenew: false,
          units: {
            create: [
              {
                organizationId,
                unitId: unitIdByRef.get('VILLA-1')!,
                monthlyRent: 250000,
                currency: 'KES',
                billingFrequency: 'MONTHLY',
              },
            ],
          },
          parties: {
            create: [
              { organizationId, tenantId: t2.id, relationship: 'PRIMARY' },
            ],
          },
        },
      });

      // SCHEDULED — Plaza APT-4B → Amina, starts next month
      const lease3 = await tx.lease.create({
        data: {
          organizationId,
          propertyId: plazaId,
          leaseRef: 'DEMO-L3',
          status: 'SCHEDULED',
          startsAt: nextMonth,
          endsAt: thirteenMonthsOut,
          signedAt: new Date(now - 3 * day),
          currency: 'KES',
          billingFrequency: 'MONTHLY',
          paymentDueDay: 7,
          depositMonths: 2,
          noticeDays: 30,
          units: {
            create: [
              {
                organizationId,
                unitId: unitIdByRef.get('APT-4B')!,
                monthlyRent: 95000,
                currency: 'KES',
                billingFrequency: 'MONTHLY',
              },
            ],
          },
          parties: {
            create: [
              { organizationId, tenantId: t3.id, relationship: 'PRIMARY' },
            ],
          },
        },
      });

      // DRAFT — Kilimani A-101 → Kevin (not yet occupying)
      await tx.lease.create({
        data: {
          organizationId,
          propertyId: kilimaniId,
          leaseRef: 'DEMO-L4',
          status: 'DRAFT',
          startsAt: nextMonth,
          endsAt: thirteenMonthsOut,
          currency: 'KES',
          billingFrequency: 'MONTHLY',
          paymentDueDay: 5,
          depositMonths: 2,
          noticeDays: 30,
          units: {
            create: [
              {
                organizationId,
                unitId: unitIdByRef.get('A-101')!,
                monthlyRent: 45000,
                currency: 'KES',
                billingFrequency: 'MONTHLY',
              },
            ],
          },
          parties: {
            create: [
              { organizationId, tenantId: t4.id, relationship: 'PRIMARY' },
            ],
          },
        },
      });

      // ── applications ──────────────────────────────────────────────────────
      // APPROVED → linked to the scheduled lease (Amina / APT-4B)
      await tx.rentalApplication.create({
        data: {
          organizationId,
          propertyId: plazaId,
          unitId: unitIdByRef.get('APT-4B')!,
          applicantTenantId: t3.id,
          status: 'APPROVED',
          incomeVerified: true,
          submittedAt: new Date(now - 14 * day),
          decidedAt: new Date(now - 3 * day),
          leaseId: lease3.id,
          internalNotes: 'Verified employment letter and 6-month bank statements.',
        },
      });
      // SUBMITTED → awaiting review (Kevin / A-102)
      await tx.rentalApplication.create({
        data: {
          organizationId,
          propertyId: kilimaniId,
          unitId: unitIdByRef.get('A-102')!,
          applicantTenantId: t4.id,
          status: 'SUBMITTED',
          incomeVerified: false,
          submittedAt: new Date(now - 2 * day),
        },
      });

      // tenant screening docs (PII-gated entity type)
      for (const tenant of [t1, t2, t3]) {
        const ref = tenant.tenantRef ?? tenant.id.slice(0, 8);
        const doc = await tx.propertyDocument.create({
          data: {
            organizationId,
            propertyId: null,
            entityType: 'TENANT',
            entityId: tenant.id,
            kind: 'PHOTO_ID',
            storageKey: `demo/tenants/${ref.toLowerCase()}/national-id.pdf`,
            fileName: `${ref}-national-id.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 420_000,
            caption: 'National ID copy',
          },
        });
        await tx.documentVersion.create({
          data: {
            documentId: doc.id,
            version: 1,
            storageKey: doc.storageKey,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes,
          },
        });
      }

      // signed tenancy agreements (LEASE entity docs)
      for (const lease of [lease1, lease2]) {
        const ref = lease.leaseRef ?? lease.id.slice(0, 8);
        const doc = await tx.propertyDocument.create({
          data: {
            organizationId,
            propertyId: lease.propertyId,
            entityType: 'LEASE',
            entityId: lease.id,
            kind: 'TENANCY_AGREEMENT',
            storageKey: `demo/leases/${ref.toLowerCase()}/signed-agreement.pdf`,
            fileName: `${ref}-signed-agreement.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 950_000,
            caption: 'Signed tenancy agreement',
          },
        });
        await tx.documentVersion.create({
          data: {
            documentId: doc.id,
            version: 1,
            storageKey: doc.storageKey,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes,
          },
        });
      }

      // ── return — occupancy recompute runs AFTER commit (it uses the global
      // client, which cannot see uncommitted rows from inside this tx) ──────
      return {
        kind,
        properties: propertyIds.length,
        buildings: PROPERTY_PLANS.reduce((n, p) => n + (p.buildings?.length ?? 0), 0),
        units: allUnitIds.length,
        documents:
          PROPERTY_PLANS.length * (APARTMENT_PHOTOS.length + 1) + // photos + deed per plan
          3 + // tenant IDs
          2, // signed agreements
        leases: 4,
        applications: 2,
        agreements: agreements.length,
        ownerships: propertyIds.length + (externalPerson ? 1 : 0),
        staffAssignments: kind === 'MAINTENANCE_COMPANY' ? 1 : 0,
        tenants: tenants.length,
        ownerParties: 1 + (externalCompany ? 1 : 0) + (externalPerson ? 1 : 0),
        unitIds: allUnitIds,
      };
    },
    { timeout: 30_000 },
  );

  // Occupancy cache — flip VACANT/OCCUPIED to match the committed leases.
  await recomputeUnitStatus(summary.unitIds);
  const publicSummary: DemoSeedSummary = {
    kind: summary.kind,
    properties: summary.properties,
    buildings: summary.buildings,
    units: summary.units,
    documents: summary.documents,
    leases: summary.leases,
    applications: summary.applications,
    agreements: summary.agreements,
    ownerships: summary.ownerships,
    staffAssignments: summary.staffAssignments,
    tenants: summary.tenants,
    ownerParties: summary.ownerParties,
  };

  await auditLog(actor, 'ORGANIZATION', 'demo.seed', organizationId, {
    kind,
    properties: publicSummary.properties,
    units: publicSummary.units,
    tenants: publicSummary.tenants,
    leases: publicSummary.leases,
  });

  return publicSummary;
}
