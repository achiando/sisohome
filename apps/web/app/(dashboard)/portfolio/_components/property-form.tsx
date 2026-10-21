'use client'

/**
 * PropertyForm — THE reference shared form (plan-api-ui.md §C.1).
 *
 * One component, identical tree for create AND edit (`mode` prop), wizard
 * variant in both. The PAGE owns fetching/navigation; this component owns
 * values state, per-step + final validation, and assembles the payload
 * (tags split, defaults object built from flat fields, ownership/agreement
 * extension objects for non-landlord creates).
 *
 * Account-type awareness (`orgKind`, from GET /api/organization/current):
 * - LANDLORD create → 5 steps (Identity, Location, Structure, Media,
 *   Legal & defaults). No ownership step — the SERVER auto-links the org as
 *   its own 100% owner in the create transaction. Status select never shows
 *   on create (always starts DRAFT); it appears on edit as the activation
 *   path.
 * - non-landlord create → 6 steps: an "Owner & agreement" step is required
 *   (existing owner party, inline create, or — PM/MM only — a draft
 *   management agreement). MARKETING_AGENT gets the owner step without the
 *   agreement block (it never manages).
 * - edit → ownership step only when the page can offer "Link this
 *   organization" (no owner linked yet); otherwise skipped — ownership and
 *   agreement mutations live on their own tabs (audit trail).
 *
 * Media: a `file` field uploads straight to Cloudinary via POST /api/uploads
 * while the step is open; the PAGE registers the resulting URLs as
 * PropertyDocument rows after POST/PATCH (first new photo becomes cover when
 * the gallery is empty).
 *
 * Wizard note: UniversalForm does NOT run `onValidateStep` on the final
 * submit — `handleSubmit` re-runs ALL step validators (catches fields
 * cleared after Back) and shows a summary Alert before delegating.
 */

import { useMemo, useState } from 'react'
import type { Property } from '@workspace/database'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Input } from '@workspace/ui/components/input'
import { UniversalForm } from '@workspace/ui/components/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import type { FieldDef, UploadedFile, WizardStep } from '@workspace/ui/types/components'

import { hasMapPin } from '@/lib/maps'
import { cloudinaryUploadHandler } from '@/lib/upload'
import {
  AMENITY_OPTIONS,
  AREA_UNITS,
  PROPERTY_CATEGORIES,
  PROPERTY_CONDITIONS,
  PROPERTY_EDITABLE_STATUSES,
  RATE_CLEARANCE_STATUSES,
  RENT_FREQUENCIES,
  TITLE_TYPES,
  UTILITY_OPTIONS,
  typesForCategory,
} from '@/lib/domain/property-constants'

export type PropertyFormValues = Record<string, unknown>

export type OrgKind =
  | 'LANDLORD'
  | 'PROPERTY_MANAGEMENT'
  | 'MAINTENANCE_COMPANY'
  | 'MARKETING_AGENT'

export interface OwnerOption {
  value: string
  label: string
}

/** Read-only ownership card payload (edit mode) — computed by the page. */
export interface OwnershipSummary {
  ownerName: string
  ownerPartyType: string | null
  sharePercent: number | string | null
  startsAt: string | null
  agreement: {
    status: string
    startsAt: string
    endsAt: string | null
    managerName: string | null
  } | null
}

export interface PropertyFormProps {
  mode: 'create' | 'edit'
  /** Active org kind — drives step branching. Defaults to LANDLORD. */
  orgKind?: OrgKind | null
  /** Owner-party picker options (non-landlord create). */
  ownerOptions?: OwnerOption[]
  /** Preselected owner when the directory holds exactly one party. */
  defaultOwnerPartyId?: string
  /** Edit-mode read-only ownership card (null = not linked yet). */
  ownershipSummary?: OwnershipSummary | null
  /** Edit-mode action when no owner is linked (landlord legacy rows). */
  onLinkSelf?: () => void | Promise<void>
  /** Property id (edit) — upload folder + registration happen on the page. */
  propertyId?: string
  /** Existing gallery URLs shown on the Media step (edit). */
  existingMediaUrls?: string[]
  initialValues?: Partial<Property> | null
  saving?: boolean
  serverErrors?: Record<string, string>
  /** Page performs the POST/PATCH, document registration, toast, navigation. */
  onSubmit: (values: PropertyFormValues) => void | Promise<void>
  onCancel: () => void
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  return String(v)
}

