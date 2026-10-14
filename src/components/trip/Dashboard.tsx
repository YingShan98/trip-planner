import { useState } from 'react';
import type { Activity, TripState } from '../../types';
import { weatherEmoji, weatherLabel, type WeatherResult } from '../../lib/weather';
import { formatDate, tripCountdown, tripCountdownLabel } from '../../lib/format';
import { parseTimeRange } from '../../lib/activityTime';

const plainTitle = (a: Activity) => a.x.replace(/\*\*/g, '').split('\n')[0].trim() || '未命名行程';

/** The stop happening now (start ≤ now < end) and the first one starting later, by the activities' "HH:MM–HH:MM" times. */
function nowAndNext(items: Activity[]): { now: Activity | null; next: Activity | null } {
  const d = new Date();
  const clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const pad = (t: string) => t.padStart(5, '0');
  let now: Activity | null = null;
  let next: Activity | null = null;
  for (const a of items) {
    const { start, end } = parseTimeRange(a.t);
    if (!start) continue;
    if (pad(start) <= clock && end && clock < pad(end)) now = a;
    else if (!next && pad(start) > clock) next = a;
  }
  return { now, next };
}

/** Shown in place of the planning stats while the trip is under way: today's day, what's on now, and what's next. */
function TodayCard({ state, todayIndex }: { state: TripState; todayIndex: number }) {
  const day = state.days[todayIndex];
  const { now, next } = nowAndNext(day.items);
  return (
    <a href={`#day-${todayIndex + 1}`}
      className="block bg-jade-dark text-white rounded-lg p-4 shadow-sm no-underline hover:no-underline hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-white/75">
        <span className="bg-white text-jade-dark rounded-[5px] px-2 py-0.5 font-bold tracking-[0.06em]">今天 · D{todayIndex + 1}</span>
        <span>{day.items.length} 个安排</span>
      </div>
      <h3 className="font-serif font-bold text-[18px] mt-2 leading-snug">{day.title || `Day ${todayIndex + 1}`}</h3>
      {(now || next) && (
        <dl className="mt-2.5 space-y-1 text-[13.5px]">
          {now && <div className="flex gap-2"><dt className="shrink-0 text-white/65">进行中</dt><dd className="m-0 min-w-0 truncate font-semibold">{now.t} {plainTitle(now)}</dd></div>}
          {next && <div className="flex gap-2"><dt className="shrink-0 text-white/65">下一站</dt><dd className="m-0 min-w-0 truncate font-semibold">{next.t} {plainTitle(next)}</dd></div>}
        </dl>
      )}
      {day.hotel.trim() && (
        <div className="flex gap-2 mt-1 text-[13.5px]"><span className="shrink-0 text-white/65">今晚住</span><span className="min-w-0 truncate font-semibold">🏨 {day.hotel.trim()}</span></div>
      )}
      <span className="block text-[13px] font-semibold mt-3 text-white/90">查看今天行程 →</span>
    </a>
  );
}

/** The trip description, folded to two lines — some trips carry a whole paragraph of planning notes. */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 80;
  return (
    <div className="mt-2.5 pt-2.5 border-t border-line text-[13px] text-ink-2 leading-relaxed">
      <p className={`m-0 whitespace-pre-line ${long && !open ? 'line-clamp-2 print-unclamp' : ''}`}>{text}</p>
      {long && (
        <button className="no-print text-jade text-[12.5px] font-medium mt-1 hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? '收起' : '展开全文'}
        </button>
      )}
    </div>
  );
}

export default function Dashboard({
  state, description, total, done, startDate, endDate, weather, todayIndex,
}: {
  state: TripState; description: string; total: number; done: number;
  startDate: string | null; endDate: string | null;
  weather: WeatherResult | 'loading' | null;
  todayIndex: number | null;
}) {
  const packed = state.packing.filter((x) => x.done).length;
  const countdown = tripCountdown(startDate, endDate);
  const countdownLabel = tripCountdownLabel(startDate, endDate);

  return (
    <section className="pt-4 sm:pt-6">
      {todayIndex !== null ? <TodayCard state={state} todayIndex={todayIndex} /> : (() => {
        const stats = [
          ...(countdownLabel ? [{
            label: countdown.phase === 'upcoming' ? '距出发' : '状态',
            value: countdown.phase === 'upcoming' ? `${countdown.days} 天` : countdownLabel,
          }] : []),
          { label: '天数', value: `${state.days.length} 天` },
          { label: '行程', value: `${total} 站` },
          { label: '准备', value: `${done}/${state.checklist.length}` },
          { label: '打包', value: `${packed}/${state.packing.length}` },
        ];
        return (
          <div className="bg-surface border border-line rounded-xl px-3.5 py-3 sm:px-5 sm:py-4">
            <dl className="m-0 flex flex-wrap gap-x-5 gap-y-1.5 sm:gap-x-8">
              {stats.map(({ label, value }) => (
                <div key={label} className="flex items-baseline gap-1.5 sm:flex-col sm:gap-0">
                  <dt className="text-muted text-[12px]">{label}</dt>
                  <dd className="m-0 font-bold text-jade-dark text-[14px] sm:text-[20px] sm:leading-tight">{value}</dd>
                </div>
              ))}
            </dl>
            {description && <Description text={description} />}
          </div>
        );
      })()}

      {weather === 'loading' && (
        <p className="text-muted text-[12.5px] mt-3">正在获取天气预报…</p>
      )}
      {weather && weather !== 'loading' && weather.status === 'ok' && (
        <div className="mt-3">
          <small className="block text-muted text-[12px] mb-1.5">{weather.place} 天气</small>
          <div className="flex gap-1.5 overflow-x-auto pb-1 day-tabs">
            {weather.days.map((d) => (
              <div key={d.date} className="shrink-0 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-center" title={`${weatherLabel(d.code)} · 降雨概率 ${d.precipProb}%`}>
                <div className="text-[11px] text-muted">{formatDate(d.date)}</div>
                <div className="text-[13px] font-semibold text-ink whitespace-nowrap"><span aria-hidden="true">{weatherEmoji(d.code)}</span> {d.tMax}°/{d.tMin}°</div>
                {d.precipProb >= 30 && <div className="text-[10.5px] text-sky">💧{d.precipProb}%</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {weather && weather !== 'loading' && weather.status === 'too-far' && (
        <p className="text-muted text-[12.5px] mt-3">出发前 14 天内会显示天气预报</p>
      )}
    </section>
  );
}
