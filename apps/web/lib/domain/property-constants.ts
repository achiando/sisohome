/**
 * Client-safe property-domain constants (options + validation helpers).
 *
 * Import-safe for browser components: only TYPE imports from
 * '@workspace/database' (type-only imports are erased — the package index
 * instantiates the Prisma client at runtime and must never enter a client
 * bundle). Value lists mirror the schema enums; the server re-validates
 * membership before any write.
 */

import type {
  AreaUnit,
  BillingFrequency,
  PropertyCategory,
  PropertyCondition,
  PropertyStatus,
  PropertyType,
  RateClearanceStatus,
  TitleType,
} from '@workspace/database';

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

export const PROPERTY_CATEGORIES: Option<PropertyCategory>[] = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'LAND', label: 'Land / plots' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'MIXED_USE', label: 'Mixed use' },
  { value: 'SPECIAL', label: 'Special purpose' },
];

/** propertyType options filtered by category (schema enum grouping). */
export const PROPERTY_TYPES_BY_CATEGORY: Record<PropertyCategory, Option<PropertyType>[]> = {
  RESIDENTIAL: [
    { value: 'APARTMENT_BLOCK', label: 'Apartment block' },
    { value: 'APARTMENT', label: 'Apartment' },
    { value: 'HOUSE', label: 'House' },
    { value: 'TOWNHOUSE', label: 'Townhouse' },
    { value: 'VILLA', label: 'Villa' },
    { value: 'MAISONETTE', label: 'Maisonette' },
    { value: 'BEDSITTER', label: 'Bedsitter' },
    { value: 'SERVICED_APARTMENT', label: 'Serviced apartment' },
    { value: 'GUEST_HOUSE', label: 'Guest house' },
    { value: 'STUDENT_HOUSING', label: 'Student housing' },
    { value: 'RETIREMENT_HOME', label: 'Retirement home' },
  ],
  LAND: [
    { value: 'RESIDENTIAL_PLOT', label: 'Residential plot' },
    { value: 'COMMERCIAL_PLOT', label: 'Commercial plot' },
    { value: 'AGRICULTURAL_LAND', label: 'Agricultural land' },
    { value: 'INDUSTRIAL_PLOT', label: 'Industrial plot' },
    { value: 'MIXED_PLOT', label: 'Mixed plot' },
    { value: 'FARM', label: 'Farm' },
  ],
  COMMERCIAL: [
    { value: 'OFFICE_BUILDING', label: 'Office building' },
    { value: 'RETAIL_SHOP', label: 'Retail shop' },
    { value: 'MALL', label: 'Mall' },
    { value: 'STRIP_CENTER', label: 'Strip centre' },
    { value: 'RESTAURANT', label: 'Restaurant' },
    { value: 'BANK_BRANCH', label: 'Bank branch' },
    { value: 'MIXED_COMMERCIAL', label: 'Mixed commercial' },
  ],
  INDUSTRIAL: [
    { value: 'WAREHOUSE', label: 'Warehouse' },
    { value: 'FACTORY', label: 'Factory' },
    { value: 'WORKSHOP', label: 'Workshop' },
    { value: 'YARD', label: 'Yard' },
    { value: 'SILO', label: 'Silo' },
  ],
  MIXED_USE: [
    { value: 'APARTMENT_BLOCK', label: 'Apartment block' },
    { value: 'HOUSE', label: 'House' },
    { value: 'TOWNHOUSE', label: 'Townhouse' },
    { value: 'OFFICE_BUILDING', label: 'Office building' },
    { value: 'RETAIL_SHOP', label: 'Retail shop' },
    { value: 'MALL', label: 'Mall' },
    { value: 'MIXED_COMMERCIAL', label: 'Mixed commercial' },
    { value: 'WAREHOUSE', label: 'Warehouse' },
    { value: 'RESIDENTIAL_PLOT', label: 'Residential plot' },
    { value: 'COMMERCIAL_PLOT', label: 'Commercial plot' },
    { value: 'MIXED_PLOT', label: 'Mixed plot' },
  ],
  SPECIAL: [
    { value: 'HOTEL', label: 'Hotel' },
    { value: 'HOSPITAL', label: 'Hospital' },
    { value: 'SCHOOL', label: 'School' },
    { value: 'CHURCH', label: 'Church' },
    { value: 'PETROL_STATION', label: 'Petrol station' },
    { value: 'PARKING_GARAGE', label: 'Parking garage' },
    { value: 'STORAGE_FACILITY', label: 'Storage facility' },
  ],
};

export function typesForCategory(category: string | null | undefined): Option<PropertyType>[] {
  if (category && category in PROPERTY_TYPES_BY_CATEGORY) {
    return PROPERTY_TYPES_BY_CATEGORY[category as PropertyCategory];
  }
  return Object.values(PROPERTY_TYPES_BY_CATEGORY).flat();
}

export const PROPERTY_STATUSES: Option<PropertyStatus>[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ARCHIVED', label: 'Archived' },
];

/** Statuses editable inline on the form (ARCHIVED only via archive/unarchive). */
export const PROPERTY_EDITABLE_STATUSES = PROPERTY_STATUSES.filter((s) => s.value !== 'ARCHIVED');

export const TITLE_TYPES: Option<TitleType>[] = [
  { value: 'FREEHOLD', label: 'Freehold' },
  { value: 'LEASEHOLD', label: 'Leasehold' },
  { value: 'SECTIONAL_TITLE', label: 'Sectional title (strata)' },
  { value: 'CUSTOMARY', label: 'Customary' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

export const RATE_CLEARANCE_STATUSES: Option<RateClearanceStatus>[] = [
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'CLEARED', label: 'Cleared' },
  { value: 'OUTSTANDING', label: 'Outstanding' },
];

export const AREA_UNITS: Option<AreaUnit>[] = [
  { value: 'SQM', label: 'm²' },
  { value: 'SQFT', label: 'ft²' },
  { value: 'ACRE', label: 'Acres' },
  { value: 'HECTARE', label: 'Hectares' },
];

export const PROPERTY_CONDITIONS: Option<PropertyCondition>[] = [
  { value: 'NEW', label: 'New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'NEEDS_WORK', label: 'Needs work' },
];

export const RENT_FREQUENCIES: Option<BillingFrequency>[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUALLY', label: 'Annually' },
];

export const AMENITY_OPTIONS: string[] = [
  'Parking',
  '24h security',
  'CCTV',
  'Borehole',
  'Solar backup',
  'Generator',
  'Lift',
  'Gym',
  'Swimming pool',
  'Garden',
  'Gated compound',
  'High-speed internet',
  'Furnished',
  'Pet friendly',
];

export const UTILITY_OPTIONS: string[] = [
  'Electricity',
  'Water',
  'Sewer',
  'Gas',
  'Fibre internet',
  'Tarmac road',
  'All-weather road',
  'Street lighting',
];

/** Shape of `Property.defaults` (Json) — property.md §2 property-level defaults. */
export interface PropertyDefaultsInput {
  rentFrequency?: BillingFrequency;
  depositMonths?: number;
  lateFeeRule?: string;
  noticeDays?: number;
  serviceChargeRate?: number;
}
