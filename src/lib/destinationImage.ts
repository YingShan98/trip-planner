/** Best-effort cover photo lookup via Wikipedia's public MediaWiki API (no key required). Fails silently. */

interface PageImagesResponse {
  query?: {
    pages?: Record<string, { thumbnail?: { source: string } }>;
  };
}

/** Requests a ~1000px-wide thumbnail explicitly, instead of Wikipedia's default page-summary photo (often several MB at full resolution, or a blurry 330px if left unspecified). */
async function fetchThumbnail(lang: string, title: string): Promise<string | null> {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&redirects=1&prop=pageimages&pithumbsize=1000&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as PageImagesResponse;
    const pages = data.query?.pages ? Object.values(data.query.pages) : [];
    return pages[0]?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

/** Tries the destination name against Chinese and English Wikipedia in turn; returns null if neither has a usable photo. */
export async function suggestDestinationImage(destination: string): Promise<string | null> {
  const query = destination.replace(/[（(].*$/, '').split(/[·/,、]/)[0]?.trim();
  if (!query) return null;
  return (await fetchThumbnail('zh', query)) || (await fetchThumbnail('en', query));
}
