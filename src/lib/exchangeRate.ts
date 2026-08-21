/** Best-effort live exchange rate via Frankfurter (free, keyless, ECB reference rates). */

/** 1 unit of `from` = returned number of `to`, or null if the pair isn't available. */
export async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
  const base = from.trim().toUpperCase();
  const target = to.trim().toUpperCase();
  if (!base || !target || base === target) return base === target ? 1 : null;
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(target)}`);
    if (!res.ok) return null;
    const data = await res.json() as { rates?: Record<string, number> };
    const rate = data.rates?.[target];
    return typeof rate === 'number' && isFinite(rate) ? rate : null;
  } catch {
    return null;
  }
}
