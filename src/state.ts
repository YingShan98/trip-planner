import type { Activity, BudgetItem, Day, Hotel, TransportItem, TripState } from './types';

export const uid = (p: string) => p + '_' + Math.random().toString(36).slice(2, 8);

export function blankState(): TripState {
  return {
    days: [{ n: 1, title: 'Day 1', intensity: 'light', steps: '', mapUrl: '', items: [], notes: '' }],
    checklist: [],
    hotels: [],
    transport: [],
    budget: [],
    notes: [],
    collapsed: {},
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
  return { type: '', description: '', price: '' };
}

export function defaultBudget(): BudgetItem {
  return { category: '', unit: '', quantity: 1, unitPrice: '', note: '' };
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
  x.hotels = Array.isArray(src.hotels)
    ? src.hotels.map((h) => ({ ...defaultHotel(), ...h, link: Array.isArray(h.link) ? h.link : [] }))
    : [];
  x.transport = Array.isArray(src.transport) ? src.transport : [];
  x.budget = Array.isArray(src.budget) ? src.budget : [];
  x.notes = Array.isArray(src.notes) ? src.notes : [];
  x.collapsed = src.collapsed || {};
  return x;
}
