/** Turns whatever a user pasted into `Day.mapUrl` into an embeddable Google Maps iframe src. */
export function toMapEmbedSrc(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

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

/** Google Maps directions between two place names; without `from` it starts at the viewer's current location. */
export function googleDirectionsUrl(to: string, from?: string, mode?: TravelMode): string {
  const params = new URLSearchParams({ api: '1', destination: to.trim() });
  if (from?.trim()) params.set('origin', from.trim());
  if (mode) params.set('travelmode', mode);
  return `https://www.google.com/maps/dir/?${params}`;
}
