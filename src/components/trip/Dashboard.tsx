import { useEffect, useState } from 'react';
import type { TripState } from '../../types';
import { fetchWeather, weatherEmoji, weatherLabel, type WeatherResult } from '../../lib/weather';
import { formatDate } from '../../lib/format';

export default function Dashboard({
  state, description, total, done, destination, startDate, endDate,
}: {
  state: TripState; description: string; total: number; done: number;
  destination: string; startDate: string | null; endDate: string | null;
}) {
  const packed = state.packing.filter((x) => x.done).length;
  const [weather, setWeather] = useState<WeatherResult | 'loading' | null>(null);

  useEffect(() => {
    if (!destination.trim() || !startDate) { setWeather(null); return; }
    let cancelled = false;
    setWeather('loading');
    fetchWeather(destination, startDate, endDate || startDate).then((result) => { if (!cancelled) setWeather(result); });
    return () => { cancelled = true; };
  }, [destination, startDate, endDate]);

  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">📋 旅行速览</h2>
        {description && <span className="text-muted text-[13px]">{description}</span>}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        {[
          { label: '旅行天数', value: `${state.days.length} 天` },
          { label: '行程项目', value: `${total} 项` },
          { label: '出发准备', value: `${done}/${state.checklist.length}` },
          { label: '打包进度', value: `${packed}/${state.packing.length}` },
          { label: '酒店候选', value: `${state.hotels.length} 个` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-surface border border-line rounded p-4 shadow-xs transition-all duration-150 hover:shadow-sm hover:-translate-y-px"
          >
            <small className="block text-muted text-[11.5px] font-semibold uppercase tracking-[0.07em] mb-2">{label}</small>
            <strong className="font-serif text-[26px] font-bold text-jade-dark leading-[1.15]">{value}</strong>
          </div>
        ))}
      </div>

      {weather === 'loading' && (
        <p className="text-muted text-[12.5px] mt-4">正在获取天气预报…</p>
      )}
      {weather && weather !== 'loading' && weather.status === 'ok' && (
        <div className="mt-4">
          <small className="block text-muted text-[11.5px] font-semibold uppercase tracking-[0.07em] mb-2">{weather.place} 天气预报</small>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weather.days.map((d) => (
              <div key={d.date} className="shrink-0 w-[92px] bg-surface border border-line rounded p-3 text-center">
                <div className="text-[11px] text-muted mb-1">{formatDate(d.date)}</div>
                <div className="text-[22px] mb-1" aria-hidden="true">{weatherEmoji(d.code)}</div>
                <div className="text-[11px] text-muted mb-1">{weatherLabel(d.code)}</div>
                <div className="text-[12.5px] font-semibold text-jade-dark">{d.tMax}° / {d.tMin}°</div>
                <div className="text-[10.5px] text-sky">💧{d.precipProb}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {weather && weather !== 'loading' && weather.status === 'too-far' && (
        <p className="text-muted text-[12.5px] mt-4">出发日期还早，14 天内会显示天气预报</p>
      )}
    </section>
  );
}
