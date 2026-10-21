/**
 * Derived Google Maps deep links (no API key — research-property-2 §"Build a
 * single helper"). Pure functions, safe on client and server. Links are
 * computed from stored coordinates — we never persist URL forms.
 */

const q = (lat: number, lng: number) => `${lat}%2C${lng}`;

/** Open the pin in Maps search (optionally with place details). */
export function mapsPinUrl(lat: number | null | undefined, lng: number | null | undefined, placeId?: string | null): string | null {
  if (lat == null || lng == null) return null;
  const place = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : '';
  return `https://www.google.com/maps/search/?api=1&query=${q(lat, lng)}${place}`;
}

/** Directions to the pin — the site-visit link. */
export function mapsDirectionsUrl(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${q(lat, lng)}&travelmode=driving`;
}

/** Satellite view centered on the pin. */
export function mapsSatelliteUrl(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/@?api=1&map_action=map&center=${q(lat, lng)}&zoom=17&basemap=satellite`;
}

/** Street View at the pin. */
export function mapsStreetViewUrl(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${q(lat, lng)}`;
}

/** Search by address text (used before a pin exists). */
export function mapsAddressUrl(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

/** True when the pin is usable (rejects null/NaN and the (0,0) origin). */
export function hasMapPin(lat: unknown, lng: unknown): boolean {
  const la = typeof lat === 'number' ? lat : Number(lat);
  const ln = typeof lng === 'number' ? lng : Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (la === 0 && ln === 0) return false;
  return Math.abs(la) <= 90 && Math.abs(ln) <= 180;
}
