import { asBudget, has } from '../interview/helpers';
import type { Answers } from '../interview/types';
import { ING } from './data/ingredients';
import { R } from './data/recipes';
import { portions } from './planner';
import { quantityText } from './units';
import type { WeekPlan } from './types';

/** The user's edits to the generated list. */
export interface GroceryEdits {
  checked: Record<string, boolean>;
  /** true = already at home, false = buy it even if the pantry answer says otherwise. */
  have: Record<string, boolean>;
  /** Quantity text typed by the user, by item key. */
  qty: Record<string, string>;
  deleted: Record<string, boolean>;
  custom: { id: string; n: string; sec: string; q: string }[];
}
export const emptyGroceryEdits = (): GroceryEdits => ({ checked: {}, have: {}, qty: {}, deleted: {}, custom: [] });

export interface GroceryItem {
  k: string;
  n: string;
  /** Summed quantity (null for items the user added). */
  q: number | null;
  u: string;
  sec: string;
  /** Estimated cost in USD, or null when unknown. */
  cost: number | null;
  /** e.g. "2 × 225 g bag" */
  packs: string;
  /** Recipes (short names) that use it. */
  from: string[];
  home: boolean;
  custom: boolean;
  qtyText: string;
}

/** Merge every planned recipe's ingredients into one list, applying the user's edits. */
export function groceryList(plan: WeekPlan, A: Answers, edits: GroceryEdits): GroceryItem[] {
  const pc = portions(plan);
  const total: Record<string, number> = {};
  const from: Record<string, string[]> = {};
  for (const id of Object.keys(pc)) {
    const r = R[id];
    const batches = Math.ceil(pc[id] / r.serves);
    for (const [k, q] of r.ing) {
      total[k] = (total[k] ?? 0) + q * batches;
      from[k] = from[k] ?? [];
      if (!from[k].includes(r.short)) from[k].push(r.short);
    }
  }
  const items: GroceryItem[] = Object.keys(total).map((k) => {
    const g = ING[k];
    const q = total[k];
    const packs = g.pk ? Math.ceil(q / g.pk - 1e-9) : 0;
    const cost = g.pk ? packs * (g.pp ?? 0) : q * (g.p ?? 0);
    const pantryHome = !!(g.pan && has(A.pantry, g.pan));
    return {
      k, n: g.n, q, u: g.u, sec: g.sec, cost,
      packs: g.pk ? `${packs} × ${g.pkn}` : '',
      from: from[k],
      home: edits.have[k] ?? pantryHome,
      custom: false,
      qtyText: edits.qty[k] ?? quantityText(q, g.u),
    };
  });
  for (const c of edits.custom) {
    items.push({ k: c.id, n: c.n, q: null, u: '', sec: c.sec || 'Other', cost: null, packs: '', from: ['Added by you'], home: !!edits.have[c.id], custom: true, qtyText: edits.qty[c.id] ?? c.q });
  }
  return items.filter((x) => !edits.deleted[x.k]);
}

export { fraction, quantityText } from './units';

export type CostEstimate =
  | { show: false; why: string }
  | { show: true; low: number; high: number; budget: number; unknown: number; carryOver: number };

/**
 * A rough cost range. Only shown for a USD budget, because prices are US estimates.
 * `carryOver` is the value of pack leftovers (sauces, butter) that last into next week.
 */
export function costEstimate(items: GroceryItem[], A: Answers): CostEstimate {
  const b = asBudget(A.budget);
  if (!b || !b.amount) return { show: false, why: 'Add a weekly budget in your profile to see cost estimates.' };
  if (b.currency !== 'USD') return { show: false, why: `I don’t have reliable ${b.currency} prices yet, so I’m not showing cost estimates.` };
  const buy = items.filter((x) => !x.home);
  const unknown = buy.filter((x) => x.cost === null).length;
  const total = buy.reduce((s, x) => s + (x.cost ?? 0), 0);
  const carryOver = buy.reduce((s, x) => {
    const g = ING[x.k];
    if (!g?.pk || !x.cost || x.q === null) return s;
    const packs = Math.ceil(x.q / g.pk - 1e-9);
    return s + x.cost * (1 - x.q / (packs * g.pk));
  }, 0);
  return { show: true, low: Math.floor(total * 0.9), high: Math.ceil(total * 1.12), budget: b.amount, unknown, carryOver: Math.round(carryOver) };
}