function decimalStr(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : str(v)
}

function dateInput(v: unknown): string {
  if (!v) return ''
  const d = new Date(str(v))
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/** Seed the full value map — used by BOTH create (defaults) and edit (fetch). */
export function seedPropertyValues(p?: Partial<Property> | null): PropertyFormValues {
  const defaults = (p?.defaults ?? {}) as Record<string, unknown>
  return {
    name: p?.name ?? '',
    code: p?.code ?? '',
    description: p?.description ?? '',
    category: p?.category ?? 'RESIDENTIAL',
    propertyType: p?.propertyType ?? '',
    status: p?.status ?? 'DRAFT',
    tags: Array.isArray(p?.tags) ? p.tags.join(', ') : '',
    currency: p?.currency ?? 'KES',

    addressLine1: p?.addressLine1 ?? '',
    addressLine2: p?.addressLine2 ?? '',
    locality: p?.locality ?? '',
    region: p?.region ?? '',
    postalCode: p?.postalCode ?? '',
    country: p?.country ?? 'KE',
    latitude: p?.latitude != null ? decimalStr(p.latitude) : '',
    longitude: p?.longitude != null ? decimalStr(p.longitude) : '',
    directionsNote: p?.directionsNote ?? '',
    landmark: p?.landmark ?? '',

    yearBuilt: p?.yearBuilt ?? '',
    yearRenovated: p?.yearRenovated ?? '',
    floors: p?.floors ?? '',
    parkingSpaces: p?.parkingSpaces ?? '',
    plotSizeValue: p?.plotSizeValue != null ? decimalStr(p.plotSizeValue) : '',
    plotSizeUnit: p?.plotSizeUnit ?? '',
    buildingAreaValue: p?.buildingAreaValue != null ? decimalStr(p.buildingAreaValue) : '',
    buildingAreaUnit: p?.buildingAreaUnit ?? '',
    condition: p?.condition ?? '',
    amenities: Array.isArray(p?.amenities) ? [...p.amenities] : [],
    utilities: Array.isArray(p?.utilities) ? [...p.utilities] : [],

    titleType: p?.titleType ?? '',
    titleNumber: p?.titleNumber ?? '',
    registryReference: p?.registryReference ?? '',
    surveyPlanNumber: p?.surveyPlanNumber ?? '',
    landControlArea: p?.landControlArea ?? '',
    zoning: p?.zoning ?? '',
    rateClearanceStatus: p?.rateClearanceStatus ?? '',
    rateClearanceExpiresAt: dateInput(p?.rateClearanceExpiresAt),
    encumbrances: p?.encumbrances ?? '',

    rentFrequency: defaults.rentFrequency ?? '',
    depositMonths: defaults.depositMonths ?? '',
    noticeDays: defaults.noticeDays ?? '',
    serviceChargeRate: defaults.serviceChargeRate ?? '',
    lateFeeRule: defaults.lateFeeRule ?? '',

    virtualTourUrl: p?.virtualTourUrl ?? '',
    videoUrl: p?.videoUrl ?? '',

    // Media (new uploads; existing gallery arrives via existingMediaUrls)
    media: [],

    // Ownership & agreement (create, non-landlord only — validated there)
    ownerPartyId: '',
    ownerPartyType: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    ownerKraPin: '',
    agreementEnabled: false,
    agreementStartsAt: new Date().toISOString().slice(0, 10),
    agreementEndsAt: '',
  }
}

function selectOptions(
  opts: { value: string; label: string }[],
): { value: string; label: string }[] {
  return opts
}

// ── step validators (id-keyed — step indices shift by account type) ─────────

function validateIdentity(v: PropertyFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.name).trim()) errs.name = 'Property name is required'
  if (!str(v.category)) errs.category = 'Category is required'
  if (!str(v.propertyType)) errs.propertyType = 'Select a property type'
  if (
    str(v.status) === 'ACTIVE' &&
    str(v.category) === 'LAND' &&
    !(hasMapPin(v.latitude, v.longitude) && str(v.titleNumber).trim())
  ) {
    errs.status = 'Land needs a map pin and title number before activation (set them in later steps)'
  }
  return errs
}

