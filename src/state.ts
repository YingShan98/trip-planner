import type { Activity, BudgetItem, Day, Hotel, PackingItem, TransportItem, TripState } from './types';

export const uid = (p: string) => p + '_' + Math.random().toString(36).slice(2, 8);

export function blankState(): TripState {
  return {
    days: [{ n: 1, title: 'Day 1', intensity: 'light', steps: '', mapUrl: '', hotel: '', items: [], notes: '' }],
    checklist: [],
    packing: [],
    hotels: [],
    transport: [],
    budget: [],
    notes: [],
    attachments: [],
    collapsed: {},
    isLocal: false,
    foreignCurrency: '',
    exchangeRate: '',
    travelers: '',
    checklistCategories: [],
    packingCategories: [],
  };
}

/** A usable traveler count (a whole number ≥ 1), or null if unset/invalid. */
export function parseTravelerCount(v: number | string | null | undefined): number | null {
  const n = Number(v);
  return v !== '' && v !== null && v !== undefined && Number.isInteger(n) && n >= 1 ? n : null;
}

export function defaultDay(n: number): Day {
  return { n, title: `Day ${n}`, intensity: 'light', steps: '', mapUrl: '', hotel: '', items: [], notes: '' };
}

export function defaultActivity(): Activity {
  return { t: '', x: '', place: '', move: '', fee: '', link: [], visitHours: '', closedDays: '', recommendedWeekdays: '', imageUrl: '', duration: '', accessibility: '', alternative: '', earlyExit: '' };
}

export function defaultHotel(): Hotel {
  return { rank: '候选', name: '', addr: '', warn: '', pointsText: '', link: [], notes: '', chosen: false };
}

export function defaultTransport(): TransportItem {
  return { type: '', description: '', price: '', amount: '', currency: 'home', chosen: false };
}

export function defaultBudget(): BudgetItem {
  return { category: '', unit: '', quantity: 1, unitPrice: '', currency: 'home', note: '' };
}

export function templateState(): TripState {
  return {
    days: [
      {
        n: 1,
        title: 'Day 1',
        intensity: 'light',
        steps: '示例：步行约 2 小时，适合大部分体力',
        // A place name / address, or a pasted Google 地图 or 高德地图 link.
        mapUrl: '花城广场',
        /* Where everyone sleeps tonight. Use a hotel's exact `name` from `hotels` below, so the
           end-of-day card can show its address and the day's route can end there. */
        hotel: '广州花园酒店',
        /* Each stop's `move` describes how to get TO it (the first stop's is the departure leg).
           Several ways there? One per line, "emoji 方式：A > B > C ⏱️ 约N分钟" — they become
           switchable tabs, and "A > B > C" shows as a list of stations.
           `place` must be a real searchable name (or a pasted map link) — it drives the maps and routes. */
        items: [
          {
            t: '09:00–11:00',
            x: '示例：广东省博物馆（免费，须提前预约）',
            place: '广东省博物馆',
            move: '🚐 打车：酒店 > 🚕 > 广东省博物馆 ⏱️ 约20分钟\n🚇 地铁：淘金站 > 🚇5号线（往文冲方向）- 4站 > 🚇珠江新城站换乘APM线 - 2站 > 🚇大剧院站 > 🚶广东省博物馆 ⏱️ 约35分钟',
            fee: '示例：免费',
            link: [{ label: '官网', url: 'https://example.com' }],
            visitHours: '示例：09:00–17:00（16:00 停止入场）',
            closedDays: '示例：每周一',
            recommendedWeekdays: '示例：周二至周四优先',
            imageUrl: '',
            duration: '示例：约2小时',
            accessibility: '示例：馆内有电梯和轮椅借用',
            alternative: '示例：广州图书馆（同区，室内可坐）',
            earlyExit: '示例：累了可直接步行去花城广场休息',
          },
          {
            t: '14:00–15:00',
            x: '示例：花城广场散步',
            place: '花城广场',
            move: '🚶 广东省博物馆 > 海心沙 > 花城广场 ⏱️ 约15分钟',
            fee: '示例：免费',
            link: [],
            visitHours: '示例：全天开放',
            closedDays: '',
            recommendedWeekdays: '',
            imageUrl: '',
            duration: '示例：约1小时',
            accessibility: '示例：全程平地，随处可坐',
            alternative: '',
            earlyExit: '',
          },
          {
            t: '18:00–19:30',
            x: '示例：广州塔观景台看夜景',
            place: '广州塔',
            move: '🚇 地铁：花城大道站 > 🚇APM线 - 2站 > 🚇广州塔站 ⏱️ 约10分钟\n🚶 步行：沿中轴线过海心桥 ⏱️ 约20分钟',
            fee: '示例：RM 50/人',
            link: [],
            visitHours: '示例：09:30–22:30',
            closedDays: '示例：全年开放',
            recommendedWeekdays: '示例：周一至周四优先，避开周末',
            imageUrl: '',
            duration: '示例：约1.5小时',
            accessibility: '示例：有电梯直达，轮椅可通行',
            alternative: '示例：附近咖啡厅休息',
            earlyExit: '示例：可提前离开直接前往晚餐地点',
          },
        ],
        notes: '示例：老人可在附近咖啡厅休息',
      },
      {
        n: 2,
        title: '示例：返程',
        intensity: 'light',
        steps: '',
        mapUrl: '',
        // Last day, flying home: no hotel tonight, so leave it empty.
        hotel: '',
        items: [
          {
            t: '12:00–13:00',
            x: '示例：最后午餐',
            place: '北京路步行街',
            move: '🚶 酒店 > 北京路 ⏱️ 约15分钟',
            fee: '',
            link: [],
            visitHours: '',
            closedDays: '',
            recommendedWeekdays: '',
            imageUrl: '',
            duration: '约1小时',
            accessibility: '',
            alternative: '',
            earlyExit: '',
          },
          {
            t: '15:30',
            x: '示例：抵达白云机场 T3，办理登机',
            place: '广州白云国际机场T3航站楼',
            move: '🚐 包车：酒店 > 🚕 > 白云机场T3（2台车） ⏱️ 约40–60分钟\n🚇 地铁：北京路站 > 🚇6号线 > 🚇海珠广场站换乘2号线 > 🚇嘉禾望岗站换乘3号线 > 🚇高增站换乘空港2线支线 > ✈️ T3 ⏱️ 约80分钟\n⚠️ 务必确认航站楼',
            fee: '',
            link: [],
            visitHours: '',
            closedDays: '',
            recommendedWeekdays: '',
            imageUrl: '',
            duration: '',
            accessibility: '',
            alternative: '',
            earlyExit: '',
          },
        ],
        notes: '',
      },
    ],
    checklist: [{ id: uid('c'), text: '示例：确认护照有效期', done: false, category: '证件与签证' }],
    packing: [],
    hotels: [
      {
        rank: '首选',
        // `name` is what each day's `hotel` refers to; a full Chinese address keeps maps on the right building.
        name: '广州花园酒店',
        addr: '广州市越秀区环市东路368号',
        warn: '示例：入住需信用卡预授权',
        pointsText: '优点：地理位置好\n缺点：价格较高',
        link: [{ label: '预订链接', url: 'https://example.com' }],
        notes: '示例讨论备注',
        chosen: true,
      },
    ],
    transport: [
      {
        type: '示例：7 座商务车',
        description: '示例：机场接送 + 市内包车，每天',
        price: '示例：每天',
        amount: 600,
        currency: 'foreign',
        chosen: true,
      },
    ],
    budget: [{ category: '示例：住宿', unit: '晚', quantity: 3, unitPrice: 300, currency: 'home', note: '示例备注' }],
    notes: [{ author: '示例：小明', text: '示例留言内容', ts: '2027-01-01 12:00:00' }],
    attachments: [{ label: '示例：详细行程文档', url: 'https://example.com' }],
    collapsed: {},
    isLocal: false,
    foreignCurrency: 'CNY',
    exchangeRate: 0.62,
    travelers: 2,
    checklistCategories: [],
    packingCategories: [],
  };
}

