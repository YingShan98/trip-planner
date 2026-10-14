import type { TravelMode } from './mapEmbed';

/* `move` is free text that often mentions several modes ("地铁…或打车…"), so the mode follows
   whichever keyword appears first rather than a fixed priority. */
const TRANSIT_MODES: [RegExp, string, string, TravelMode?][] = [
  [/步行|走路|walk/i, '🚶', '步行', 'walking'],
  [/地铁|号线|公共交通|APM|城际|metro|subway|MRT/i, '🚇', '地铁', 'transit'],
  [/公交|巴士|快巴|bus/i, '🚌', '公交', 'transit'],
  [/打车|包车|自驾|的士|出租|网约车|专车|接机|送机|taxi|grab|car/i, '🚗', '驾车', 'driving'],
  [/船|渡轮|夜游|ferry|cruise|boat/i, '⛴️', '乘船', 'transit'],
  [/航班|飞机|flight/i, '✈️', '航班'],
  [/高铁|动车|(?:^|[^小])火车|train/i, '🚄', '火车', 'transit'],
];

export interface TransitMode { icon: string; label: string; travelMode?: TravelMode }

export function transitMode(text: string): TransitMode {
  let best: (TransitMode & { at: number }) | null = null;
  for (const [re, icon, label, travelMode] of TRANSIT_MODES) {
    const at = text.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { icon, label, travelMode, at };
  }
  return best ?? { icon: '➜', label: '前往' };
}

/** One way of getting to a stop, split out of an activity's `move` text. */
export interface RouteOption {
  /** The emoji the line started with, e.g. "🚐"; null if it had none. */
  icon: string | null;
  /** Text before the "：", e.g. "包车" or "公共交通（少换一次）"; '' if the line had no label. */
  label: string;
  /** What the route's tab says: the label (or the mode's name), plus e.g. "· 经黄沙站" when two routes would read the same. */
  tabLabel: string;
  /** Everything after the label, including any continuation lines. */
  body: string;
  /** e.g. "约30–45分钟"; '' if none was found. */
  duration: string;
  /** The route split on " > " (any number of parts). */
  path: string[];
  /** `path` when it has at least three parts, to show as a list of stops; otherwise empty. */
  steps: string[];
  /** The rest of the body once `steps` are taken out (⏱️ timing, extra lines). */
  detail: string;
  mode: TransitMode;
}

const PICTO = '\\p{Extended_Pictographic}\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*';
/** Leading emoji, including "🚕/🚶"-style pairs. */
const LEADING_EMOJI = new RegExp(`^(${PICTO}(?:\\s*\\/\\s*${PICTO})*)\\s*`, 'u');
/** "包车：" — a short label ending in a colon. An ASCII colon inside a time ("需08:15出发") stays part of the label. */
const LABEL = /^((?:[^：:\n>]|(?<=\d):(?=\d)){1,20}?)\s*(?:：|:(?!\d))\s*/;
const EMOJI_ONLY = new RegExp(`^(?:${PICTO})+$`, 'u');
/** Lines starting with these are remarks or timing, not routes; they stay with the route above them. */
const NOTE_ICONS = /^(?:⚠|❗|‼|💡|ℹ|📌|⭐|✅|❌|⏱|⏰|🎫|💰)/u;
/** "约40分钟" — but not a lead time like "起飞前3小时抵达" / "提前30分钟出发", nor the tail of one ("0分钟"). */
const DURATION = /(?<!前\s*|[\d.])约?\s*\d+(?:\.\d+)?(?:\s*[–\-~～]\s*\d+(?:\.\d+)?)?\s*(?:分钟|小时|min)/;

function isOptionStart(line: string, requireLabel: boolean): boolean {
  if (NOTE_ICONS.test(line)) return false;
  const emoji = LEADING_EMOJI.exec(line);
  const rest = emoji ? line.slice(emoji[0].length) : line;
  const label = LABEL.exec(rest);
  const hasMode = transitMode(line).label !== '前往';
  if (requireLabel) return Boolean(label) && hasMode;
  // An emoji alone isn't enough ("🍽️ 午餐后…"): it also needs a label or a recognisable way of travelling.
  return emoji ? Boolean(label) || hasMode : Boolean(label) && hasMode;
}

function splitLine(line: string): { icon: string | null; label: string; body: string } {
  const emoji = LEADING_EMOJI.exec(line);
  const icon = emoji ? emoji[1].split('/')[0].trim() : null;
  let rest = emoji ? line.slice(emoji[0].length) : line;
  const label = LABEL.exec(rest);
  if (label) rest = rest.slice(label[0].length);
  return { icon, label: label ? label[1].trim() : '', body: rest };
}

