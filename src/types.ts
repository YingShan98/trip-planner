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
}

export interface TransportItem {
  type: string;
  description: string;
  price: string;
  amount: number | string;
  currency: CurrencyKey;
}

export interface BudgetItem {
  category: string;
  unit: string;
  quantity: number | string;
  unitPrice: number | string;
  currency: CurrencyKey;
  note: string;
}

export interface NoteItem {
  author: string;
  text: string;
  ts: string;
}

export interface TripState {
  days: Day[];
  checklist: ChecklistItem[];
  packing: PackingItem[];
  hotels: Hotel[];
  transport: TransportItem[];
  budget: BudgetItem[];
  notes: NoteItem[];
  collapsed: Record<number, boolean>;
  /** destination/foreign currency code, e.g. 'CNY'. Home currency lives on the trip row. */
  foreignCurrency: string;
  /** 1 unit of foreignCurrency = exchangeRate units of home currency, e.g. 1 CNY = 0.62 MYR */
  exchangeRate: number | string;
}

export type Mutate = (fn: (draft: TripState) => void) => void;

export interface ImportedTripMeta {
  title?: string;
  destination?: string;
  currency?: string;
  start_date?: string | null;
  end_date?: string | null;
  description?: string;
}

export interface TripListRow {
  id: string;
  slug: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  description: string;
  updated_at: string;
}
