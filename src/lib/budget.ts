import { convertAmount, parseRate } from './currency';
import type { BudgetItem, CurrencyKey, TripState } from '../types';

/** A budget line shared by only some of the travelers, as shown in the per-person breakdown. */
export interface PartialShare {
  index: number;
  label: string;
  people: number;
  perPerson: number;
}

export interface BudgetBreakdown {
  /** Total in home currency, over every line that could be converted. */
  totalHome: number;
  /** Lines left out of the total because they're in the foreign currency and no rate is set. */
  unconverted: number;
  travelers: number;
  /** Each line's home-currency amount, or null when it couldn't be converted. */
  itemHome: (number | null)[];
  /** Per person for the lines everyone shares; null when the traveler count isn't set. */
  everyone: number | null;
  /** Lines shared by fewer than all travelers, each split among its own people. */
  partial: PartialShare[];
  /** What someone taking part in every line pays: `everyone` plus every partial share. */
  fullParticipant: number | null;
}

/** How many travelers share a line: its `splitAmong` when that's a whole number below the traveler count, else null (= everyone). */
export function splitCount(item: BudgetItem, travelers: number): number | null {
  const n = Number(item.splitAmong);
  return item.splitAmong !== '' && Number.isInteger(n) && n > 0 && (travelers <= 0 || n < travelers) ? n : null;
}

/** Totals and per-person figures for the budget, splitting each line among the people it is for. */
export function budgetBreakdown(state: TripState): BudgetBreakdown {
  const local = state.isLocal;
  const rate = local ? null : parseRate(state.exchangeRate);
  // On a local trip every amount is home currency, whatever an item's stored currency key says.
  const currencyOf = (c: CurrencyKey): CurrencyKey => (local ? 'home' : c);
  const travelers = Number(state.travelers) || 0;

  let totalHome = 0, unconverted = 0, everyoneTotal = 0;
  const partial: PartialShare[] = [];
  const itemHome = state.budget.map((x, index) => {
    const raw = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
    const home = convertAmount(raw, currencyOf(x.currency), rate).home;
    if (home === null) { unconverted++; return null; }
    totalHome += home;
    const people = splitCount(x, travelers);
    if (people !== null && travelers > 0) {
      if (home !== 0) partial.push({ index, label: x.category.trim() || '未命名项目', people, perPerson: home / people });
    } else {
      everyoneTotal += home;
    }
    return home;
  });

  const everyone = travelers > 0 ? everyoneTotal / travelers : null;
  return {
    totalHome, unconverted, travelers, itemHome, everyone, partial,
    fullParticipant: everyone === null ? null : everyone + partial.reduce((a, p) => a + p.perPerson, 0),
  };
}
