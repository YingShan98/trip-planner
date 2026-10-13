import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { defaultActivity, defaultDay } from '../../state';
import type { Activity, Day, Hotel, Intensity, Mutate, TripState } from '../../types';
import { confirmDialog } from '../../lib/confirm';
import { amapSearchUrl, googleDirectionsUrl, googleMapsSearchUrl, googleRouteEmbedSrc, googleRouteUrl, mapLinkKind, mapLinkLabel, MAX_ROUTE_STOPS, searchablePlace, toMapEmbedSrc } from '../../lib/mapEmbed';
import { getRoutePref, parseRouteOptions, setRoutePref, subscribeRoutePref, transitMode, type RouteOption } from '../../lib/routeOptions';
import { dayDate, formatDateWithWeekday } from '../../lib/format';
import { weatherEmoji, type WeatherResult } from '../../lib/weather';
import MarkdownText from '../MarkdownText';
import CommentThread from './CommentThread';
import { parseTimeRange, formatTimeRange } from '../../lib/activityTime';
import AutoGrowTextarea from '../AutoGrowTextarea';
import AmapRoute, { AMAP_MAX_STOPS, type AmapMode } from './AmapRoute';
import { hasAmap } from '../../lib/amap';
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
  const [showMore, setShowMore] = useState(false);
  const moveActivity = (delta: number) => {
    const j = ai + delta;
    if (j < 0 || j >= total) return;
    mutate((s) => { [s.days[di].items[ai], s.days[di].items[j]] = [s.days[di].items[j], s.days[di].items[ai]]; });
  };

  return (
    <div className="bg-surface-2 border border-line rounded p-3 mb-2.5 transition-all duration-150 hover:border-line-strong hover:shadow-xs print-keep">
      <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr_auto] gap-2 items-center mb-2">
        {editUnlocked ? (
          <div className="flex items-center gap-1">
            <input type="time" aria-label="开始时间" className="inp editable !px-2 text-[12.5px] w-[86px]"
              value={parseTimeRange(a.t).start}
              onChange={(e) => mutate((d) => {
                const { end } = parseTimeRange(d.days[di].items[ai].t);
                d.days[di].items[ai].t = formatTimeRange(e.target.value, end);
              })} />
            <span className="text-muted text-[12px] shrink-0" aria-hidden="true">→</span>
            <input type="time" aria-label="结束时间" className="inp editable !px-2 text-[12.5px] w-[86px]"
              value={parseTimeRange(a.t).end}
              onChange={(e) => mutate((d) => {
                const { start } = parseTimeRange(d.days[di].items[ai].t);
                d.days[di].items[ai].t = formatTimeRange(start, e.target.value);
              })} />
          </div>
        ) : <span className="pill justify-center">{a.t || '时间待定'}</span>}
        {editUnlocked ? (
          <AutoGrowTextarea className="inp editable" value={a.x} placeholder="行程内容"
            onChange={(v) => mutate((d) => { d.days[di].items[ai].x = v; })} />
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
          <AutoGrowTextarea className="inp editable flex-1" value={a.place} placeholder="📍 地点名称或地址（用于地图/路线），如 广东省博物馆；也可粘贴 Google / 高德地图链接"
            onChange={(v) => mutate((d) => { d.days[di].items[ai].place = v; })} />
          {a.place.trim() && (
            <a href={searchablePlace(a.place) ? googleMapsSearchUrl(a.place) : a.place.trim()} target="_blank" rel="noopener noreferrer"
              className="btn-mini edit-only shrink-0 no-underline hover:no-underline">核对位置 ↗</a>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {editUnlocked ? (
          <AutoGrowTextarea singleLine={false} className="inp editable" value={a.move} placeholder="交通：多个方案各占一行会变成可切换的选项，如「🚐 包车：酒店 > 长隆 ⏱️ 约40分钟」「🚇 地铁：…」"
            onChange={(v) => mutate((d) => { d.days[di].items[ai].move = v; })} />
        ) : a.move ? (
          <div className="rich-field"><span className="rich-label">交通</span><MarkdownText text={a.move} /></div>
        ) : null}
        {editUnlocked ? (
          <AutoGrowTextarea singleLine={false} className="inp editable" value={a.fee} placeholder="费用"
            onChange={(v) => mutate((d) => { d.days[di].items[ai].fee = v; })} />
        ) : a.fee ? (
          <div className="rich-field"><span className="rich-label">费用</span><MarkdownText text={a.fee} /></div>
        ) : null}
      </div>
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
      {editUnlocked ? (
        <>
          <button className="no-print text-jade text-[12.5px] font-medium text-left hover:underline mt-1" aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}>
            {showMore ? '收起字段 ▴' : '更多字段 ▾'}
          </button>
          <div className={showMore ? 'flex flex-col gap-2.5' : 'hidden'}>
            <input className="inp editable" value={a.imageUrl} placeholder="图片链接（可选），如 https://…"
              onChange={(e) => mutate((d) => { d.days[di].items[ai].imageUrl = e.target.value; })} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input className="inp editable text-[12.5px]" value={a.visitHours} placeholder="开放时间，如 09:00–17:30"
                onChange={(e) => mutate((d) => { d.days[di].items[ai].visitHours = e.target.value; })} />
              <input className="inp editable text-[12.5px]" value={a.closedDays} placeholder="闭馆日，如每周二"
                onChange={(e) => mutate((d) => { d.days[di].items[ai].closedDays = e.target.value; })} />
              <input className="inp editable text-[12.5px]" value={a.recommendedWeekdays} placeholder="建议星期，如周一至周四优先"
                onChange={(e) => mutate((d) => { d.days[di].items[ai].recommendedWeekdays = e.target.value; })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="inp editable text-[12.5px]" value={a.duration} placeholder="建议停留时长，如约2小时"
                onChange={(e) => mutate((d) => { d.days[di].items[ai].duration = e.target.value; })} />
              <AutoGrowTextarea singleLine={false} className="inp editable text-[12.5px]" value={a.accessibility} placeholder="无障碍/行动不便提示"
                onChange={(v) => mutate((d) => { d.days[di].items[ai].accessibility = v; })} />
              <AutoGrowTextarea singleLine={false} className="inp editable text-[12.5px]" value={a.alternative} placeholder="备选方案，如不适合久走可改为…"
                onChange={(v) => mutate((d) => { d.days[di].items[ai].alternative = v; })} />
              <AutoGrowTextarea singleLine={false} className="inp editable text-[12.5px]" value={a.earlyExit} placeholder="提前离开选项"
                onChange={(v) => mutate((d) => { d.days[di].items[ai].earlyExit = v; })} />
            </div>
            <LinkRows di={di} ai={ai} links={a.link} editUnlocked={editUnlocked} mutate={mutate} />
          </div>
        </>
      ) : (
        <>
          {(a.visitHours || a.closedDays || a.recommendedWeekdays) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2.5 pt-2.5 border-t border-dashed border-line">
              {a.visitHours && <div className="rich-field"><span className="rich-label">开放时间</span><MarkdownText text={a.visitHours} /></div>}
              {a.closedDays && <div className="rich-field"><span className="rich-label">闭馆日</span><MarkdownText text={a.closedDays} /></div>}
              {a.recommendedWeekdays && <div className="rich-field"><span className="rich-label">建议星期</span><MarkdownText text={a.recommendedWeekdays} /></div>}
            </div>
          )}
          {(a.duration || a.accessibility || a.alternative || a.earlyExit) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-dashed border-line">
              {a.duration && <div className="rich-field"><span className="rich-label">建议时长</span><MarkdownText text={a.duration} /></div>}
              {a.accessibility && <div className="rich-field"><span className="rich-label">无障碍提示</span><MarkdownText text={a.accessibility} /></div>}
              {a.alternative && <div className="rich-field"><span className="rich-label">备选方案</span><MarkdownText text={a.alternative} /></div>}
              {a.earlyExit && <div className="rich-field"><span className="rich-label">提前离开</span><MarkdownText text={a.earlyExit} /></div>}
            </div>
          )}
          <LinkRows di={di} ai={ai} links={a.link} editUnlocked={editUnlocked} mutate={mutate} />
        </>
      )}
    </div>
  );
}

