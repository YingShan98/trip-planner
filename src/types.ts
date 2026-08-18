export interface LinkItem {
  label: string;
  url: string;
}

export type Intensity = 'light' | 'medium' | 'heavy';

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
}

export interface BudgetItem {
  category: string;
  unit: string;
  quantity: number | string;
  unitPrice: number | string;
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

export type TripListRow = Pick<
  TripRow,
  'id' | 'slug' | 'title' | 'destination' | 'start_date' | 'end_date' | 'currency' | 'description' | 'updated_at'
>;
