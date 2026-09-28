import { useEffect, useRef, useState } from 'react';
import { defaultActivity, defaultDay } from '../../state';
import type { Activity, Day, Intensity, Mutate, TripState } from '../../types';
import { confirmDialog } from '../../lib/confirm';
import { amapSearchUrl, googleDirectionsUrl, googleMapsSearchUrl, toMapEmbedSrc, type TravelMode } from '../../lib/mapEmbed';
import { dayDate, formatDateWithWeekday } from '../../lib/format';
import { weatherEmoji, type WeatherResult } from '../../lib/weather';
import MarkdownText from '../MarkdownText';
import CommentThread from './CommentThread';

const TIME_OPTIONS = ['清晨', '上午', '午间', '下午', '傍晚', '晚间', '全天'];
const intensityLabel = (i: Intensity) => i === 'light' ? '轻松' : i === 'medium' ? '中等' : '较累';
const intensityClass = (i: Intensity) =>
  i === 'light'  ? 'bg-[#e5f4ec] text-[#2a7d52] border-[#b8ddc7]' :
  i === 'medium' ? 'bg-[#fdf3dc] text-[#9a6e08] border-[#ecd98a]' :
                   'bg-[#fdf0ee] text-[#b53a2a] border-[#f0bdb4]';

function LinkRows({ di, ai, links, editUnlocked, mutate }: {
  di: number; ai: number; links: { label: string; url: string }[];
  editUnlocked: boolean; mutate: Mutate;
}) {
  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-line">
      {editUnlocked ? (
        <>
          {links.map((l, li) => (
            <div key={li} className="grid grid-cols-1 sm:grid-cols-[1fr_1.6fr_auto] gap-1.5 mb-1.5 items-center">
              <input className="inp editable" value={l.label} placeholder="链接名称"
                onChange={(e) => mutate((d) => { d.days[di].items[ai].link[li].label = e.target.value; })} />
              <input className="inp editable" value={l.url} placeholder="https://..."
                onChange={(e) => mutate((d) => { d.days[di].items[ai].link[li].url = e.target.value; })} />
              <button aria-label={`删除链接「${l.label || l.url || li + 1}」`} className="btn-mini edit-only"
                onClick={() => mutate((d) => { d.days[di].items[ai].link.splice(li, 1); })}>×</button>
            </div>
          ))}
          <button className="btn-mini edit-only mt-1"
            onClick={() => mutate((d) => { d.days[di].items[ai].link.push({ label: '链接', url: '' }); })}>
            ＋ 添加链接
          </button>
        </>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {links.filter((l) => l.url.trim()).map((l, li) => (
            <a key={li} href={l.url} target="_blank" rel="noopener noreferrer" className="text-jade text-[12.5px] hover:underline">
              ↗ {l.label || l.url}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ a, di, ai, total, editUnlocked, mutate }: {
  a: Activity; di: number; ai: number; total: number; editUnlocked: boolean; mutate: Mutate;
}) {
  const moveActivity = (delta: number) => {
    const j = ai + delta;
    if (j < 0 || j >= total) return;
    mutate((s) => { [s.days[di].items[ai], s.days[di].items[j]] = [s.days[di].items[j], s.days[di].items[ai]]; });
  };

  return (
    <div className="bg-surface-2 border border-line rounded p-3 mb-2.5 transition-all duration-150 hover:border-line-strong hover:shadow-xs print-keep">
      <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr_auto] gap-2 items-center mb-2">
        {editUnlocked ? (
          <select className="inp editable sm:w-auto"
            value={a.t}
            onChange={(e) => mutate((d) => { d.days[di].items[ai].t = e.target.value; })}>
            {TIME_OPTIONS.map((x) => <option key={x}>{x}</option>)}
          </select>
        ) : <span className="pill justify-center">{a.t || '时间待定'}</span>}
        {editUnlocked ? (
          <input className="inp editable" value={a.x} placeholder="行程内容"
            onChange={(e) => mutate((d) => { d.days[di].items[ai].x = e.target.value; })} />
        ) : <MarkdownText text={a.x} className="activity-title" />}
        {editUnlocked && (
          <div className="flex gap-1">
            <button aria-label="上移这个行程项目" className="btn-mini edit-only" disabled={ai === 0} onClick={() => moveActivity(-1)}>↑</button>
            <button aria-label="下移这个行程项目" className="btn-mini edit-only" disabled={ai === total - 1} onClick={() => moveActivity(1)}>↓</button>
            <button aria-label={`删除行程项目「${a.x || ai + 1}」`} className="btn-mini edit-only"
              onClick={() => mutate((d) => { d.days[di].items.splice(ai, 1); })}>×</button>
          </div>
        )}
      </div>
      {editUnlocked && (
        <div className="flex gap-2 items-center mb-2">
          <input className="inp editable flex-1" value={a.place} placeholder="📍 地点名称或地址（用于地图/路线），如 广东省博物馆"
            onChange={(e) => mutate((d) => { d.days[di].items[ai].place = e.target.value; })} />
          {a.place.trim() && (
            <a href={googleMapsSearchUrl(a.place)} target="_blank" rel="noopener noreferrer"
              className="btn-mini edit-only shrink-0 no-underline hover:no-underline">核对位置 ↗</a>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {editUnlocked ? (
          <input className="inp editable" value={a.move} placeholder="交通（如何前往这一站）"
            onChange={(e) => mutate((d) => { d.days[di].items[ai].move = e.target.value; })} />
        ) : a.move ? (
          <div className="rich-field"><span className="rich-label">交通</span><MarkdownText text={a.move} /></div>
        ) : null}
        {editUnlocked ? (
          <input className="inp editable" value={a.fee} placeholder="费用"
            onChange={(e) => mutate((d) => { d.days[di].items[ai].fee = e.target.value; })} />
        ) : a.fee ? (
          <div className="rich-field"><span className="rich-label">费用</span><MarkdownText text={a.fee} /></div>
        ) : null}
      </div>
      {editUnlocked && (
        <input className="inp editable mt-2" value={a.imageUrl} placeholder="图片链接（可选），如 https://…"
          onChange={(e) => mutate((d) => { d.days[di].items[ai].imageUrl = e.target.value; })} />
      )}
      {a.imageUrl && (
        <img
          key={a.imageUrl}
          src={a.imageUrl}
          alt={a.x || ''}
          loading="lazy"
          className="activity-image mt-2 h-40 w-full object-cover rounded border border-line bg-surface-2"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      {(editUnlocked || a.visitHours || a.closedDays || a.recommendedWeekdays) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2.5 pt-2.5 border-t border-dashed border-line">
          {editUnlocked ? (
            <input className="inp editable text-[12.5px]" value={a.visitHours} placeholder="开放时间，如 09:00–17:30"
              onChange={(e) => mutate((d) => { d.days[di].items[ai].visitHours = e.target.value; })} />
          ) : a.visitHours ? (
            <div className="rich-field"><span className="rich-label">开放时间</span><MarkdownText text={a.visitHours} /></div>
          ) : null}
          {editUnlocked ? (
            <input className="inp editable text-[12.5px]" value={a.closedDays} placeholder="闭馆日，如每周二"
              onChange={(e) => mutate((d) => { d.days[di].items[ai].closedDays = e.target.value; })} />
          ) : a.closedDays ? (
            <div className="rich-field"><span className="rich-label">闭馆日</span><MarkdownText text={a.closedDays} /></div>
          ) : null}
          {editUnlocked ? (
            <input className="inp editable text-[12.5px]" value={a.recommendedWeekdays} placeholder="建议星期，如周一至周四优先"
              onChange={(e) => mutate((d) => { d.days[di].items[ai].recommendedWeekdays = e.target.value; })} />
          ) : a.recommendedWeekdays ? (
            <div className="rich-field"><span className="rich-label">建议星期</span><MarkdownText text={a.recommendedWeekdays} /></div>
          ) : null}
        </div>
      )}
      {(editUnlocked || a.duration || a.accessibility || a.alternative || a.earlyExit) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-dashed border-line">
          {editUnlocked ? (
            <input className="inp editable text-[12.5px]" value={a.duration} placeholder="建议停留时长，如约2小时"
              onChange={(e) => mutate((d) => { d.days[di].items[ai].duration = e.target.value; })} />
          ) : a.duration ? (
            <div className="rich-field"><span className="rich-label">建议时长</span><MarkdownText text={a.duration} /></div>
          ) : null}
          {editUnlocked ? (
            <input className="inp editable text-[12.5px]" value={a.accessibility} placeholder="无障碍/行动不便提示"
              onChange={(e) => mutate((d) => { d.days[di].items[ai].accessibility = e.target.value; })} />
          ) : a.accessibility ? (
            <div className="rich-field"><span className="rich-label">无障碍提示</span><MarkdownText text={a.accessibility} /></div>
          ) : null}
          {editUnlocked ? (
            <input className="inp editable text-[12.5px]" value={a.alternative} placeholder="备选方案，如不适合久走可改为…"
              onChange={(e) => mutate((d) => { d.days[di].items[ai].alternative = e.target.value; })} />
          ) : a.alternative ? (
            <div className="rich-field"><span className="rich-label">备选方案</span><MarkdownText text={a.alternative} /></div>
          ) : null}
          {editUnlocked ? (
            <input className="inp editable text-[12.5px]" value={a.earlyExit} placeholder="提前离开选项"
              onChange={(e) => mutate((d) => { d.days[di].items[ai].earlyExit = e.target.value; })} />
          ) : a.earlyExit ? (
            <div className="rich-field"><span className="rich-label">提前离开</span><MarkdownText text={a.earlyExit} /></div>
          ) : null}
        </div>
      )}
      <LinkRows di={di} ai={ai} links={a.link} editUnlocked={editUnlocked} mutate={mutate} />
    </div>
  );
}

/* `move` is free text that often mentions several modes ("地铁…或打车…"), so the icon follows
   whichever keyword appears first rather than a fixed priority. */
const TRANSIT_MODES: [RegExp, string, string, TravelMode?][] = [
  [/步行|走路|walk/i, '🚶', '步行', 'walking'],
  [/地铁|号线|APM|城际|metro|subway|MRT/i, '🚇', '地铁', 'transit'],
  [/公交|巴士|快巴|bus/i, '🚌', '公交', 'transit'],
  [/打车|包车|自驾|的士|出租|网约车|专车|接机|送机|taxi|grab|car/i, '🚗', '驾车', 'driving'],
  [/船|渡轮|夜游|ferry|cruise|boat/i, '⛴️', '乘船', 'transit'],
  [/航班|飞机|flight/i, '✈️', '航班'],
  [/高铁|动车|(?:^|[^小])火车|train/i, '🚄', '火车', 'transit'],
];

function transitMode(text: string): { icon: string; label: string; travelMode?: TravelMode } {
  let best: { icon: string; label: string; travelMode?: TravelMode; at: number } | null = null;
  for (const [re, icon, label, travelMode] of TRANSIT_MODES) {
    const at = text.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { icon, label, travelMode, at };
  }
  return best ?? { icon: '➜', label: '前往' };
}

/**
 * Leg leading to a stop: its `move` text, plus a Google Maps directions link when the stop has a
 * `place` (from the previous stop's place, or from the viewer's location for the day's first stop).
 */
function TransitConnector({ text, first, to, from }: { text: string; first: boolean; to: string; from: string }) {
  const [open, setOpen] = useState(false);
  const mode = transitMode(text);
  const long = text.length > 36 || text.includes('\n');
  const directions = to.trim() ? googleDirectionsUrl(to, from, mode.travelMode) : null;
  return (
    <div className="itinerary-leg flex items-start gap-2.5 py-2 pl-[26px] text-[12.5px] text-muted">
      <span className="shrink-0 -ml-[15px] w-[30px] h-[30px] rounded-full bg-surface border border-line flex items-center justify-center text-[14px] relative z-[1]"
        role="img" aria-label={mode.label}>{mode.icon}</span>
      <div className="min-w-0 flex-1 pt-[5px]">
        {text && (
          <div className={open || !long ? '' : 'line-clamp-1 print-unclamp'}>
            {first && <span className="font-semibold text-ink-2">出发 · </span>}
            <MarkdownText text={text} className="inline !text-[12.5px] !text-muted !leading-relaxed [&>p]:inline" />
          </div>
        )}
        {(long || directions) && (
          <div className="no-print flex flex-wrap gap-x-3 mt-0.5 text-[12px] font-medium">
            {long && (
              <button className="text-jade hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                {open ? '收起' : '展开交通详情'}
              </button>
            )}
            {directions && (
              <a href={directions} target="_blank" rel="noopener noreferrer" className="text-jade hover:underline"
                title={from.trim() ? `${from.trim()} → ${to.trim()}` : `从当前位置前往 ${to.trim()}`}>
                🧭 路线{from.trim() ? '' : '（从当前位置）'} ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Read-only stop card: thumbnail + number, title, and the at-a-glance facts; the rest folds away. */
function ItineraryStop({ a, index }: { a: Activity; index: number }) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const links = a.link.filter((l) => l.url.trim());
  const extras: [string, string, boolean?][] = [
    ['闭馆日', a.closedDays, true],
    ['建议星期', a.recommendedWeekdays],
    ['无障碍提示', a.accessibility],
    ['备选方案', a.alternative],
    ['提前离开', a.earlyExit],
  ];
  const shownExtras = extras.filter(([, v]) => v.trim());
  const hasMore = shownExtras.length > 0 || links.length > 0;
  const showImage = Boolean(a.imageUrl) && !imgFailed;

  return (
    <div className="relative z-[1] bg-surface border border-line rounded p-3 shadow-xs transition-all duration-150 hover:border-line-strong hover:shadow-sm print-keep">
      <div className="flex gap-3">
        <div className="relative shrink-0 w-[84px] h-[84px] sm:w-[104px] sm:h-[104px] rounded-sm overflow-hidden border border-line bg-jade-light">
          {showImage ? (
            <img key={a.imageUrl} src={a.imageUrl} alt="" loading="lazy"
              className="activity-image w-full h-full object-cover" onError={() => setImgFailed(true)} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-jade">
              <span className="font-serif font-bold text-[28px] leading-none">{index + 1}</span>
              {a.t && <span className="text-[11px] mt-1 font-semibold">{a.t}</span>}
            </div>
          )}
          {showImage && (
            <span className="absolute top-1 left-1 min-w-[22px] h-[22px] px-1 rounded-full bg-jade-dark text-white text-[11.5px] font-bold flex items-center justify-center">
              {index + 1}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 line-clamp-3 print-unclamp">
              {a.x.trim()
                ? <MarkdownText text={a.x} className="!font-bold !text-ink !text-[14.5px] !leading-snug" />
                : <span className="text-muted">未命名行程</span>}
            </div>
            {a.t && showImage && <span className="pill shrink-0 !py-0.5 !text-[11.5px]">{a.t}</span>}
          </div>
          {a.place.trim() && (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[12px]">
              <span className="text-ink-2 min-w-0">📍 {a.place.trim()}</span>
              <span className="no-print flex gap-2">
                <a href={googleMapsSearchUrl(a.place)} target="_blank" rel="noopener noreferrer" className="text-jade hover:underline">Google 地图 ↗</a>
                <a href={amapSearchUrl(a.place)} target="_blank" rel="noopener noreferrer" className="text-jade hover:underline">高德 ↗</a>
              </span>
            </div>
          )}
          <dl className="mt-1.5 space-y-0.5 text-[12.5px] text-ink-2">
            {([
              ['建议游玩', a.duration, ''],
              ['开放', a.visitHours, ''],
              ['闭馆', a.closedDays, '!text-danger'],
              ['费用', a.fee, '!font-semibold !text-jade-dark'],
            ] as const).filter(([, v]) => v.trim()).map(([label, v, tone]) => (
              <div key={label} className="flex gap-1.5">
                <dt className={`shrink-0 ${label === '闭馆' ? 'text-danger' : 'text-muted'}`}>{label}</dt>
                <dd className="min-w-0 m-0"><MarkdownText text={v} className={`!text-[12.5px] !leading-normal ${tone}`} /></dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {hasMore && (
        <>
          <button className="no-print mt-2 text-jade text-[12.5px] font-medium hover:underline" aria-expanded={open}
            onClick={() => setOpen((v) => !v)}>
            {open ? '收起详情 ▴' : `更多详情${links.length ? ` · ${links.length} 个链接` : ''} ▾`}
          </button>
          <div className={`${open ? '' : 'hidden'} print-show mt-2.5 pt-2.5 border-t border-dashed border-line`}>
            {shownExtras.filter(([label]) => label !== '闭馆日').length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {shownExtras.filter(([label]) => label !== '闭馆日').map(([label, v]) => (
                  <div key={label} className="rich-field"><span className="rich-label">{label}</span><MarkdownText text={v} /></div>
                ))}
              </div>
            )}
            {links.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
                {links.map((l, li) => (
                  <a key={li} href={l.url} target="_blank" rel="noopener noreferrer" className="text-jade text-[12.5px] hover:underline">
                    ↗ {l.label || l.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DayCard({ d, i, total, collapsed, editUnlocked, mutate, mutateNoSave, date, dayWeather, state, authorName, showDiscussionInPrint }: {
  d: Day; i: number; total: number; collapsed: boolean;
  editUnlocked: boolean; mutate: Mutate; mutateNoSave: Mutate;
  date: string | null; dayWeather?: { tMax: number; tMin: number; precipProb: number; code: number };
  state: TripState; authorName: string; showDiscussionInPrint: boolean;
}) {
  const [showMap, setShowMap] = useState(false);
  const embedSrc = d.mapUrl ? toMapEmbedSrc(d.mapUrl) : null;

  const moveDay = (delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= total) return;
    mutate((s) => {
      [s.days[i], s.days[j]] = [s.days[j], s.days[i]];
      s.days.forEach((day, k) => (day.n = k + 1));
      s.notes.forEach((n) => {
        if (n.target?.type === 'day' && n.target.index === i) n.target.index = j;
        else if (n.target?.type === 'day' && n.target.index === j) n.target.index = i;
      });
    });
  };

  return (
    <article id={`day-${i + 1}`} data-day-index={i} className="day-card bg-surface border border-line rounded-lg overflow-hidden mb-3.5 shadow-xs">
      {/* Day header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-surface-3 border-b border-line flex-wrap print-head">
        <span className="bg-jade-dark text-white rounded-[5px] px-2.5 py-1 font-bold text-[11.5px] tracking-[0.06em] shrink-0">
          D{i + 1}
        </span>
        {date && (
          <span className="text-muted text-[12px] font-semibold shrink-0" title={dayWeather ? `${dayWeather.tMax}° / ${dayWeather.tMin}° · 降雨概率 ${dayWeather.precipProb}%` : undefined}>
            {formatDateWithWeekday(date)}
            {dayWeather && <> <span aria-hidden="true">{weatherEmoji(dayWeather.code)}</span> {dayWeather.tMax}°/{dayWeather.tMin}°</>}
          </span>
        )}
        {editUnlocked ? (
          <input
            className="inp-bare editable flex-1 min-w-[140px] font-bold text-[15px] font-serif py-1"
            value={d.title}
            onChange={(e) => mutate((s) => { s.days[i].title = e.target.value; })}
          />
        ) : <h3 className="flex-1 min-w-[140px] font-bold text-[15px] font-serif py-1">{d.title}</h3>}
        <span className={`pill border ${intensityClass(d.intensity)}`}>{intensityLabel(d.intensity)}</span>
        <div className="flex gap-1.5 ml-auto">
          {d.mapUrl && (
            <button
              className={`no-print btn-mini flex items-center gap-1 ${showMap ? 'bg-jade-dark !text-white border-jade-dark' : ''}`}
              onClick={() => setShowMap((v) => !v)}
            >
              🗺️ {showMap ? '收起地图' : '查看地图'}
            </button>
          )}
          <button className="no-print btn-mini" aria-expanded={!collapsed}
            onClick={() => mutateNoSave((s) => { s.collapsed[i] = !s.collapsed[i]; })}>
            {collapsed ? '展开 ▾' : '折叠 ▴'}
          </button>
          {editUnlocked && (
            <>
              <button aria-label="上移这一天" className="btn-mini edit-only" disabled={i === 0} onClick={() => moveDay(-1)}>↑</button>
              <button aria-label="下移这一天" className="btn-mini edit-only" disabled={i === total - 1} onClick={() => moveDay(1)}>↓</button>
              <button aria-label={`删除 D${i + 1}「${d.title || ''}」`} className="btn-mini edit-only"
                onClick={async () => {
                  if (!await confirmDialog('删除这个 Day？', { title: '删除 Day', confirmLabel: '删除', danger: true })) return;
                  mutate((s) => {
                    s.days.splice(i, 1);
                    s.days.forEach((day, k) => (day.n = k + 1));
                    s.notes = s.notes.filter((n) => !(n.target?.type === 'day' && n.target.index === i));
                    s.notes.forEach((n) => { if (n.target?.type === 'day' && n.target.index > i) n.target.index -= 1; });
                  });
                }}>
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {/* Map panel — independent of collapse, shown when toggled */}
      {showMap && d.mapUrl && (
        <div className="no-print border-b border-line">
          <div className="flex items-center justify-between px-4 py-1.5 bg-surface-2 border-b border-dashed border-line">
            <span className="text-[11.5px] text-muted">地图预览</span>
            <a
              href={d.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-jade text-[12px] hover:underline"
            >
              ↗ 在新标签页打开
            </a>
          </div>
          {embedSrc ? (
            <iframe
              src={embedSrc}
              className="w-full border-0 block"
              style={{ height: '260px' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`${d.title} 地图`}
              allowFullScreen
            />
          ) : (
            <p className="px-4 py-6 text-[13px] text-muted text-center">
              这个链接暂时无法直接预览，点击上方「在新标签页打开」查看。
            </p>
          )}
          <p className="px-4 py-2 text-[11px] text-muted bg-surface-2 border-t border-dashed border-line">
            提示：可直接填写地址或地点名称（如「东京塔」），也可粘贴 Google Maps 链接。
          </p>
        </div>
      )}

      {/* Day body — folded days stay in the DOM (hidden on screen only) so they still print */}
      <div className={`p-4${collapsed ? ' hidden print-show' : ''}`}>
          <div className="flex gap-2 flex-wrap mb-3.5">
            {editUnlocked ? (
              <select className="inp editable w-full sm:w-auto" value={d.intensity}
                onChange={(e) => mutate((s) => { s.days[i].intensity = e.target.value as Intensity; })}>
                <option value="light">轻松</option>
                <option value="medium">中等</option>
                <option value="heavy">较累</option>
              </select>
            ) : <span className={`pill border ${intensityClass(d.intensity)}`}>体力：{intensityLabel(d.intensity)}</span>}
            {editUnlocked ? (
              <input className="inp editable flex-1 min-w-[180px]" value={d.steps} placeholder="步行时长/体力提示"
                onChange={(e) => mutate((s) => { s.days[i].steps = e.target.value; })} />
            ) : d.steps ? <div className="rich-field flex-1 min-w-[180px]"><span className="rich-label">步行提示</span><MarkdownText text={d.steps} /></div> : null}
            {editUnlocked ? (
              <input
                className="inp editable flex-1 min-w-[180px]"
                value={d.mapUrl}
                placeholder="地址 / 地点名称，或粘贴 Google Maps 链接"
                onChange={(e) => mutate((s) => { s.days[i].mapUrl = e.target.value; })}
              />
            ) : null}
          </div>

          {editUnlocked ? d.items.map((a, j) => (
            <ActivityRow key={j} a={a} di={i} ai={j} total={d.items.length} editUnlocked={editUnlocked} mutate={mutate} />
          )) : d.items.length ? (
            <ol className="itinerary-timeline list-none m-0 p-0">
              {d.items.map((a, j) => (
                <li key={j}>
                  {a.move.trim() || a.place.trim()
                    ? <TransitConnector text={a.move.trim()} first={j === 0} to={a.place} from={j > 0 ? d.items[j - 1].place : ''} />
                    : j > 0 && <div className="h-3" aria-hidden="true" />}
                  <ItineraryStop key={a.imageUrl} a={a} index={j} />
                </li>
              ))}
            </ol>
          ) : <p className="text-muted text-[13px] text-center py-4">这一天还没有安排行程</p>}

          {editUnlocked && (
            <button className="add-btn edit-only"
              onClick={() => mutate((s) => { s.days[i].items.push(defaultActivity()); })}>
              ＋ 添加行程项目
            </button>
          )}

          <label className="block text-muted text-[12px] font-semibold mt-3 mb-1.5">Day 备注</label>
          {editUnlocked ? (
            <textarea
              className="inp editable w-full min-h-[60px] resize-y"
              value={d.notes || ''}
              placeholder="当天注意事项、老人休息安排、备选方案等"
              onChange={(e) => mutate((s) => { s.days[i].notes = e.target.value; })}
            />
          ) : d.notes ? (
            <div className="rich-field mt-2"><span className="rich-label">当天备注</span><MarkdownText text={d.notes} /></div>
          ) : null}

          <CommentThread state={state} editUnlocked={editUnlocked} mutate={mutate} targetType="day" targetIndex={i} authorName={authorName} printVisible={showDiscussionInPrint} />
      </div>
    </article>
  );
}

/** One row of the 行程总览 list: the day at a glance, with its stops as a numbered list. Click to jump to the day. */
function DayOverviewRow({ d, i, date, dayWeather, onOpen }: {
  d: Day; i: number; date: string | null;
  dayWeather?: { tMax: number; tMin: number; code: number };
  onOpen: () => void;
}) {
  return (
    <button onClick={onOpen}
      className="w-full text-left bg-surface border border-line rounded p-3.5 mb-2.5 shadow-xs transition-all duration-150 hover:border-jade hover:shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="bg-jade-dark text-white rounded-[5px] px-2 py-0.5 font-bold text-[11.5px] tracking-[0.06em] shrink-0">D{i + 1}</span>
        {date && (
          <span className="text-muted text-[12px] font-semibold">
            {formatDateWithWeekday(date)}
            {dayWeather && <> <span aria-hidden="true">{weatherEmoji(dayWeather.code)}</span> {dayWeather.tMax}°/{dayWeather.tMin}°</>}
          </span>
        )}
        <span className={`pill border !py-0.5 ml-auto ${intensityClass(d.intensity)}`}>{intensityLabel(d.intensity)}</span>
      </div>
      <h3 className="font-serif font-bold text-[15.5px] text-ink mt-1.5">{d.title || `Day ${i + 1}`}</h3>
      {d.items.length > 0 && (
        <ol className="list-none m-0 p-0 mt-1.5 space-y-0.5">
          {d.items.map((a, j) => (
            <li key={j} className="flex gap-2 text-[12.5px] text-ink-2 min-w-0">
              <span className="shrink-0 w-[18px] h-[18px] mt-[2px] rounded-full bg-jade-light text-jade text-[10.5px] font-bold flex items-center justify-center">{j + 1}</span>
              {a.t && <span className="shrink-0 text-muted">{a.t}</span>}
              <span className="min-w-0 truncate">{a.x.replace(/\*\*/g, '')}</span>
            </li>
          ))}
        </ol>
      )}
      <span className="block text-jade text-[12.5px] font-medium mt-2">查看当天行程 →</span>
    </button>
  );
}

/**
 * Day-by-day itinerary, all days stacked for continuous scrolling. The sticky pill bar
 * (总览 + one pill per day) jumps to a day on click and follows the scroll position
 * (scroll-spy), trip.com-style.
 */
export default function DaysSection({
  state, editUnlocked, mutate, mutateNoSave, startDate, weather, authorName, showDiscussionInPrint = true,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate; mutateNoSave: Mutate;
  startDate: string | null; weather: WeatherResult | 'loading' | null; authorName: string;
  showDiscussionInPrint?: boolean;
}) {
  const weatherByDate = weather && weather !== 'loading' && weather.status === 'ok'
    ? new Map(weather.days.map((w) => [w.date, w]))
    : null;
  /** Day whose card sits under the pill bar; null while the overview (above Day 1) is in view. */
  const [active, setActive] = useState<number | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const tabsRef = useRef<HTMLDivElement>(null);
  /** Suppresses scroll-spy while a pill-click smooth scroll passes over the days in between. */
  const spyLockUntil = useRef(0);
  const dayCount = state.days.length;

  useEffect(() => {
    let frame = 0;
    const recompute = () => {
      frame = 0;
      if (Date.now() < spyLockUntil.current) return;
      const line = (tabsRef.current?.getBoundingClientRect().bottom ?? 0) + 12;
      let current: number | null = null;
      document.querySelectorAll<HTMLElement>('.day-card').forEach((el) => {
        if (el.getBoundingClientRect().top <= line) current = Number(el.dataset.dayIndex);
      });
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(recompute); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    recompute();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [dayCount]);

  /* Keep the active pill centred in the horizontally scrolling bar. */
  useEffect(() => {
    const bar = tabsRef.current;
    const pill = bar?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!bar || !pill) return;
    bar.scrollTo({ left: pill.offsetLeft - bar.clientWidth / 2 + pill.offsetWidth / 2, behavior: 'smooth' });
  }, [active]);

  const jumpTo = (i: number | null) => {
    const target = document.getElementById(i === null ? 'itinerary' : `day-${i + 1}`);
    if (!target) return;
    const barHeight = tabsRef.current?.getBoundingClientRect().height ?? 0;
    const top = target.getBoundingClientRect().top + window.scrollY - (i === null ? 115 : 115 + barHeight + 4);
    setActive(i);
    spyLockUntil.current = Date.now() + 900;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const setAllCollapsed = (value: boolean) =>
    mutateNoSave((s) => { s.days.forEach((_, i) => { s.collapsed[i] = value; }); });
  const allCollapsed = dayCount > 0 && state.days.every((_, i) => state.collapsed[i]);

  const tabClass = (on: boolean) =>
    `shrink-0 flex flex-col items-center justify-center min-w-[64px] px-3.5 py-1.5 rounded-full border-[1.5px] text-[13px] font-semibold leading-tight transition-colors ${
      on ? 'bg-jade-dark border-jade-dark text-white' : 'bg-surface border-line text-ink-2 hover:border-jade hover:text-jade'
    }`;

  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">🗓️ 行程</h2>
        <div className="flex items-center gap-2">
          <span className="text-muted text-[13px] hidden sm:inline">{dayCount} 天 · 任意天数 · 可自由调整顺序</span>
          {dayCount > 0 && (
            <button className="btn-mini no-print" onClick={() => setAllCollapsed(!allCollapsed)}>
              {allCollapsed ? '全部展开' : '全部折叠'}
            </button>
          )}
        </div>
      </div>

      {dayCount > 0 && (
        <div ref={tabsRef} role="tablist" aria-label="跳到某一天"
          className="day-tabs no-print sticky top-[115px] z-30 -mx-1 px-1 py-2 mb-3 flex gap-2 overflow-x-auto bg-bg/95 backdrop-blur-md">
          <button role="tab" aria-selected={active === null} className={tabClass(active === null)} onClick={() => jumpTo(null)}>
            ☰ 总览
          </button>
          {state.days.map((_, i) => {
            const date = dayDate(startDate, i);
            return (
              <button key={i} role="tab" aria-selected={active === i} className={tabClass(active === i)} onClick={() => jumpTo(i)}>
                <span>Day {i + 1}</span>
                {date && <span className={`text-[10.5px] font-medium ${active === i ? 'text-white/80' : 'text-muted'}`}>{formatDateWithWeekday(date)}</span>}
              </button>
            );
          })}
        </div>
      )}

      {dayCount > 0 && (
        <div className="no-print mb-4">
          <button className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 mb-2 hover:text-jade" aria-expanded={overviewOpen}
            onClick={() => setOverviewOpen((v) => !v)}>
            ☰ 行程总览 <span className="text-muted font-normal">{overviewOpen ? '▴ 收起' : '▾ 展开'}</span>
          </button>
          {overviewOpen && state.days.map((d, i) => {
            const date = dayDate(startDate, i);
            return <DayOverviewRow key={i} d={d} i={i} date={date} dayWeather={date ? weatherByDate?.get(date) : undefined} onOpen={() => jumpTo(i)} />;
          })}
        </div>
      )}

      {state.days.map((d, i) => {
        const date = dayDate(startDate, i);
        return (
          <DayCard
            key={i} d={d} i={i} total={dayCount}
            collapsed={Boolean(state.collapsed[i])}
            editUnlocked={editUnlocked} mutate={mutate} mutateNoSave={mutateNoSave}
            date={date} dayWeather={date ? weatherByDate?.get(date) : undefined}
            state={state} authorName={authorName} showDiscussionInPrint={showDiscussionInPrint}
          />
        );
      })}

      {editUnlocked && (
        <button className="add-btn edit-only"
          onClick={() => mutate((s) => { s.days.push(defaultDay(s.days.length + 1)); })}>
          ＋ 添加 Day
        </button>
      )}
      {state.days.length === 0 && !editUnlocked && <div className="empty-state">还没有安排 Day</div>}
    </section>
  );
}