/** Index of the route to show: the viewer's own pick on this stop while it still matches their preferred
 *  kind of route, else the first route of the preferred kind, else the first route. */
function useRouteChoice(options: RouteOption[]): [number, (i: number) => void] {
  const pref = useSyncExternalStore(subscribeRoutePref, getRoutePref);
  const [picked, setPicked] = useState<{ index: number; pref: string } | null>(null);
  const prefIndex = pref ? options.findIndex((o) => o.mode.label === pref) : -1;
  const index = picked && picked.pref === pref ? picked.index : Math.max(prefIndex, 0);
  const choose = (i: number) => {
    const mode = options[i].mode.label;
    setPicked({ index: i, pref: mode });
    setRoutePref(mode);
  };
  return [Math.min(index, options.length - 1), choose];
}

/** One route's details: an "A > B > C" route as a vertical list of stops, otherwise the text as written. */
function RouteDetails({ option }: { option: RouteOption }) {
  return (
    <div className="mt-2 rounded-sm bg-surface-2 border border-line px-3 py-2.5 text-ink-2">
      {option.steps.length > 0 ? (
        <ol className="route-steps list-none m-0 p-0">
          {option.steps.map((step, i) => (
            <li key={i} className="relative pl-5 py-0.5 text-[13px] leading-snug">
              <span className={`absolute left-0 top-[7px] w-[9px] h-[9px] rounded-full border-2 ${i === 0 || i === option.steps.length - 1 ? 'bg-jade border-jade' : 'bg-surface border-jade-mid'}`} aria-hidden="true" />
              <MarkdownText text={step} className="!text-[13px] !leading-snug" />
            </li>
          ))}
        </ol>
      ) : null}
      {option.detail && (
        <MarkdownText text={option.detail} className={`!text-[12.5px] !leading-relaxed ${option.steps.length ? 'mt-1.5 !text-muted' : ''}`} />
      )}
    </div>
  );
}

