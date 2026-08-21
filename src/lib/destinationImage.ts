/** Best-effort cover photo lookup via Wikipedia's public REST API (no key required). Fails silently. */

interface WikiSummary {
  thumbnail?: { source: string };
  originalimage?: { source: string };
}

async function fetchSummaryImage(lang: string, title: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = await res.json() as WikiSummary;
    return data.originalimage?.source || data.thumbnail?.source || null;
  } catch {
    return null;
  }
}

/** Tries the destination name against Chinese and English Wikipedia in turn; returns null if neither has a usable photo. */
export async function suggestDestinationImage(destination: string): Promise<string | null> {
  const query = destination.split(/[·/,、]/)[0]?.trim();
  if (!query) return null;
  return (await fetchSummaryImage('zh', query)) || (await fetchSummaryImage('en', query));
}
