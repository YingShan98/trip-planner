import { normalize } from '../state';
import type { ImportedTripMeta, TripState } from '../types';

/** Parses an exported trip file (`{ meta, data }`, or a bare TripState). Throws on invalid JSON. */
export function parseTripJson(raw: string): { meta: ImportedTripMeta; data: TripState } {
  const obj: unknown = JSON.parse(raw);
  const parsed = (obj && typeof obj === 'object' ? obj : {}) as { meta?: ImportedTripMeta; data?: unknown };
  return { meta: parsed.meta || {}, data: normalize(parsed.data ?? obj) };
}
