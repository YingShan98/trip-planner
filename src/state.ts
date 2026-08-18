import type { Activity, BudgetItem, Day, Hotel, PackingItem, TransportItem, TripState } from './types';

export const uid = (p: string) => p + '_' + Math.random().toString(36).slice(2, 8);

export function blankState(): TripState {
  return {
    days: [{ n: 1, title: 'Day 1', intensity: 'light', steps: '', mapUrl: '', items: [], notes: '' }],
    checklist: [],
    packing: [],
    hotels: [],
    transport: [],
    budget: [],
    notes: [],
    collapsed: {},
    foreignCurrency: '',
    exchangeRate: '',
    freeEdit: false,
  };
}

export function defaultDay(n: number): Day {
  return { n, title: `Day ${n}`, intensity: 'light', steps: '', mapUrl: '', items: [], notes: '' };
}

export function defaultActivity(): Activity {
  return { t: '上午', x: '', move: '', fee: '', link: [] };
}

export function defaultHotel(): Hotel {
  return { rank: '候选', name: '', addr: '', warn: '', pointsText: '', link: [], notes: '' };
}

export function defaultTransport(): TransportItem {
  return { type: '', description: '', price: '', amount: '', currency: 'home' };
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
        mapUrl: 'https://maps.google.com/',
        items: [
          {
            t: '上午',
            x: '示例：广州塔观景台',
            move: '示例：地铁 3 号线',
            fee: '示例：RM 50/人',
            link: [{ label: '官网', url: 'https://example.com' }],
          },
        ],
        notes: '示例：老人可在附近咖啡厅休息',
      },
    ],
    checklist: [{ id: uid('c'), text: '示例：确认护照有效期', done: false }],
    packing: [],
    hotels: [
      {
        rank: '首选',
        name: '示例酒店名称',
        addr: '示例地址 / 地铁站',
        warn: '示例：入住需信用卡预授权',
        pointsText: '优点：地理位置好\n缺点：价格较高',
        link: [{ label: '预订链接', url: 'https://example.com' }],
        notes: '示例讨论备注',
      },
    ],
    transport: [
      {
        type: '示例：7 座商务车',
        description: '示例：机场接送 + 市内包车，每天',
        price: '示例：每天',
        amount: 600,
        currency: 'foreign',
      },
    ],
    budget: [{ category: '示例：住宿', unit: '晚', quantity: 3, unitPrice: 300, currency: 'home', note: '示例备注' }],
    notes: [{ author: '示例：小明', text: '示例留言内容', ts: '2027-01-01 12:00:00' }],
    collapsed: {},
    foreignCurrency: 'CNY',
    exchangeRate: 0.62,
    freeEdit: false,
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
            ? d.items.map((a) => ({ ...defaultActivity(), ...a, link: Array.isArray(a.link) ? a.link : [] }))
            : [],
        }))
      : x.days;
  x.checklist = Array.isArray(src.checklist) ? src.checklist : [];
  x.packing = Array.isArray(src.packing)
    ? src.packing.map((p: PackingItem) => ({ id: p.id || uid('p'), text: p.text || '', done: p.done === true, category: p.category || '其他' }))
    : [];
  x.hotels = Array.isArray(src.hotels)
    ? src.hotels.map((h) => ({ ...defaultHotel(), ...h, link: Array.isArray(h.link) ? h.link : [] }))
    : [];
  x.transport = Array.isArray(src.transport) ? src.transport.map((t) => ({ ...defaultTransport(), ...t })) : [];
  x.budget = Array.isArray(src.budget) ? src.budget.map((b) => ({ ...defaultBudget(), ...b })) : [];
  x.notes = Array.isArray(src.notes) ? src.notes : [];
  x.collapsed = src.collapsed || {};
  x.foreignCurrency = typeof src.foreignCurrency === 'string' ? src.foreignCurrency : '';
  x.exchangeRate =
    typeof src.exchangeRate === 'number' || typeof src.exchangeRate === 'string' ? src.exchangeRate : '';
  x.freeEdit = src.freeEdit === true;
  return x;
}
