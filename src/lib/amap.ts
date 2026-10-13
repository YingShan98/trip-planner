/* Loads the 高德 (Amap) JS API 2.0 once, on demand. Without a key and its 安全密钥 (see .env.example)
   it resolves to null and callers fall back to Google. */

/* eslint-disable @typescript-eslint/no-explicit-any -- the Amap SDK ships no types */
export type AMapSDK = any;

const KEY = import.meta.env.VITE_AMAP_KEY?.trim() || '';
const SECURITY_CODE = import.meta.env.VITE_AMAP_SECURITY_CODE?.trim() || '';

export const hasAmap = Boolean(KEY && SECURITY_CODE);

let loading: Promise<AMapSDK | null> | null = null;

export function loadAmap(): Promise<AMapSDK | null> {
  if (!hasAmap) return Promise.resolve(null);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const w = window as any;
    if (w.AMap) { resolve(w.AMap); return; }
    // Must be set before the script loads, or every request is rejected.
    w._AMapSecurityConfig = { securityJsCode: SECURITY_CODE };
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(KEY)}&plugin=AMap.PlaceSearch,AMap.Geocoder,AMap.Driving,AMap.Walking,AMap.Transfer`;
    script.async = true;
    script.onload = () => resolve(w.AMap ?? null);
    script.onerror = () => { loading = null; resolve(null); };
    document.head.appendChild(script);
  });
  return loading;
}