function finish(o: { icon: string | null; label: string; body: string }): Omit<RouteOption, 'tabLabel'> {
  const body = o.body.trim();
  const timer = body.indexOf('⏱');
  const durationMatch = DURATION.exec(timer >= 0 ? body.slice(timer) : body);
  const [firstLine, ...moreLines] = body.split('\n');
  const cut = firstLine.indexOf('⏱');
  const route = (cut >= 0 ? firstLine.slice(0, cut) : firstLine).trim();
  // A bare "🚕" between arrows is how you get to the next stop, not a stop of its own.
  const parts = route.split(/\s*>\s*/).map((s) => s.trim()).filter(Boolean)
    .reduce<string[]>((acc, part, i, all) => {
      const prev = all[i - 1];
      if (prev && EMOJI_ONLY.test(prev)) acc[acc.length - 1] = `${prev} ${part}`;
      else acc.push(part);
      return acc;
    }, []);
  const steps = parts.length >= 3 ? parts : [];
  const detail = steps.length
    ? [cut >= 0 ? firstLine.slice(cut).trim() : '', ...moreLines].filter((s) => s.trim()).join('\n')
    : body;
  return {
    ...o, body, path: parts, steps, detail,
    duration: durationMatch ? durationMatch[0].replace(/\s+/g, '') : '',
    mode: transitMode(`${o.label} ${body}`),
  };
}

/**
 * Splits a `move` text into alternative routes: one per line that starts with an emoji or a
 * "方式：" label ("🚐 包车：…", "🚇 公共交通：…"), or — on a single line — per " · " segment
 * that carries a label ("推荐：… · 包车对比：…"). Lines before the first route come back as
 * `notes`; lines after a route are kept with it. Fewer than two routes means "show as-is".
 */
export function parseRouteOptions(text: string): { notes: string; options: RouteOption[] } {
  let lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1) {
    const segments = lines[0].split(/\s+·\s+/);
    if (segments.filter((s) => isOptionStart(s, true)).length >= 2) lines = segments;
  }
  const notes: string[] = [];
  const raw: { icon: string | null; label: string; body: string }[] = [];
  for (const line of lines) {
    if (isOptionStart(line, false)) raw.push(splitLine(line));
    else if (raw.length) raw[raw.length - 1].body += '\n' + line;
    else notes.push(line);
  }
  return { notes: notes.join('\n'), options: withTabLabels(raw.map(finish)) };
}

/** At-a-glance summary of a leg for its one-line chip: how you travel and how long it takes. null when the
 *  text is only remarks ("⚠️ 务必确认航站楼…" mentions 地铁 but isn't a route) or names neither a mode nor a
 *  duration ("免费"). Multi-route legs summarise their first route; the leg's chosen tab overrides that. */
export function legSummary(text: string): { icon: string; label: string; duration: string } | null {
  const { options } = parseRouteOptions(text);
  if (options.length) {
    const o = options[0];
    return { icon: o.icon ?? o.mode.icon, label: o.mode.label, duration: o.duration };
  }
  const routeText = text.split('\n').map((l) => l.trim()).filter((l) => l && !NOTE_ICONS.test(l)).join('\n');
  if (!routeText) return null;
  const mode = transitMode(routeText);
  const duration = DURATION.exec(routeText)?.[0].replace(/\s+/g, '') ?? '';
  if (mode.label === '前往' && !duration) return null;
  return { icon: mode.icon, label: mode.label, duration };
}

/** True when every line of a leg's text is a remark (⚠️/💡/…), so it reads as a callout rather than a route. */
export function isNoteOnly(text: string): boolean {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((l) => NOTE_ICONS.test(l));
}

/** A route stop trimmed to a place name for a tab: no emoji, no leading "乘", nothing from "换乘" / "（" / " - " on. */
function placeName(part: string): string {
  return part.replace(new RegExp(PICTO, 'gu'), '').trim().replace(/^乘/, '').split(/换乘|[（(]|\s-|-\s*\d/)[0].trim().slice(0, 10);
}

/** Routes whose tabs would read the same ("🚇 公共交通" twice) are told apart by where their paths first differ. */
function withTabLabels(options: Omit<RouteOption, 'tabLabel'>[]): RouteOption[] {
  const base = options.map((o) => o.label || o.mode.label);
  return options.map((o, i) => {
    const twins = options.filter((_, j) => j !== i && base[j] === base[i]);
    if (!twins.length) return { ...o, tabLabel: base[i] };
    let k = 0;
    while (k < o.path.length && twins.some((t) => t.path[k] !== undefined && placeName(t.path[k]) === placeName(o.path[k]))) k++;
    const place = k < o.path.length ? placeName(o.path[k]) : '';
    const nth = options.filter((_, j) => base[j] === base[i]).indexOf(o) + 1;
    return { ...o, tabLabel: `${base[i]} · ${place ? `${k === 0 ? '从' : '经'}${place}` : `方案${nth}`}` };
  });
}

/* ── Preferred kind of route (e.g. 驾车 for the group riding with the elders, 地铁 for the others).
   Per viewer, so it lives in localStorage; picking a route on one stop switches every stop that
   has a route of the same kind. ── */
const PREF_KEY = 'trip-route-pref';
let pref: string | null = (() => { try { return localStorage.getItem(PREF_KEY); } catch { return null; } })();
const listeners = new Set<() => void>();

export function getRoutePref(): string | null { return pref; }

export function setRoutePref(modeLabel: string) {
  pref = modeLabel;
  try { localStorage.setItem(PREF_KEY, modeLabel); } catch { /* private mode: keep it for this visit only */ }
  listeners.forEach((l) => l());
}

export function subscribeRoutePref(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