/** How 高德 should draw a leg, from the kind of transport the leg's text (or chosen route tab) names. */
function amapLegMode(modeLabel: string): AmapMode {
  if (modeLabel === '步行') return 'walking';
  if (modeLabel === '地铁' || modeLabel === '公交') return 'transit';
  if (modeLabel === '火车' || modeLabel === '航班' || modeLabel === '乘船') return 'line';
  return 'driving';
}

/**
 * Leg leading to a stop: its `move` text, plus a Google Maps directions link when the stop has a
 * `place` (from the previous stop's place, or from the viewer's location for the day's first stop).
 * When the text lists several routes ("🚐 包车：…" / "🚇 公共交通：…") they become tabs.
 */
function TransitConnector({ text, first, to, from, previewFrom, cityHint }: {
  text: string; first: boolean; to: string; from: string; cityHint: string;
  /** Start point for the map preview: `from`, or last night's hotel for the day's first leg. */
  previewFrom: string;
}) {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { notes, options } = useMemo(() => parseRouteOptions(text), [text]);
  const multi = options.length >= 2;
  const [chosen, chooseRoute] = useRouteChoice(options);
  const route = multi ? options[chosen] : null;

  // Only walking or driving can be drawn in China (no transit data there); anything else previews as driving.
  const previewMode = (route?.mode ?? transitMode(text)).travelMode === 'walking' ? 'walking' : 'driving';
  const previewSrc = to.trim() && previewFrom.trim() && previewFrom.trim() !== to.trim()
    ? googleRouteEmbedSrc([previewFrom, to], previewMode) : null;
  const googleLeg = previewSrc && (
    <>
      <iframe src={previewSrc} className="w-full border-0 block" style={{ height: '220px' }} loading="lazy"
        referrerPolicy="no-referrer-when-downgrade" title={`${previewFrom} → ${to} 路线`} allowFullScreen />
      <p className="px-2.5 py-1.5 m-0 text-[11px] text-muted">
        {previewFrom} → {to} · {previewMode === 'walking' ? '步行' : '驾车'}路线（Google 在中国大陆不提供地铁/公交路线）
      </p>
    </>
  );

  /* Picking a route switches every stop on the page, and the ones above can change height (one line of
     text ⇄ a list of stops). Keep the tapped tab row where it was on screen — not every browser
     anchors scrolling on its own. */
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabsTopRef = useRef<number | null>(null);
  const choose = (i: number) => {
    tabsTopRef.current = tabsRef.current?.getBoundingClientRect().top ?? null;
    chooseRoute(i);
  };
  useLayoutEffect(() => {
    const before = tabsTopRef.current;
    tabsTopRef.current = null;
    if (before === null || !tabsRef.current) return;
    const delta = tabsRef.current.getBoundingClientRect().top - before;
    if (Math.abs(delta) >= 1) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
  }, [chosen]);
  const mode = route ? route.mode : transitMode(text);
  const long = text.length > 36 || text.includes('\n');
  const directions = to.trim() ? googleDirectionsUrl(to, from, mode.travelMode) : null;
  return (
    <div className="itinerary-leg flex items-start gap-2.5 py-2 pl-[26px] text-[12.5px] text-muted">
      <span className="shrink-0 -ml-[15px] w-[30px] h-[30px] rounded-full bg-surface border border-line flex items-center justify-center text-[14px] relative z-[1]"
        role="img" aria-label={mode.label}>{route?.icon ?? mode.icon}</span>
      <div className="min-w-0 flex-1 pt-[5px]">
        {multi ? (
          <>
            <div className="no-print">
              {(first || notes) && (
                <div className="mb-1.5">
                  {first && <span className="font-semibold text-ink-2">出发{notes ? ' · ' : ''}</span>}
                  {notes && <MarkdownText text={notes} className="inline !text-[12.5px] !text-muted !leading-relaxed [&>p]:inline" />}
                </div>
              )}
              <div ref={tabsRef} role="tablist" aria-label="交通方式" className="flex gap-1.5 overflow-x-auto day-tabs -mx-0.5 px-0.5">
                {options.map((o, i) => (
                  <button key={i} role="tab" aria-selected={i === chosen} onClick={() => choose(i)}
                    className={`shrink-0 flex items-center gap-1 rounded-full border-[1.5px] px-2.5 py-1 min-h-[34px] text-[12.5px] font-semibold transition-colors ${
                      i === chosen ? 'bg-jade-dark border-jade-dark text-white' : 'bg-surface border-line text-ink-2 hover:border-jade hover:text-jade'
                    }`}>
                    <span aria-hidden="true">{o.icon ?? o.mode.icon}</span>
                    <span>{o.tabLabel}</span>
                    {o.duration && <span className={`font-medium ${i === chosen ? 'text-white/75' : 'text-muted'}`}>{o.duration.replace(/^约/, '')}</span>}
                  </button>
                ))}
              </div>
              {route && <RouteDetails option={route} />}
            </div>
            {/* On paper every route is listed, as written. */}
            <div className="hidden print-show">
              <MarkdownText text={text} className="!text-[12.5px] !text-muted !leading-relaxed" />
            </div>
          </>
        ) : text && (
          <div className={open || !long ? '' : 'line-clamp-1 print-unclamp'}>
            {first && <span className="font-semibold text-ink-2">出发 · </span>}
            <MarkdownText text={text} className="inline !text-[12.5px] !text-muted !leading-relaxed [&>p]:inline" />
          </div>
        )}
        {((long && !multi) || directions || previewSrc) && (
          <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-[12px] font-medium">
            {long && !multi && (
              <button className="text-jade hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                {open ? '收起' : '展开交通详情'}
              </button>
            )}
            {directions && (
              <a href={directions} target="_blank" rel="noopener noreferrer" className="btn-mini !text-jade no-underline hover:no-underline"
                title={from.trim() ? `${from.trim()} → ${to.trim()}` : `从当前位置前往 ${to.trim()}`}>
                🧭 {multi ? `${mode.label}路线` : '路线'}{from.trim() ? '' : '（从当前位置）'} ↗
              </a>
            )}
            {previewSrc && (
              <button className={`btn-mini ${showPreview ? 'bg-jade-dark !text-white border-jade-dark' : '!text-jade'}`}
                aria-expanded={showPreview} onClick={() => setShowPreview((v) => !v)}>
                🗺️ {showPreview ? '收起预览' : '预览路线'}
              </button>
            )}
          </div>
        )}
        {showPreview && previewSrc && (
          <div className="no-print mt-2 rounded-sm overflow-hidden border border-line bg-surface-2">
            {/* 高德 when configured (works on a Chinese SIM, and plans 地铁/公交); Google otherwise. */}
            <AmapRoute stops={[previewFrom, to]} mode={amapLegMode(mode.label)} cityHint={cityHint} height={220}
              fallback={googleLeg} />
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
            <div className="min-w-0 flex-1 break-words">
              {a.x.trim()
                ? <MarkdownText text={a.x} className="!font-bold !text-ink !text-[14.5px] !leading-snug" />
                : <span className="text-muted">未命名行程</span>}
            </div>
            {a.t && showImage && <span className="pill shrink-0 !py-0.5 !text-[11.5px]">{a.t}</span>}
          </div>
          {a.place.trim() && (searchablePlace(a.place) ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[12px]">
              <span className="text-ink-2 min-w-0">📍 {a.place.trim()}</span>
              <span className="no-print flex gap-1.5 mt-1">
                <a href={googleMapsSearchUrl(a.place)} target="_blank" rel="noopener noreferrer" className="btn-mini !text-jade no-underline hover:no-underline">Google 地图 ↗</a>
                <a href={amapSearchUrl(a.place)} target="_blank" rel="noopener noreferrer" className="btn-mini !text-jade no-underline hover:no-underline">高德 ↗</a>
              </span>
            </div>
          ) : (
            // A pasted map link: one button that opens it, in 高德 or Google Maps as the link says.
            <div className="no-print mt-1.5">
              <a href={a.place.trim()} target="_blank" rel="noopener noreferrer" className="btn-mini !text-jade no-underline hover:no-underline">
                📍 {mapLinkLabel(mapLinkKind(a.place))} ↗
              </a>
            </div>
          ))}
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

/** Where a day's hotel is, for maps: the matching candidate's address when it has one — chain hotel
 *  names are ambiguous (Google put "James Joyce Coffetel Hotel" at another branch across town) —
 *  else the name. '' when there's no hotel or it's a pasted link. */
function hotelLocation(name: string, hotels: Hotel[]): string {
  const addr = hotels.find((h) => h.name.trim() === name.trim())?.addr.trim();
  return searchablePlace(addr || name);
}

/** End-of-day card: where the group sleeps tonight, with the address and map/directions links when it
 *  matches one of the trip's hotel candidates by name. */
function DayHotel({ name, hotels }: { name: string; hotels: Hotel[] }) {
  const hotel = hotels.find((h) => h.name.trim() === name.trim());
  const addr = hotel?.addr.trim() || '';
  const where = hotelLocation(name, hotels) || name.trim();
  return (
    <div className="mt-3.5 flex gap-3 items-start rounded border-[1.5px] border-jade-tint bg-jade-light px-3.5 py-3 print-keep">
      <span className="text-[22px] leading-none mt-0.5" aria-hidden="true">🏨</span>
      <div className="min-w-0 flex-1">
        <span className="rich-label !text-jade">今晚住宿</span>
        <strong className="block font-serif text-[15.5px] text-jade-dark leading-snug break-words">{name.trim()}</strong>
        {addr && <div className="text-[12.5px] text-ink-2 mt-0.5 break-words">📍 {addr}</div>}
        <div className="no-print flex flex-wrap gap-1.5 mt-2">
          <a href={googleDirectionsUrl(where)} target="_blank" rel="noopener noreferrer" className="btn-mini !text-jade no-underline hover:no-underline">🧭 回酒店 ↗</a>
          <a href={googleMapsSearchUrl(where)} target="_blank" rel="noopener noreferrer" className="btn-mini !text-jade no-underline hover:no-underline">Google 地图 ↗</a>
          <a href={amapSearchUrl(where)} target="_blank" rel="noopener noreferrer" className="btn-mini !text-jade no-underline hover:no-underline">高德 ↗</a>
        </div>
      </div>
    </div>
  );
}

function DayCard({ d, i, total, collapsed, isToday, editUnlocked, mutate, mutateNoSave, date, dayWeather, state, authorName, showDiscussionInPrint, cityHint }: {
  cityHint: string;
  d: Day; i: number; total: number; collapsed: boolean; isToday: boolean;
  editUnlocked: boolean; mutate: Mutate; mutateNoSave: Mutate;
  date: string | null; dayWeather?: { tMax: number; tMin: number; precipProb: number; code: number };
  state: TripState; authorName: string; showDiscussionInPrint: boolean;
}) {
  const [showMap, setShowMap] = useState(false);
  const [mapTab, setMapTab] = useState<'route' | 'map'>('route');
  const embedSrc = d.mapUrl ? toMapEmbedSrc(d.mapUrl) : null;
  /* A 高德 link opens straight in 高德 (its share pages can't be previewed); a Google link or a plain
     place name gets the embedded Google map preview. */
  const mapKind = mapLinkKind(d.mapUrl);
  const mapOpenUrl = mapKind === 'place' ? googleMapsSearchUrl(d.mapUrl) : d.mapUrl.trim();

  /* The day's route: from last night's hotel, through every stop with a searchable 📍 place, to tonight's
     hotel. Repeats in a row (several stops inside one park) collapse into one. */
  const lastNightHotel = i > 0 ? hotelLocation(state.days[i - 1].hotel, state.hotels) : '';
  const allStops = [lastNightHotel, ...d.items.map((a) => searchablePlace(a.place)), hotelLocation(d.hotel, state.hotels)]
    .filter(Boolean)
    .filter((s, k, all) => k === 0 || s !== all[k - 1]);
  const routeSrc = googleRouteEmbedSrc(allStops);
  const routeLimit = hasAmap ? AMAP_MAX_STOPS : MAX_ROUTE_STOPS;
  // Used when 高德 isn't configured or fails to load.
  const googleDayRoute = routeSrc && (
    <iframe src={routeSrc} className="w-full border-0 block" style={{ height: '320px' }} loading="lazy"
      referrerPolicy="no-referrer-when-downgrade" title={`${d.title} 路线`} allowFullScreen />
  );
  const tab = routeSrc && (mapTab === 'route' || !embedSrc) ? 'route' : 'map';

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
    <article id={`day-${i + 1}`} data-day-index={i} className={`day-card bg-surface border rounded-lg overflow-hidden mb-3.5 shadow-xs ${isToday ? 'border-jade ring-2 ring-jade/25' : 'border-line'}`}>
      {/* Day header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-surface-3 border-b border-line flex-wrap print-head">
        <span className="bg-jade-dark text-white rounded-[5px] px-2.5 py-1 font-bold text-[11.5px] tracking-[0.06em] shrink-0">
          D{i + 1}
        </span>
        {isToday && <span className="no-print bg-gold text-white rounded-[5px] px-2 py-1 font-bold text-[11.5px] shrink-0">今天</span>}
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
          {d.mapUrl.trim() && !embedSrc && !routeSrc ? (
            <a href={mapOpenUrl} target="_blank" rel="noopener noreferrer"
              className="no-print btn-mini flex items-center gap-1 no-underline hover:no-underline">
              🗺️ {mapKind === 'amap' ? '高德地图' : mapKind === 'google' ? 'Google 地图' : '打开地图'} ↗
            </a>
          ) : (embedSrc || routeSrc) && (
            <button
              className={`no-print btn-mini flex items-center gap-1 ${showMap ? 'bg-jade-dark !text-white border-jade-dark' : ''}`}
              onClick={() => setShowMap((v) => !v)}
            >
              🗺️ {showMap ? '收起地图' : routeSrc ? '路线地图' : '查看地图'}
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
      {showMap && (embedSrc || routeSrc) && (
        <div className="no-print border-b border-line">
          <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-1.5 bg-surface-2 border-b border-dashed border-line">
            {routeSrc && embedSrc ? (
              <span role="tablist" aria-label="地图类型" className="flex gap-1">
                {([['route', '当天路线'], ['map', '地图']] as const).map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={tab === id} onClick={() => setMapTab(id)}
                    className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold border ${tab === id ? 'bg-jade-dark border-jade-dark text-white' : 'bg-surface border-line text-ink-2'}`}>
                    {label}
                  </button>
                ))}
              </span>
            ) : <span className="text-[11.5px] text-muted">{tab === 'route' ? '当天路线' : '地图预览'}</span>}
            <span className="flex gap-3">
              {tab === 'route' ? (
                <a href={googleRouteUrl(allStops)} target="_blank" rel="noopener noreferrer" className="text-jade text-[12px] hover:underline">↗ 在 Google 地图打开</a>
              ) : (
                <a href={mapOpenUrl} target="_blank" rel="noopener noreferrer" className="text-jade text-[12px] hover:underline">
                  ↗ {mapKind === 'other' ? '在新标签页打开' : '在 Google 地图打开'}
                </a>
              )}
              {mapKind === 'place' && tab === 'map' && (
                <a href={amapSearchUrl(d.mapUrl)} target="_blank" rel="noopener noreferrer" className="text-jade text-[12px] hover:underline">↗ 高德</a>
              )}
              {d.mapUrl.trim() && !embedSrc && (
                <a href={mapOpenUrl} target="_blank" rel="noopener noreferrer" className="text-jade text-[12px] hover:underline">
                  ↗ {mapKind === 'amap' ? '高德地图' : '当天地图'}
                </a>
              )}
            </span>
          </div>
          {tab === 'route' ? (
            <>
              <AmapRoute stops={allStops} mode="driving" cityHint={cityHint} height={320} fallback={googleDayRoute} />
              <p className="px-4 py-2 m-0 text-[11.5px] text-muted bg-surface-2 border-t border-dashed border-line">
                {allStops.slice(0, routeLimit).map((s, k) => `${k + 1}. ${s}`).join(' → ')}
                {allStops.length > routeLimit && `（一条路线最多 ${routeLimit} 个地点，后面 ${allStops.length - routeLimit} 个未画出）`}
                <span className="block mt-0.5">
                  {hasAmap ? '高德驾车路线；地铁/公交请点各段交通的「预览路线」。' : '图中为驾车路线：Google 在中国大陆不提供地铁/公交路线，且需漫游或 VPN 才能加载。'}
                </span>
              </p>
            </>
          ) : (
            <iframe src={embedSrc ?? undefined} className="w-full border-0 block" style={{ height: '260px' }} loading="lazy"
              referrerPolicy="no-referrer-when-downgrade" title={`${d.title} 地图`} allowFullScreen />
          )}
        </div>
      )}

      {/* Day body — folded days stay in the DOM (hidden on screen only) so they still print */}
      <div className={`p-4${collapsed ? ' hidden print-show' : ''}`}>
          {(editUnlocked || d.steps) && <div className="flex gap-2 flex-wrap mb-3.5">
            {editUnlocked && (
              <select className="inp editable w-full sm:w-auto" value={d.intensity}
                onChange={(e) => mutate((s) => { s.days[i].intensity = e.target.value as Intensity; })}>
                <option value="light">轻松</option>
                <option value="medium">中等</option>
                <option value="heavy">较累</option>
              </select>
            )}
            {editUnlocked ? (
              <AutoGrowTextarea singleLine={false} className="inp editable flex-1 min-w-[180px]" value={d.steps} placeholder="步行时长/体力提示"
                onChange={(v) => mutate((s) => { s.days[i].steps = v; })} />
            ) : d.steps ? <div className="rich-field flex-1 min-w-[180px]"><span className="rich-label">步行提示</span><MarkdownText text={d.steps} /></div> : null}
            {editUnlocked ? (
              <div className="flex-1 min-w-[180px]">
                <input
                  className="inp editable"
                  value={d.mapUrl}
                  placeholder="当天地图：地址 / 地点名称，或粘贴 Google 地图 / 高德地图链接"
                  onChange={(e) => mutate((s) => { s.days[i].mapUrl = e.target.value; })}
                />
                {d.mapUrl.trim() && (
                  <p className="text-[11.5px] text-muted mt-1 mb-0">
                    {{
                      google: embedSrc ? '✓ Google 地图链接，可在页面内预览' : '✓ Google 地图链接（短链接无法预览，会直接在 Google 地图打开）',
                      amap: '✓ 高德地图链接，会直接在高德打开（高德无法在页面内预览）',
                      place: '✓ 地点名称：页面内用 Google 地图预览，也可跳转高德搜索',
                      other: '无法识别的链接，会在新标签页打开',
                    }[mapKind]}
                  </p>
                )}
              </div>
            ) : null}
          </div>}

          {editUnlocked ? d.items.map((a, j) => (
            <ActivityRow key={j} a={a} di={i} ai={j} total={d.items.length} editUnlocked={editUnlocked} mutate={mutate} />
          )) : d.items.length ? (
            <ol className="itinerary-timeline list-none m-0 p-0">
              {d.items.map((a, j) => (
                <li key={j}>
                  {a.move.trim() || searchablePlace(a.place)
                    ? <TransitConnector text={a.move.trim()} first={j === 0} to={searchablePlace(a.place)}
                        from={j > 0 ? searchablePlace(d.items[j - 1].place) : ''}
                        previewFrom={j > 0 ? searchablePlace(d.items[j - 1].place) : lastNightHotel} cityHint={cityHint} />
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

          {editUnlocked ? (
            <div className="mt-3.5">
              <label className="block text-muted text-[12px] font-semibold mb-1.5" htmlFor={`day-${i}-hotel`}>🏨 今晚住宿</label>
              <input id={`day-${i}-hotel`} className="inp editable" list={`day-${i}-hotel-options`} value={d.hotel}
                placeholder={state.hotels.length ? '从酒店候选中选择，或直接输入；最后一天回家可留空' : '酒店名称；最后一天回家可留空'}
                onChange={(e) => mutate((s) => { s.days[i].hotel = e.target.value; })} />
              <datalist id={`day-${i}-hotel-options`}>
                {state.hotels.filter((h) => h.name.trim()).map((h, k) => <option key={k} value={h.name.trim()} />)}
              </datalist>
            </div>
          ) : d.hotel.trim() ? <DayHotel name={d.hotel} hotels={state.hotels} /> : null}

          {editUnlocked ? (
            <>
            <label className="block text-muted text-[12px] font-semibold mt-3 mb-1.5">Day 备注</label>
            <textarea
              className="inp editable w-full min-h-[60px] resize-y"
              value={d.notes || ''}
              placeholder="当天注意事项、老人休息安排、备选方案等"
              onChange={(e) => mutate((s) => { s.days[i].notes = e.target.value; })}
            />
            </>
          ) : d.notes ? (
            <div className="rich-field mt-2"><span className="rich-label">当天备注</span><MarkdownText text={d.notes} /></div>
          ) : null}

          <CommentThread state={state} editUnlocked={editUnlocked} mutate={mutate} targetType="day" targetIndex={i} authorName={authorName} printVisible={showDiscussionInPrint} />
      </div>
    </article>
  );
}

/** One row of the 行程总览 list: the day at a glance, with its stops as a numbered list. Click to jump to the day. */
function DayOverviewRow({ d, i, date, isToday, dayWeather, onOpen }: {
  d: Day; i: number; date: string | null; isToday: boolean;
  dayWeather?: { tMax: number; tMin: number; code: number };
  onOpen: () => void;
}) {
  return (
    <button onClick={onOpen}
      className={`w-full text-left bg-surface border rounded p-3.5 mb-2.5 shadow-xs transition-all duration-150 hover:border-jade hover:shadow-sm ${isToday ? 'border-jade' : 'border-line'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="bg-jade-dark text-white rounded-[5px] px-2 py-0.5 font-bold text-[11.5px] tracking-[0.06em] shrink-0">D{i + 1}</span>
        {isToday && <span className="bg-gold text-white rounded-[5px] px-2 py-0.5 font-bold text-[11.5px] shrink-0">今天</span>}
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
      {d.hotel.trim() && <div className="text-[12.5px] text-jade-dark font-semibold mt-1.5 truncate">🏨 {d.hotel.trim()}</div>}
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
  state, editUnlocked, mutate, mutateNoSave, startDate, weather, authorName, showDiscussionInPrint = true, todayIndex = null, destination = '',
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate; mutateNoSave: Mutate;
  startDate: string | null; weather: WeatherResult | 'loading' | null; authorName: string;
  showDiscussionInPrint?: boolean;
  /** Index of today's day while the trip is under way; null otherwise. */
  todayIndex?: number | null;
  /** The trip's destination, e.g. "广州・珠海・佛山顺德・深圳"; its first city seeds 高德's place lookups. */
  destination?: string;
}) {
  const cityHint = destination.split(/[・·/,，、\s]/)[0]?.trim() || '';
  const weatherByDate = weather && weather !== 'loading' && weather.status === 'ok'
    ? new Map(weather.days.map((w) => [w.date, w]))
    : null;
  /** Day whose card sits under the pill bar; null while the overview (above Day 1) is in view. */
  const [active, setActive] = useState<number | null>(null);
  // Mid-trip the overview list is just in the way of today's day, so it starts folded.
  const [overviewOpen, setOverviewOpen] = useState(todayIndex === null);
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
    const bar = tabsRef.current;
    const barTop = bar ? parseFloat(getComputedStyle(bar).top) || 0 : 0;
    const barHeight = bar?.getBoundingClientRect().height ?? 0;
    const top = target.getBoundingClientRect().top + window.scrollY - (i === null ? barTop : barTop + barHeight + 4);
    setActive(i);
    spyLockUntil.current = Date.now() + 900;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  useEffect(() => {
    if (todayIndex === null) return;
    if (state.collapsed[todayIndex]) mutateNoSave((s) => { s.collapsed[todayIndex] = false; });
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => jumpTo(todayIndex)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAllCollapsed = (value: boolean) =>
    mutateNoSave((s) => { s.days.forEach((_, i) => { s.collapsed[i] = value; }); });
  const allCollapsed = dayCount > 0 && state.days.every((_, i) => state.collapsed[i]);

  const tabClass = (on: boolean) =>
    `shrink-0 flex flex-col items-center justify-center min-w-[64px] px-3.5 py-1.5 rounded-full border-[1.5px] text-[13px] font-semibold leading-tight transition-colors ${
      on ? 'bg-jade-dark border-jade-dark text-white' : 'bg-surface border-line text-ink-2 hover:border-jade hover:text-jade'
    }`;

  return (
    <section className="py-5 sm:py-7 border-b border-line">
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
          className="day-tabs no-print sticky top-[68px] sm:top-[115px] z-30 -mx-1 px-1 py-2 mb-3 flex gap-2 overflow-x-auto bg-bg/95 backdrop-blur-md">
          <button role="tab" aria-selected={active === null} className={tabClass(active === null)} onClick={() => jumpTo(null)}>
            ☰ 总览
          </button>
          {state.days.map((_, i) => {
            const date = dayDate(startDate, i);
            return (
              <button key={i} role="tab" aria-selected={active === i} className={tabClass(active === i)} onClick={() => jumpTo(i)}>
                <span>Day {i + 1}</span>
                {i === todayIndex
                  ? <span className={`text-[10.5px] font-bold ${active === i ? 'text-white' : 'text-gold'}`}>今天</span>
                  : date && <span className={`text-[10.5px] font-medium ${active === i ? 'text-white/80' : 'text-muted'}`}>{formatDateWithWeekday(date)}</span>}
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
            return <DayOverviewRow key={i} d={d} i={i} date={date} isToday={i === todayIndex} dayWeather={date ? weatherByDate?.get(date) : undefined} onOpen={() => jumpTo(i)} />;
          })}
        </div>
      )}

      {state.days.map((d, i) => {
        const date = dayDate(startDate, i);
        return (
          <DayCard
            key={i} d={d} i={i} total={dayCount}
            collapsed={Boolean(state.collapsed[i])} isToday={i === todayIndex}
            editUnlocked={editUnlocked} mutate={mutate} mutateNoSave={mutateNoSave}
            date={date} dayWeather={date ? weatherByDate?.get(date) : undefined}
            state={state} authorName={authorName} showDiscussionInPrint={showDiscussionInPrint} cityHint={cityHint}
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
