import type { CurrencyKey } from '../types';

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

export function formatMoney(amount: number | null, code: string): string {
  if (amount === null || !isFinite(amount)) return '—';
  return `${code || ''} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`.trim();
}
