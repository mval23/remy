import type { Answers } from '../interview/types';
import { ING } from './data/ingredients';
import { fitToGoals, hasGoals, type Goals } from './goals';
import { emptyGroceryEdits, ingredientTotals, toItems, type GroceryEdits, type GroceryItem, type Totals } from './grocery';
import { buildPlan, eachMeal } from './planner';
import type { PlanContext } from './rules';
import type { Variety, WeekPlan } from './types';

/**
 * Shopping once a month for what keeps (meat and fish to freeze, grains, pantry, hard cheese, frozen food,
 * potatoes), and weekly for fresh produce, milk, yogurt, eggs, soft cheese and bread.
 */
export type ShopMode = 'weekly' | 'monthly';

/** How many weeks the monthly shop covers. */
export const MONTH_WEEKS = 4;

const BREAD = new Set(['tortillas', 'corntortillas', 'englishmuffins', 'buns', 'pita', 'bread']);
const KEEPING_DAIRY = new Set(['cheddar', 'cheeseblock', 'parmesan', 'mozzarella', 'stringcheese', 'butter']);
/** Keep a month somewhere cool and dark (not the fridge). */
const KEEPING_PRODUCE = new Set(['potatoes', 'sweetpotatoes']);

/** Bought on the monthly trip? */
export function buysMonthly(k: string): boolean {
  const g = ING[k];
  if (!g) return false;
  if (g.sec === 'Meat' || g.sec === 'Frozen' || g.sec === 'Pantry & sauces' || g.sec === 'Snacks & sweets') return true;
  if (g.sec === 'Bakery & grains') return !BREAD.has(k);
  if (g.sec === 'Dairy & eggs') return KEEPING_DAIRY.has(k);
  if (g.sec === 'Produce') return KEEPING_PRODUCE.has(k);
  return false;
}

/** Bought monthly and kept in the freezer until the week it's needed. */
export const freezeOnArrival = (k: string) => ING[k]?.sec === 'Meat';

const mealIds = (plan: WeekPlan) => {
  const ids: string[] = [];
  eachMeal(plan, (m) => m.r && !ids.includes(m.r) && ids.push(m.r));
  return ids;
};

/**
 * The next weeks as Remy would plan them without new feedback: this week, then each following week built
 * the way a check-in builds it (some recipes rotate), fitted to the goals. Not set in stone: check-ins change it.
 */
export function forecastWeeks(plan: WeekPlan, variety: Variety, ctx: PlanContext, goals: Goals, weeks = MONTH_WEEKS): WeekPlan[] {
  const out = [plan];
  for (let i = 1; i < weeks; i++) {
    let next = buildPlan(variety, { ...ctx, recent: mealIds(out[i - 1]) }).plan;
    if (hasGoals(goals)) next = fitToGoals(next, ctx, goals).plan;
    out.push(next);
  }
  return out;
}

/** The monthly shop: what keeps, added up over the forecast weeks. */
export function monthList(weeks: WeekPlan[], A: Answers, edits: GroceryEdits): GroceryItem[] {
  const sum: Totals = { total: {}, from: {} };
  for (const w of weeks) {
    const t = ingredientTotals(w);
    for (const k of Object.keys(t.total)) {
      if (!buysMonthly(k)) continue;
      sum.total[k] = (sum.total[k] ?? 0) + t.total[k];
      sum.from[k] = [...new Set([...(sum.from[k] ?? []), ...t.from[k]])];
    }
  }
  return toItems(sum, A, edits);
}

/** A week's meat (bought on the monthly shop and frozen until then): name and amount, largest first. */
export function meatOf(plan: WeekPlan, A: Answers): { k: string; n: string; q: number; qtyText: string }[] {
  const t = ingredientTotals(plan);
  return toItems({ total: Object.fromEntries(Object.entries(t.total).filter(([k]) => freezeOnArrival(k))), from: t.from }, A, emptyGroceryEdits())
    .filter((x) => x.q)
    .map((x) => ({ k: x.k, n: x.n, q: x.q!, qtyText: x.qtyText }))
    .sort((a, b) => (ING[b.k].u === 'g' ? b.q : 0) - (ING[a.k].u === 'g' ? a.q : 0));
}