function validateLocation(v: PropertyFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!str(v.addressLine1).trim()) errs.addressLine1 = 'Street address is required'
  if (!str(v.locality).trim()) errs.locality = 'Locality / area is required'
  if (!str(v.country).trim()) errs.country = 'Country is required'
  const lat = str(v.latitude).trim()
  const lng = str(v.longitude).trim()
  if (lat !== '' || lng !== '') {
    if (lat === '' || lng === '') {
      errs.latitude = 'Enter both latitude and longitude (or clear both)'
    } else if (!hasMapPin(Number(lat), Number(lng))) {
      errs.latitude = 'Invalid pin — latitude −90…90, longitude −180…180; (0, 0) is not a real pin'
    }
  }
  return errs
}

function validateMedia(v: PropertyFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  const files = Array.isArray(v.media) ? (v.media as UploadedFile[]) : []
  if (files.some((f) => f.status === 'uploading')) {
    errs.media = 'Wait for the uploads to finish'
  } else if (files.some((f) => f.status === 'error')) {
    errs.media = 'Remove failed uploads before continuing'
  }
  return errs
}

function validateOwnership(
  v: PropertyFormValues,
  opts: { mode: 'create' | 'edit'; canAgreement: boolean },
): Record<string, string> {
  const errs: Record<string, string> = {}
  if (opts.mode === 'edit') return errs // read-only card

  const owner = str(v.ownerPartyId)
  if (!owner) errs.ownerPartyId = 'Select an owner or create one'
  if (owner === '__create__') {
    if (!str(v.ownerName).trim()) errs.ownerName = 'Owner name is required'
    if (!str(v.ownerPartyType)) errs.ownerPartyType = 'Select a party type'
    const email = str(v.ownerEmail).trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.ownerEmail = 'Invalid email'
  }
  if (opts.canAgreement && v.agreementEnabled === true) {
    const starts = str(v.agreementStartsAt)
    if (!starts) errs.agreementStartsAt = 'Start date is required'
    const ends = str(v.agreementEndsAt)
    if (starts && ends && new Date(ends) <= new Date(starts)) {
      errs.agreementEndsAt = 'End date must be after the start date'
    }
  }
  return errs
}

function validateLegal(v: PropertyFormValues): Record<string, string> {
  const errs: Record<string, string> = {}
  const raw = str(v.rateClearanceExpiresAt)
  if (raw) {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) {
      errs.rateClearanceExpiresAt = 'Invalid date'
    } else if (d.getTime() < Date.now() - 86_400_000) {
      errs.rateClearanceExpiresAt = 'Rate clearance expiry must be in the future'
    }
  }
  return errs
}

function buildDefaults(v: PropertyFormValues): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  if (str(v.rentFrequency)) out.rentFrequency = str(v.rentFrequency)
  if (str(v.depositMonths) !== '') out.depositMonths = Number(v.depositMonths)
  if (str(v.noticeDays) !== '') out.noticeDays = Number(v.noticeDays)
  if (str(v.serviceChargeRate) !== '') out.serviceChargeRate = Number(v.serviceChargeRate)
  if (str(v.lateFeeRule).trim()) out.lateFeeRule = str(v.lateFeeRule).trim()
  return Object.keys(out).length > 0 ? out : null
}

function splitTags(v: unknown): string[] {
  return str(v)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}

// ── ownership step content (custom — conditional by account type) ───────────

