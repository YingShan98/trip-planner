export interface LinkItem {
  label: string;
  url: string;
}

export type Intensity = 'light' | 'medium' | 'heavy';

/** 'home' = trip's home currency; 'foreign' = TripState.foreignCurrency */
export type CurrencyKey = 'home' | 'foreign';

export interface Activity {
  t: string;
  x: string;
  move: string;
  fee: string;
  link: LinkItem[];
  /** Opening hours, e.g. "09:00–17:30". */
  visitHours: string;
  /** Closed days, e.g. "每周二". */
  closedDays: string;
  /** Best weekdays to go, e.g. "周一至周四优先". */
  recommendedWeekdays: string;
}

export interface Day {
  n: number;
  title: string;
  intensity: Intensity;
  steps: string;
  mapUrl: string;
  items: Activity[];
  notes: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  category: string;
}

export interface PackingItem {
  id: string;
  text: string;
  done: boolean;
  category: string;
}

export interface Hotel {
  rank: string;
  name: string;
  addr: string;
  warn: string;
  pointsText: string;
  link: LinkItem[];
  notes: string;
  /** Marks this as the final booked choice among the candidates. At most one hotel should have this set. */
  chosen: boolean;
}

export interface TransportItem {
  type: string;
  description: string;
  price: string;
  amount: number | string;
  currency: CurrencyKey;
  /** Marks this as the final decided option among the candidates. At most one transport item should have this set. */
  chosen: boolean;
}

export interface BudgetItem {
  category: string;
  unit: string;
  quantity: number | string;
  unitPrice: number | string;
  currency: CurrencyKey;
  note: string;
}

/** Ties a note to a specific hotel/day card instead of the general notes wall. Indexes into TripState.hotels/days. */
export interface NoteTarget {
  type: 'hotel' | 'day';
  index: number;
}

export interface NoteItem {
  author: string;
  text: string;
  ts: string;
  target?: NoteTarget;
}

export interface TripState {
  days: Day[];
  checklist: ChecklistItem[];
  packing: PackingItem[];
  hotels: Hotel[];
  transport: TransportItem[];
  budget: BudgetItem[];
  notes: NoteItem[];
  attachments: LinkItem[];
  collapsed: Record<number, boolean>;
  /** destination/foreign currency code, e.g. 'CNY'. Home currency lives on the trip row. */
  foreignCurrency: string;
  /** 1 unit of foreignCurrency = exchangeRate units of home currency, e.g. 1 CNY = 0.62 MYR */
  exchangeRate: number | string;
  /** Custom categories the user has typed for checklist/packing items, remembered even once unused. */
  checklistCategories: string[];
  packingCategories: string[];
}

export type Mutate = (fn: (draft: TripState) => void) => void;

export interface ImportedTripMeta {
  title?: string;
  destination?: string;
  currency?: string;
  start_date?: string | null;
  end_date?: string | null;
  description?: string;
  cover_image_url?: string | null;
}

export interface TripListRow {
  id: string;
  slug: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  home_currency: string;
  description: string;
  updated_at: string;
  cover_image_url: string | null;
}
