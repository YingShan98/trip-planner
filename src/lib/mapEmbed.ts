/** What a `Day.mapUrl` holds: a Google Maps link, a 高德 (Amap) link, some other link, or a plain place name/address. */
export type MapLinkKind = 'google' | 'amap' | 'other' | 'place';

export function mapLinkKind(input: string): MapLinkKind {
  const value = input.trim();
  if (!/^https?:\/\//i.test(value)) return 'place';
  let host = '';
  let path = '';
  try { const u = new URL(value); host = u.hostname.toLowerCase(); path = u.pathname; } catch { return 'other'; }
  if (/(^|\.)(amap|gaode)\.com$/.test(host)) return 'amap';
  if (/^maps\.google\./.test(host) || (/(^|\.)google\.[a-z.]+$/.test(host) && path.startsWith('/maps'))
    || host === 'maps.app.goo.gl' || (host === 'goo.gl' && path.startsWith('/maps'))) return 'google';
  return 'other';
}

/** A place field's text if it's a searchable name/address; '' if it's a pasted link, which can't be searched or routed to. */
export function searchablePlace(input: string): string {
  return mapLinkKind(input) === 'place' ? input.trim() : '';
}

/** Button text for opening a pasted map link. */
export function mapLinkLabel(kind: MapLinkKind): string {
  return kind === 'amap' ? '在高德打开' : kind === 'google' ? '在 Google 地图打开' : '打开链接';
}

/** Turns whatever a user pasted into `Day.mapUrl` into an embeddable Google Maps iframe src. */
export function toMapEmbedSrc(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  // 高德 share links open an "get the app" page rather than a map, so they're linked to, not embedded.
  if (mapLinkKind(value) === 'amap') return null;
  if (!/^https?:\/\//i.test(value)) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(value)}&output=embed`;
  }
  if (value.includes('output=embed')) return value;

  const originMatch = value.match(/[?&]origin=([^&]+)/);
  const destMatch = value.match(/[?&]destination=([^&]+)/);
  if (originMatch && destMatch) return `https://maps.google.com/maps?saddr=${originMatch[1]}&daddr=${destMatch[1]}&output=embed`;

  const atMatch = value.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return `https://maps.google.com/maps?q=${atMatch[1]},${atMatch[2]}&z=15&output=embed`;

  const placeMatch = value.match(/\/maps\/place\/([^/@?]+)/);
  if (placeMatch) return `https://maps.google.com/maps?q=${encodeURIComponent(decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')))}&output=embed`;

  const qMatch = value.match(/[?&]q=([^&]+)/);
  if (qMatch) return `https://maps.google.com/maps?q=${qMatch[1]}&output=embed`;

  return null;
}

export type TravelMode = 'walking' | 'transit' | 'driving';

/** Google Maps place search — works worldwide, needs no key. */
export function googleMapsSearchUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.trim())}`;
}

/** 高德 (Amap) keyword search — the usable map inside mainland China, needs no key. */
export function amapSearchUrl(place: string): string {
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(place.trim())}&view=map&src=trip-planner&callnative=1`;
}

/** Google Maps draws at most this many stops in one route (start + 9 more). */
export const MAX_ROUTE_STOPS = 10;

/**
 * Keyless embeddable Google route through `stops` (place names, in order, at most MAX_ROUTE_STOPS).
 * The classic `saddr`/`daddr=A+to:B` URL redirects to an embeddable /maps/embed page, same as the
 * place preview. Walking or driving only: Google has no transit routing in mainland China.
 */
export function googleRouteEmbedSrc(stops: string[], mode: TravelMode = 'driving'): string | null {
  const names = stops.map((s) => s.trim()).filter(Boolean).slice(0, MAX_ROUTE_STOPS);
  if (names.length < 2) return null;
  const [start, ...rest] = names;
  return `https://maps.google.com/maps?saddr=${encodeURIComponent(start)}&daddr=${rest.map(encodeURIComponent).join('+to:')}&dirflg=${mode === 'walking' ? 'w' : 'd'}&output=embed`;
}

/** Opens the same multi-stop route in Google Maps itself (app on phones). */
export function googleRouteUrl(stops: string[], mode: TravelMode = 'driving'): string {
  const names = stops.map((s) => s.trim()).filter(Boolean).slice(0, MAX_ROUTE_STOPS);
  const params = new URLSearchParams({ api: '1', origin: names[0] ?? '', destination: names[names.length - 1] ?? '', travelmode: mode });
  if (names.length > 2) params.set('waypoints', names.slice(1, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Google Maps directions between two place names; without `from` it starts at the viewer's current location. */
export function googleDirectionsUrl(to: string, from?: string, mode?: TravelMode): string {
  const params = new URLSearchParams({ api: '1', destination: to.trim() });
  if (from?.trim()) params.set('origin', from.trim());
  if (mode) params.set('travelmode', mode);
  return `https://www.google.com/maps/dir/?${params}`;
}
