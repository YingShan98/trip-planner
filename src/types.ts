export interface LinkItem {
  label: string;
  url: string;
}

export type Intensity = 'light' | 'medium' | 'heavy';

/** 'home' = trip's home currency (TripRow.currency); 'foreign' = TripState.foreignCurrency */
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
  hotels: Hotel[];
  transport: TransportItem[];
  budget: BudgetItem[];
  notes: NoteItem[];
  collapsed: Record<number, boolean>;
  /** destination/foreign currency code, e.g. 'CNY'. Home currency lives on TripRow.currency */
  foreignCurrency: string;
  /** 1 unit of foreignCurrency = exchangeRate units of home currency, e.g. 1 CNY = 0.62 MYR */
  exchangeRate: number | string;
}

export interface TripRow {
  id: string;
  slug: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  description: string;
  data: unknown;
  updated_at: string;
  created_at: string;
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

export type TripListRow = Pick<
  TripRow,
  'id' | 'slug' | 'title' | 'destination' | 'start_date' | 'end_date' | 'currency' | 'description' | 'updated_at'
>;