export function normalize(s: unknown): TripState {
  const src = (s && typeof s === 'object' ? (s as Partial<TripState>) : {}) as Partial<TripState>;
  const x = blankState();
  x.days =
    Array.isArray(src.days) && src.days.length
      ? src.days.map((d, i) => ({
          ...defaultDay(i + 1),
          ...d,
          n: i + 1,
          items: Array.isArray(d.items)
            ? d.items.map((a) => ({
                ...defaultActivity(),
                ...a,
                t: typeof a.t === 'string' ? a.t : '',
                link: Array.isArray(a.link) ? a.link : [],
              }))
            : [],
        }))
      : x.days;
  x.checklist = Array.isArray(src.checklist)
    ? src.checklist.map((c) => ({ id: c.id || uid('c'), text: c.text || '', done: c.done === true, category: c.category || '其他' }))
    : [];
  x.packing = Array.isArray(src.packing)
    ? src.packing.map((p: PackingItem) => ({ id: p.id || uid('p'), text: p.text || '', done: p.done === true, category: p.category || '其他' }))
    : [];
  x.hotels = Array.isArray(src.hotels)
    ? src.hotels.map((h) => ({ ...defaultHotel(), ...h, link: Array.isArray(h.link) ? h.link : [] }))
    : [];
  x.transport = Array.isArray(src.transport) ? src.transport.map((t) => ({ ...defaultTransport(), ...t })) : [];
  x.budget = Array.isArray(src.budget) ? src.budget.map((b) => ({ ...defaultBudget(), ...b })) : [];
  x.notes = Array.isArray(src.notes) ? src.notes : [];
  x.attachments = Array.isArray(src.attachments)
    ? src.attachments.filter((a) => a && typeof a.url === 'string' && a.url.trim()).map((a) => ({ label: a.label || '', url: a.url }))
    : [];
  x.checklistCategories = Array.isArray(src.checklistCategories) ? src.checklistCategories.filter((c) => typeof c === 'string' && c.trim()) : [];
  x.packingCategories = Array.isArray(src.packingCategories) ? src.packingCategories.filter((c) => typeof c === 'string' && c.trim()) : [];
  x.collapsed = src.collapsed || {};
  x.isLocal = src.isLocal === true;
  x.foreignCurrency = typeof src.foreignCurrency === 'string' ? src.foreignCurrency : '';
  x.exchangeRate =
    typeof src.exchangeRate === 'number' || typeof src.exchangeRate === 'string' ? src.exchangeRate : '';
  x.travelers =
    typeof src.travelers === 'number' || typeof src.travelers === 'string' ? src.travelers : '';
  return x;
}