function OwnershipStepContent({
  mode,
  orgKind,
  values,
  errors,
  onChange,
  ownerOptions,
  summary,
  onLinkSelf,
}: {
  mode: 'create' | 'edit'
  orgKind: OrgKind
  values: PropertyFormValues
  errors: Record<string, string>
  onChange: (name: string, value: unknown) => void
  ownerOptions: OwnerOption[]
  summary?: OwnershipSummary | null
  onLinkSelf?: () => void | Promise<void>
}) {
  const err = (k: string) => (errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null)

  if (mode === 'edit') {
    if (!summary) {
      return (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No owner linked to this property yet.</p>
          {onLinkSelf ? (
            <Button variant="outline" size="sm" className="mt-4" onClick={onLinkSelf}>
              Link this organization
            </Button>
          ) : null}
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
          <p className="mt-1 font-medium text-foreground">{summary.ownerName}</p>
          <p className="text-sm text-muted-foreground">
            {summary.ownerPartyType ?? 'Party'}
            {' · '}
            {summary.sharePercent != null ? `${summary.sharePercent}% share` : 'share not recorded'}
          </p>
          {summary.startsAt ? (
            <p className="mt-1 text-xs text-muted-foreground">Linked {fmtDate(summary.startsAt)}</p>
          ) : null}
        </div>
        {summary.agreement ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Management agreement
              </p>
              <Badge
                variant={
                  summary.agreement.status === 'ACTIVE'
                    ? 'success'
                    : summary.agreement.status === 'DRAFT'
                      ? 'info'
                      : 'neutral'
                }
                shape="pill"
                size="sm"
              >
                {summary.agreement.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-foreground">
              {fmtDate(summary.agreement.startsAt)}
              {summary.agreement.endsAt ? ` → ${fmtDate(summary.agreement.endsAt)}` : ' → open-ended'}
            </p>
            {summary.agreement.managerName ? (
              <p className="text-xs text-muted-foreground">Manager: {summary.agreement.managerName}</p>
            ) : null}
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Ownership and agreement changes are managed from the Ownership and Agreements tabs so
          every change is audited.
        </p>
      </div>
    )
  }

  // ── create mode ──────────────────────────────────────────────────────────
  const selected = str(values.ownerPartyId)
  const creating = selected === '__create__'
  const canAgreement = orgKind === 'PROPERTY_MANAGEMENT' || orgKind === 'MAINTENANCE_COMPANY'
  const agreementOn = values.agreementEnabled === true
  const partyTypes = [
    { value: 'PERSON', label: 'Person' },
    { value: 'COMPANY', label: 'Company' },
    { value: 'ASSOCIATION', label: 'Association / body corporate' },
    { value: 'ORGANIZATION', label: 'Organization' },
  ]

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="owner-party" className="text-sm font-medium text-foreground">
          Owner <span className="text-destructive">*</span>
        </label>
        <Select value={selected} onValueChange={(v) => onChange('ownerPartyId', v)}>
          <SelectTrigger id="owner-party" className="h-11 w-full rounded-xl">
            <SelectValue placeholder="Select an owner party…" />
          </SelectTrigger>
          <SelectContent>
            {ownerOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
            <SelectItem value="__create__">＋ Create a new owner…</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The owner of record — who the property belongs to, independently of who manages it.
        </p>
        {err('ownerPartyId')}
      </div>

      {creating ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="owner-party-type" className="text-sm font-medium text-foreground">
              Party type <span className="text-destructive">*</span>
            </label>
            <Select
              value={str(values.ownerPartyType)}
              onValueChange={(v) => onChange('ownerPartyType', v)}
            >
              <SelectTrigger id="owner-party-type" className="h-11 w-full rounded-xl">
                <SelectValue placeholder="Select a type…" />
              </SelectTrigger>
              <SelectContent>
                {partyTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err('ownerPartyType')}
          </div>
          <Input
            label="Owner name"
            required
            className="rounded-xl h-11"
            value={str(values.ownerName)}
            onChange={(e) => onChange('ownerName', e.target.value)}
            error={errors.ownerName}
            placeholder="Katiba Investments Ltd"
          />
          <Input
            label="Email"
            type="email"
            className="rounded-xl h-11"
            value={str(values.ownerEmail)}
            onChange={(e) => onChange('ownerEmail', e.target.value)}
            error={errors.ownerEmail}
          />
          <Input
            label="Phone"
            type="tel"
            className="rounded-xl h-11"
            value={str(values.ownerPhone)}
            onChange={(e) => onChange('ownerPhone', e.target.value)}
          />
          <Input
            label="KRA PIN"
            className="rounded-xl h-11"
            value={str(values.ownerKraPin)}
            onChange={(e) => onChange('ownerKraPin', e.target.value)}
            placeholder="P051234567X"
          />
        </div>
      ) : null}

      {canAgreement ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Checkbox
            label="Attach a management agreement"
            description="Draft an agreement now — your organization manages this property for the owner. Approve it from the Agreements tab."
            checked={agreementOn}
            onCheckedChange={(c) => onChange('agreementEnabled', c === true)}
          />
          {agreementOn ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Agreement starts"
                type="date"
                required
                className="rounded-xl h-11"
                value={str(values.agreementStartsAt)}
                onChange={(e) => onChange('agreementStartsAt', e.target.value)}
                error={errors.agreementStartsAt}
              />
              <Input
                label="Agreement ends (optional)"
                type="date"
                className="rounded-xl h-11"
                value={str(values.agreementEndsAt)}
                onChange={(e) => onChange('agreementEndsAt', e.target.value)}
                error={errors.agreementEndsAt}
              />
            </div>
          ) : null}
        </div>
      ) : orgKind === 'MARKETING_AGENT' ? (
        <p className="text-sm text-muted-foreground">
          Marketing agents record the owner only — management agreements are handled by the
          landlord or property manager.
        </p>
      ) : null}
    </div>
  )
}

