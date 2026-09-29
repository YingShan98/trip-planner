import type { CurrencyKey, TripState } from '../types';

/** Returns a usable positive rate, or null if unset/invalid (e.g. '' or 0). */
export function parseRate(rate: number | string): number | null {
  const n = Number(rate);
  return rate !== '' && isFinite(n) && n > 0 ? n : null;
}

export interface ConvertedAmount {
  home: number | null;
  foreign: number | null;
}

/** Converts a raw amount (entered in `currency`) into both home and foreign values. */
export function convertAmount(amount: number, currency: CurrencyKey, rate: number | null): ConvertedAmount {
  if (!isFinite(amount)) return { home: null, foreign: null };
  if (currency === 'home') {
    return { home: amount, foreign: rate !== null ? amount / rate : null };
  }
  return { home: rate !== null ? amount * rate : null, foreign: amount };
}

/** True if any transport/budget amount is entered in the foreign currency. */
export function hasForeignAmounts(state: TripState): boolean {
  return state.transport.some((x) => x.currency === 'foreign') || state.budget.some((x) => x.currency === 'foreign');
}

/** Makes a trip local: every foreign-currency amount is converted to home currency (when a rate is
    set; otherwise only relabelled), since a local trip has no second currency to show. Mutates `d`. */
export function convertToLocalTrip(d: TripState): void {
  const rate = parseRate(d.exchangeRate);
  const toHome = (v: number | string) => (rate !== null && v !== '' && isFinite(Number(v)) ? Math.round(Number(v) * rate * 100) / 100 : v);
  for (const x of d.transport) {
    if (x.currency === 'foreign') { x.amount = toHome(x.amount); x.currency = 'home'; }
  }
  for (const x of d.budget) {
    if (x.currency === 'foreign') { x.unitPrice = toHome(x.unitPrice); x.currency = 'home'; }
  }
  d.isLocal = true;
}

export function formatMoney(amount: number | null, code: string): string {
  if (amount === null || !isFinite(amount)) return '—';
  return `${code || ''} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`.trim();
}
