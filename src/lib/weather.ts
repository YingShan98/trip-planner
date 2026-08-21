/** Best-effort trip-dates forecast via Open-Meteo (free, keyless). Only covers the ~16-day forecast horizon. */

export interface DailyWeather {
  date: string;
  tMax: number;
  tMin: number;
  precipProb: number;
  code: number;
}

export type WeatherResult =
  | { status: 'ok'; place: string; days: DailyWeather[] }
  | { status: 'too-far' }
  | { status: 'unavailable' };

const WMO_LABELS: Record<number, string> = {
  0: '晴朗', 1: '大致晴朗', 2: '局部多云', 3: '阴天',
  45: '雾', 48: '雾凇',
  51: '小毛雨', 53: '毛雨', 55: '大毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪',
  80: '阵雨', 81: '强阵雨', 82: '暴雨',
  95: '雷雨', 96: '雷雨伴冰雹', 99: '强雷雨伴冰雹',
};

export function weatherLabel(code: number): string {
  return WMO_LABELS[code] || '—';
}

export function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '🌨️';
  if (code <= 82) return '🌧️';
  return '⛈️';
}

async function geocode(destination: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const place = destination.split(/[·/,、]/)[0]?.trim();
  if (!place) return null;
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=zh`);
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ latitude: number; longitude: number; name: string }> };
    const hit = data.results?.[0];
    return hit ? { lat: hit.latitude, lon: hit.longitude, name: hit.name } : null;
  } catch {
    return null;
  }
}

export async function fetchWeather(destination: string, startDate: string, endDate: string): Promise<WeatherResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate + 'T00:00:00');
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + 15);

  if (start > horizonEnd) return { status: 'too-far' };

  const end = new Date(endDate + 'T00:00:00');
  const rangeStart = start < today ? today : start;
  const rangeEnd = end > horizonEnd ? horizonEnd : end < rangeStart ? rangeStart : end;
  if (rangeStart > horizonEnd) return { status: 'too-far' };

  const place = await geocode(destination);
  if (!place) return { status: 'unavailable' };

  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&start_date=${toIso(rangeStart)}&end_date=${toIso(rangeEnd)}`,
    );
    if (!res.ok) return { status: 'unavailable' };
    const data = await res.json() as {
      daily?: { time: string[]; weathercode: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] };
    };
    const dates = data.daily?.time || [];
    if (!dates.length) return { status: 'unavailable' };
    const days: DailyWeather[] = dates.map((date, i) => ({
      date,
      tMax: Math.round(data.daily!.temperature_2m_max[i]),
      tMin: Math.round(data.daily!.temperature_2m_min[i]),
      precipProb: data.daily!.precipitation_probability_max?.[i] ?? 0,
      code: data.daily!.weathercode[i],
    }));
    return { status: 'ok', place: place.name, days };
  } catch {
    return { status: 'unavailable' };
  }
}