// ── the form ────────────────────────────────────────────────────────────────

export function PropertyForm({
  mode,
  orgKind,
  ownerOptions = [],
  defaultOwnerPartyId,
  ownershipSummary,
  onLinkSelf,
  propertyId,
  existingMediaUrls,
  initialValues,
  saving = false,
  serverErrors,
  onSubmit,
  onCancel,
}: PropertyFormProps) {
  const [values, setValues] = useState<PropertyFormValues>(() => {
    const seeded = seedPropertyValues(initialValues)
    if (mode === 'create' && defaultOwnerPartyId) seeded.ownerPartyId = defaultOwnerPartyId
    return seeded
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)

  const kind: OrgKind = orgKind ?? 'LANDLORD'
  const isEdit = mode === 'edit'
  // Create (non-landlord): full owner & agreement step. Edit: the step only
  // appears when there's an ACTION to take (no owner linked + the page can
  // offer "Link this organization") — a read-only owner card would just be
  // filler, the Ownership/Management tabs already show and edit it.
  const showOwnership =
    (!isEdit && kind !== 'LANDLORD') ||
    (isEdit && !ownershipSummary && Boolean(onLinkSelf))
  const canAgreement = kind === 'PROPERTY_MANAGEMENT' || kind === 'MAINTENANCE_COMPANY'
  const category = str(values.category) || 'RESIDENTIAL'

  // Create: files upload into a pending folder (property id unknown yet).
  // Edit: straight into the property's own folder.
  const [uploadFolder] = useState(() => {
    if (mode === 'edit' && propertyId) return `properties/${propertyId}`
    const uuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    return `properties/pending/${uuid}`
  })
  const uploadHandler = useMemo(() => cloudinaryUploadHandler(uploadFolder), [uploadFolder])

  const handleChange = (name: string, value: unknown) => {
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setSummary(null)

    // Paste "-1.286389, 36.817223" into either pin field → fill both.
    if ((name === 'latitude' || name === 'longitude') && typeof value === 'string' && value.includes(',')) {
      const [la, ln] = value.split(',').map((s) => Number(s.trim()))
      if (Number.isFinite(la) && Number.isFinite(ln)) {
        setValues((prev) => ({ ...prev, latitude: String(la), longitude: String(ln) }))
        return
      }
    }

    if (name === 'category') {
      const allowed: string[] = typesForCategory(str(value)).map((t) => t.value)
      setValues((prev) => ({
        ...prev,
        category: value,
        propertyType: allowed.includes(str(prev.propertyType)) ? prev.propertyType : '',
      }))
      return
    }

    // Picking "create a new owner" clears the picker-only fields (and vice
    // versa) so validation never sees a stale combination.
    if (name === 'ownerPartyId') {
      setValues((prev) => ({
        ...prev,
        ownerPartyId: value,
        ...(value === '__create__'
          ? {}
          : { ownerName: '', ownerEmail: '', ownerPhone: '', ownerKraPin: '', ownerPartyType: '' }),
      }))
      return
    }

    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const steps: WizardStep[] = [
    {
      id: 'identity',
      title: 'Identity',
      description: 'What the property is called and how it is classified.',
      sections: [
        {
          id: 'identity',
          title: 'Identity',
          columns: 4,
          fields: [
            {
              name: 'name',
              label: 'Property name',
              type: 'text',
              required: true,
              colSpan: 2,
              placeholder: 'Kilimani View Apartments',
            },
            {
              name: 'code',
              label: 'Property code',
              type: 'text',
              colSpan: isEdit ? 1 : 2,
              placeholder: 'SHP-0001',
              helperText: isEdit ? 'Internal reference' : 'Leave blank to auto-generate',
            },
            // Create always starts DRAFT (status select would be dead UI);
            // edit keeps it — it's the DRAFT→ACTIVE activation path.
            ...(isEdit
              ? [
                  {
                    name: 'status',
                    label: 'Status',
                    type: 'select',
                    colSpan: 1,
                    options: selectOptions(PROPERTY_EDITABLE_STATUSES),
                  } satisfies FieldDef,
                ]
              : []),
            { name: 'category', label: 'Category', type: 'select', required: true, colSpan: 2, options: selectOptions(PROPERTY_CATEGORIES) },
            { name: 'propertyType', label: 'Property type', type: 'select', required: true, colSpan: 2, options: selectOptions(typesForCategory(category)), placeholder: 'Select a type' },
            { name: 'description', label: 'Description', type: 'textarea', rows: 3, colSpan: 'full', placeholder: 'Short summary shown on listings and owner reports.' },
            { name: 'tags', label: 'Tags', type: 'text', colSpan: 'full', placeholder: 'premium, near school, corner unit', helperText: 'Comma-separated' },
          ],
        },
      ],
    },
    {
      id: 'location',
      title: 'Location',
      description: 'Address and the map pin (decimal degrees — paste a pair into either box).',
      sections: [
        {
          id: 'address',
          title: 'Address',
          columns: 4,
          fields: [
            { name: 'addressLine1', label: 'Street address', type: 'text', required: true, colSpan: 2, placeholder: 'Ring Road, Kilimani' },
            { name: 'addressLine2', label: 'Address line 2', type: 'text', colSpan: 2 },
            { name: 'locality', label: 'Locality / area', type: 'text', required: true, colSpan: 2, placeholder: 'Kilimani' },
            { name: 'region', label: 'Region / county', type: 'text', colSpan: 1, placeholder: 'Nairobi' },
            { name: 'postalCode', label: 'Postal code', type: 'text', colSpan: 1 },
            { name: 'country', label: 'Country', type: 'text', required: true, colSpan: 2 },
            { name: 'landmark', label: 'Nearest landmark', type: 'text', colSpan: 2, placeholder: '500 m past the roundabout' },
          ],
        },
        {
          id: 'pin',
          title: 'Map pin',
          description: 'Required to activate land properties.',
          columns: 4,
          fields: [
            { name: 'latitude', label: 'Latitude', type: 'text', colSpan: 2, placeholder: '-1.286389', helperText: 'Paste "-1.28, 36.81" into either field to fill both' },
            { name: 'longitude', label: 'Longitude', type: 'text', colSpan: 2, placeholder: '36.817223' },
            { name: 'directionsNote', label: 'Directions note', type: 'textarea', rows: 2, colSpan: 'full', placeholder: 'Gate on the left after the shops.' },
          ],
        },
      ],
    },
    {
      id: 'structure',
      title: 'Structure',
      description: 'Physical attributes — all optional.',
      sections: [
        {
          id: 'building',
          title: 'Building & land',
          columns: 4,
          fields: [
            { name: 'floors', label: 'Floors', type: 'number', colSpan: 1 },
            { name: 'parkingSpaces', label: 'Parking spaces', type: 'number', colSpan: 1 },
            { name: 'yearBuilt', label: 'Year built', type: 'number', colSpan: 1 },
            { name: 'yearRenovated', label: 'Year renovated', type: 'number', colSpan: 1 },
            { name: 'condition', label: 'Condition', type: 'select', colSpan: 1, options: selectOptions(PROPERTY_CONDITIONS) },
            { name: 'plotSizeValue', label: 'Plot size', type: 'number', colSpan: 1 },
            { name: 'plotSizeUnit', label: 'Plot unit', type: 'select', colSpan: 1, options: selectOptions(AREA_UNITS) },
            { name: 'buildingAreaValue', label: 'Building area', type: 'number', colSpan: 1 },
            { name: 'buildingAreaUnit', label: 'Area unit', type: 'select', colSpan: 1, options: selectOptions(AREA_UNITS) },
          ],
        },
        {
          id: 'amenities',
          title: 'Amenities & utilities',
          description: 'Tick everything this property offers — visible checkboxes beat a dropdown.',
          columns: 4,
          fields: [
            {
              name: 'amenities',
              label: 'Amenities',
              type: 'checkbox-group',
              colSpan: 'full',
              options: AMENITY_OPTIONS.map((a) => ({ value: a, label: a })),
            },
            {
              name: 'utilities',
              label: 'Utilities',
              type: 'checkbox-group',
              colSpan: 'full',
              options: UTILITY_OPTIONS.map((u) => ({ value: u, label: u })),
            },
          ],
        },
      ],
    },
    {
      id: 'media',
      title: 'Media',
      description: 'Photos upload straight to the property gallery as you add them.',
      sections: [
        {
          id: 'photos',
          title: 'Photos',
          columns: 4,
          fields: [
            {
              name: 'media',
              label: 'Photos',
              type: 'file',
              accept: 'image/*',
              multiple: true,
              maxFiles: 20,
              maxSizeMB: 10,
              colSpan: 'full',
              onUpload: uploadHandler,
              ...(isEdit && existingMediaUrls && existingMediaUrls.length > 0
                ? { existingUrls: existingMediaUrls }
                : {}),
              helperText:
                'The first photo becomes the cover. Add, caption or reorder more any time from the Media & Documents tab.',
            },
            { name: 'virtualTourUrl', label: 'Virtual tour URL', type: 'text', colSpan: 2 },
            { name: 'videoUrl', label: 'Video URL', type: 'text', colSpan: 2 },
          ],
        },
      ],
    },
    ...(showOwnership
      ? [
          {
            id: 'ownership',
            title: 'Owner & agreement',
            description: isEdit
              ? 'Who owns this property and how it is managed.'
              : 'The owner of record — plus a management agreement for PM/MM accounts.',
            sections: [],
          } satisfies WizardStep,
        ]
      : []),
    {
      id: 'legal',
      title: 'Legal & defaults',
      description: 'Title and statutory details, plus rental templates for new units.',
      sections: [
        {
          id: 'title',
          title: 'Title & registry',
          columns: 4,
          fields: [
            { name: 'titleType', label: 'Title type', type: 'select', colSpan: 2, options: selectOptions(TITLE_TYPES) },
            { name: 'titleNumber', label: 'Title number', type: 'text', colSpan: 2, placeholder: 'LN. 20891/105' },
            { name: 'registryReference', label: 'Registry reference', type: 'text', colSpan: 2 },
            { name: 'surveyPlanNumber', label: 'Survey plan no.', type: 'text', colSpan: 2 },
            { name: 'landControlArea', label: 'Land control area', type: 'text', colSpan: 2, placeholder: 'Kiambu' },
            { name: 'zoning', label: 'Zoning', type: 'text', colSpan: 2, placeholder: 'Residential' },
            {
              name: 'rateClearanceStatus',
              label: 'Rate clearance',
              type: 'select',
              colSpan: 2,
              options: selectOptions(RATE_CLEARANCE_STATUSES),
            },
            { name: 'rateClearanceExpiresAt', label: 'Rate clearance expires', type: 'date', colSpan: 2 },
            { name: 'encumbrances', label: 'Encumbrances / notes', type: 'textarea', rows: 2, colSpan: 'full', placeholder: 'Charges, caveats, disputes…' },
          ],
        },
        {
          id: 'defaults',
          title: 'Rental defaults',
          description: 'Templates only — never rewrites live leases or charges.',
          columns: 4,
          fields: [
            { name: 'currency', label: 'Currency', type: 'text', colSpan: 1 },
            { name: 'rentFrequency', label: 'Rent frequency', type: 'select', colSpan: 1, options: selectOptions(RENT_FREQUENCIES) },
            { name: 'depositMonths', label: 'Deposit (months)', type: 'number', colSpan: 1 },
            { name: 'noticeDays', label: 'Notice (days)', type: 'number', colSpan: 1 },
            { name: 'serviceChargeRate', label: 'Service charge %', type: 'number', colSpan: 1 },
            { name: 'lateFeeRule', label: 'Late fee rule', type: 'text', colSpan: 3, placeholder: '5% after 7 days' },
          ],
        },
      ],
    },
  ]

  const validateById = (stepId: string, v: PropertyFormValues): Record<string, string> => {
    switch (stepId) {
      case 'identity':
        return validateIdentity(v)
      case 'location':
        return validateLocation(v)
      case 'media':
        return validateMedia(v)
      case 'ownership':
        return validateOwnership(v, { mode, canAgreement })
      case 'legal':
        return validateLegal(v)
      default:
        return {}
    }
  }

  const handleValidateStep = (stepIndex: number, v: PropertyFormValues) => {
    const step = steps[stepIndex]
    return step ? validateById(step.id, v) : {}
  }

  const handleSubmit = async (v: PropertyFormValues) => {
    const errs: Record<string, string> = {}
    for (const step of steps) Object.assign(errs, validateById(step.id, v))
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = Object.values(errs)
      setSummary(
        `Fix ${labels.length} issue${labels.length === 1 ? '' : 's'} before saving: ${labels.join(' · ')}`,
      )
      return
    }
    setSummary(null)

    // Strip internal step-only keys; build the ownership/agreement extension
    // objects the SERVER expects (create only — edit never mutates them here).
    const {
      media,
      ownerPartyId,
      ownerPartyType,
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerKraPin,
      agreementEnabled,
      agreementStartsAt,
      agreementEndsAt,
      ...rest
    } = v

    const payload: PropertyFormValues = {
      ...rest,
      tags: splitTags(rest.tags),
      defaults: buildDefaults(rest),
      media, // consumed by the page (registered as documents), never JSON-sent
    }

    if (!isEdit && showOwnership) {
      const owner = str(ownerPartyId)
      payload.ownership =
        owner === '__create__'
          ? {
              owner: {
                partyType: str(ownerPartyType),
                name: str(ownerName).trim(),
                email: str(ownerEmail).trim() || undefined,
                phone: str(ownerPhone).trim() || undefined,
                kraPin: str(ownerKraPin).trim() || undefined,
              },
            }
          : { ownerPartyId: owner }
      if (canAgreement && agreementEnabled === true) {
        payload.agreement = {
          startsAt: str(agreementStartsAt),
          endsAt: str(agreementEndsAt) || null,
        }
      }
    }

    await onSubmit(payload)
  }

  const fieldErrors: Record<string, string> = { ...errors, ...serverErrors }

  return (
    <div className="space-y-4">
      {summary ? (
        <Alert variant="destructive">
          <AlertDescription>{summary}</AlertDescription>
        </Alert>
      ) : null}
      <UniversalForm
        title={isEdit ? 'Edit property' : 'Add property'}
        description={
          isEdit
            ? 'Update the record — changes apply immediately.'
            : `${steps.length} short steps. Saved as a draft until you activate it.`
        }
        mode={mode}
        variant="wizard"
        steps={steps}
        values={values}
        errors={fieldErrors}
        onChange={handleChange}
        onValidateStep={handleValidateStep}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        isLoading={saving}
        primaryLabel={isEdit ? 'Save changes' : 'Create property'}
        formClassName="w-full"
        bare
        renderStepContent={(stepIndex) =>
          steps[stepIndex]?.id === 'ownership' ? (
            <OwnershipStepContent
              mode={mode}
              orgKind={kind}
              values={values}
              errors={fieldErrors}
              onChange={handleChange}
              ownerOptions={ownerOptions}
              summary={ownershipSummary}
              onLinkSelf={onLinkSelf}
            />
          ) : null
        }
      />
    </div>
  )
}
