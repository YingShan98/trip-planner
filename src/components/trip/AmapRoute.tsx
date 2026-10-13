import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadAmap, type AMapSDK } from '../../lib/amap';

/** How a leg is drawn. 'line' (trains, flights, boats) just joins the two points — 高德's 公交 planner
 *  suggests intercity buses instead of the 高铁, and has nothing for flights. */
export type AmapMode = 'driving' | 'walking' | 'transit' | 'line';

/** 高德 plans a driving route through at most 16 waypoints, plus the start and end. */
export const AMAP_MAX_STOPS = 18;

type Spot = { lng: number; lat: number; city: string };

/* ── Place lookups, cached in memory and (best effort) in localStorage, so reopening a map doesn't
   spend the key's free daily quota on the same searches again. ── */
const CACHE_KEY = 'amap-places:v1';
const cache: Record<string, Spot | null> = (() => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
})();
const saveCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* storage full or blocked */ } };

/** Finds a place by name (POI search) or, failing that, as an address. `city` is only a preference:
 *  a place that exists in one city only (华强北) is still found when the hint is another city. */
async function findPlace(AMap: AMapSDK, name: string, city: string): Promise<Spot | null> {
  const id = `${city}|${name}`;
  if (id in cache) return cache[id];
  const poi = await new Promise<Spot | null>((resolve) => {
    new AMap.PlaceSearch({ city: city || '全国', citylimit: false, pageSize: 1, extensions: 'all' })
      .search(name, (status: string, res: AMapSDK) => {
        const p = status === 'complete' ? res?.poiList?.pois?.[0] : null;
        resolve(p?.location ? { lng: p.location.lng, lat: p.location.lat, city: p.cityname || city } : null);
      });
  });
  const spot = poi ?? await new Promise<Spot | null>((resolve) => {
    new AMap.Geocoder({ city }).getLocation(name, (status: string, res: AMapSDK) => {
      const g = status === 'complete' ? res?.geocodes?.[0] : null;
      resolve(g?.location ? { lng: g.location.lng, lat: g.location.lat, city: g.addressComponent?.city || g.addressComponent?.province || city } : null);
    });
  });
  cache[id] = spot;
  saveCache();
  return spot;
}

const minutes = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)}小时${Math.round((sec % 3600) / 60)}分钟` : `${Math.max(1, Math.round(sec / 60))}分钟`);
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}公里` : `${Math.round(m)}米`);

/** One line describing a 公交 plan, e.g. "🚶 373米 → 🚇 地铁6号线 → 🚶 583米". */
function transitSummary(plan: AMapSDK): string {
  return (plan.segments || []).map((s: AMapSDK) => {
    const line = s.transit?.lines?.[0]?.name?.replace(/\(.*$/, '');
    if (s.transit_mode === 'WALK') return `🚶 ${km(s.distance || 0)}`;
    if (s.transit_mode === 'SUBWAY') return `🚇 ${line || '地铁'}`;
    if (s.transit_mode === 'BUS') return `🚌 ${line || '公交'}`;
    if (s.transit_mode === 'RAILWAY') return `🚄 ${s.transit?.trip || '火车'}`;
    return line || '';
  }).filter(Boolean).join(' → ');
}

/**
 * A 高德 map with a route through `stops` (place names or addresses, in order). Stops are looked up
 * one after another, each using the previous stop's city as its hint, starting from `cityHint`.
 * Renders `fallback` (the Google map) when 高德 isn't configured or fails to load.
 */
export default function AmapRoute({ stops, mode, cityHint, height, fallback }: {
  stops: string[]; mode: AmapMode; cityHint: string; height: number; fallback: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('正在加载高德地图…');
  const key = stops.join('→') + '|' + mode;

  useEffect(() => {
    let cancelled = false;
    let map: AMapSDK = null;
    (async () => {
      const AMap = await loadAmap();
      if (cancelled) return;
      if (!AMap || !boxRef.current) { setFailed(true); return; }
      map = new AMap.Map(boxRef.current, { zoom: 12, resizeEnable: true });

      setStatus('正在查找地点…');
      const spots: (Spot & { name: string })[] = [];
      let city = cityHint;
      for (const name of stops.slice(0, AMAP_MAX_STOPS)) {
        const spot = await findPlace(AMap, name, city);
        if (cancelled) return;
        if (spot) { spots.push({ ...spot, name }); city = spot.city || city; }
      }
      const missing = stops.slice(0, AMAP_MAX_STOPS).filter((n) => !spots.some((s) => s.name === n));
      const missingNote = missing.length ? `（高德找不到：${missing.join('、')}）` : '';
      if (spots.length < 2) { setStatus(`高德找不到足够的地点来画路线${missingNote}`); return; }

      const pts = spots.map((s) => new AMap.LngLat(s.lng, s.lat));
      const [from, to] = [pts[0], pts[pts.length - 1]];
      const drawLine = (note: string) => {
        spots.forEach((s, k) => map.add(new AMap.Marker({ position: pts[k], title: s.name, label: { content: String(k + 1), direction: 'center' } })));
        map.add(new AMap.Polyline({ path: pts, strokeColor: '#24735b', strokeWeight: 4, strokeStyle: 'dashed' }));
        map.setFitView();
        setStatus(note + missingNote);
      };

      const describe = (res: AMapSDK): string => {
        if (mode === 'transit') {
          const plan = res?.plans?.[0];
          return plan ? `公交/地铁约 ${minutes(plan.time)} · ${transitSummary(plan)}` : '';
        }
        const r = res?.routes?.[0];
        return r ? `${mode === 'walking' ? '步行' : '驾车'}约 ${minutes(r.time)} · ${km(r.distance)}` : '';
      };
      // The planners draw the route and its markers on `map` themselves.
      const done = (state: string, res: AMapSDK) => {
        if (cancelled) return;
        if (state === 'complete') setStatus((describe(res) || '路线已画出') + missingNote);
        else drawLine('高德没有找到这段路线，图中为直线连接');
      };

      setStatus('正在规划路线…');
      if (mode === 'line' || (mode === 'transit' && spots[0].city !== spots[spots.length - 1].city)) {
        drawLine(mode === 'line' ? '直线示意（高铁/航班/船不画实际路线）' : '跨城市路线，图中为直线连接');
      } else if (mode === 'walking') {
        new AMap.Walking({ map }).search(from, to, done);
      } else if (mode === 'transit') {
        new AMap.Transfer({ map, city: spots[0].city || cityHint, cityd: spots[spots.length - 1].city || cityHint }).search(from, to, done);
      } else {
        new AMap.Driving({ map }).search(from, to, { waypoints: pts.slice(1, -1) }, done);
      }
    })().catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; map?.destroy(); };
    // `key` stands in for stops + mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cityHint]);

  if (failed) return <>{fallback}</>;
  return (
    <div>
      <div ref={boxRef} className="w-full bg-surface-2" style={{ height }} />
      <p className="px-3 py-1.5 m-0 text-[11.5px] text-muted bg-surface-2 border-t border-dashed border-line">{status}</p>
    </div>
  );
}
