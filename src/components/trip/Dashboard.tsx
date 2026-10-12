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
      <span className="block text-[13px] font-semibold mt-3 text-white/90">查看今天行程 →</span>
    </a>
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
    <section className="py-5 sm:py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">📋 旅行速览</h2>
        {description && <span className="text-muted text-[13px]">{description}</span>}
      </div>
      {todayIndex !== null ? <TodayCard state={state} todayIndex={todayIndex} /> : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2 sm:gap-3">
          {[
            ...(countdownLabel ? [{
              label: countdown.phase === 'upcoming' ? '距出发' : '旅行状态',
              value: countdown.phase === 'upcoming' ? `${countdown.days} 天` : countdownLabel,
            }] : []),
            { label: '旅行天数', value: `${state.days.length} 天` },
            { label: '行程项目', value: `${total} 项` },
            { label: '出发准备', value: `${done}/${state.checklist.length}` },
            { label: '打包进度', value: `${packed}/${state.packing.length}` },
            { label: '酒店候选', value: `${state.hotels.length} 个` },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-surface border border-line rounded p-3 sm:p-4 shadow-xs transition-all duration-150 hover:shadow-sm hover:-translate-y-px"
            >
              <small className="block text-muted text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.07em] mb-1 sm:mb-2">{label}</small>
              <strong className="font-serif text-[19px] sm:text-[26px] font-bold text-jade-dark leading-[1.15]">{value}</strong>
            </div>
          ))}
        </div>
      )}

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
