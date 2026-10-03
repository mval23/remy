import type { Answers } from '../interview/types';
import { R, SIDE_IDS } from './data/recipes';
import { staleReason } from './check';
import { check, kosherClash, score, storage, type PlanContext } from './rules';
import type { Meal, PlanDay, Recipe, Slot } from './types';
import { SLOTS } from './types';

/**
 * General balance guidance, not a nutrition prescription.
 * Checks protein at main meals and fruit/veg servings per day, using rough estimates.
 */

/** Minimum fruit and vegetable servings for a balanced day. */
export const PRODUCE_TARGET = 3;
/**
 * Daily fiber guide in grams: 25 g (the low end of adult guidance) until a personal estimate exists. A day counts as
 * fine at 80% of it (`FIBER_OK`), since these are rough estimates.
 */
export const FIBER_TARGET = 25;
export const FIBER_OK = 0.8;
/** Days estimated below this are flagged as light; Remy never plans them deliberately. */
export const LIGHT_DAY_KCAL = 1200;

export interface NutritionSettings {
  /** Show calorie and macro estimates: true, false, or null for “follow the interview” (on for “Detailed”). */
  nums: boolean | null;
  /** Optional daily targets: typed (their own or a professional's) or copied from Remy's estimate. */
  kcal: string;
  pro: string;
  /** Where the targets came from. Typing in the fields makes them 'typed' again. */
  from: 'typed' | 'estimate';
  /** The estimate's floor (kcal), so fitting never goes under it; null for typed targets (1,200 applies). */
  floor: number | null;
  /** When a check-in last changed an estimate-based target (ms), so changes come at most every 2 weeks. */
  adjustedAt: number;
}
export const defaultNutrition = (): NutritionSettings => ({ nums: null, kcal: '', pro: '', from: 'typed', floor: null, adjustedAt: 0 });

export const balanceOn = (A: Answers) => A.balance !== 'No thanks';
export const estimatesOn = (s: NutritionSettings, A: Answers) => s.nums === true || (s.nums !== false && A.pace === 'Detailed');

/** Protein guide in grams for a slot (0 = not checked). Raised by 5 g if the user is often hungry. */
export function proteinTarget(slot: Slot | 'Side', hungry: boolean): number {
  const extra = hungry ? 5 : 0;
  if (slot === 'Breakfast') return 15 + extra;
  if (slot === 'Lunch' || slot === 'Dinner') return 25 + extra;
  return 0;
}

/** Meal slots whose portion size can be fitted to goals. Snacks and sweets stay as written. */
export const MAIN_SLOTS: Slot[] = ['Breakfast', 'Lunch', 'Dinner'];

/** A meal's estimates: the recipe at its portion size (`x`), plus its side. */
export function mealNutrition(m: Meal | undefined) {
  if (!m?.r) return null;
  const r = R[m.r];
  const x = m.x ?? 1;
  const s = m.side ? R[m.side] : null;
  return {
    kcal: Math.round(r.kcal * x + (s?.kcal ?? 0)),
    pro: Math.round(r.pro * x + (s?.pro ?? 0)),
    carb: Math.round(r.carb * x + (s?.carb ?? 0)),
    fat: Math.round(r.fat * x + (s?.fat ?? 0)),
    fiber: Math.round((r.fiber * x + (s?.fiber ?? 0)) * 10) / 10,
    prod: r.prod * x + (s?.prod ?? 0),
  };
}

export interface DayNutrition {
  kcal: number;
  pro: number;
  carb: number;
  fat: number;
  fiber: number;
  prod: number;
  /** A meal is eaten out, so the estimate is incomplete. */
  out: boolean;
  sweet: boolean;
  /** Main meals below the protein guide. */
  low: Slot[];
  proteinOk: boolean;
  produceOk: boolean;
  /** Fiber at 80% of the daily guide or more. Not part of `ok` yet: shown as information while the numbers are estimates. */
  fiberOk: boolean;
  ok: boolean;
  light: boolean;
}

export function dayNutrition(day: PlanDay, hungry: boolean): DayNutrition {
  let kcal = 0, pro = 0, carb = 0, fat = 0, fiber = 0, prod = 0, out = false, sweet = false;
  const low: Slot[] = [];
  for (const slot of SLOTS) {
    const m = day.meals[slot];
    if (!m) continue;
    if (m.out) {
      out = true;
      continue;
    }
    const n = mealNutrition(m);
    if (!n) continue;
    kcal += n.kcal;
    pro += n.pro;
    carb += n.carb;
    fat += n.fat;
    fiber += n.fiber;
    prod += n.prod;
    if (slot === 'Evening sweet') sweet = true;
    const target = proteinTarget(slot, hungry);
    if (target && n.pro < target) low.push(slot);
  }
  const proteinOk = low.length === 0;
  const produceOk = prod >= PRODUCE_TARGET;
  fiber = Math.round(fiber);
  const fiberOk = fiber >= FIBER_TARGET * FIBER_OK;
  return { kcal, pro, carb, fat, fiber, prod, out, sweet, low, proteinOk, produceOk, fiberOk, ok: proteinOk && produceOk, light: !out && kcal > 0 && kcal < LIGHT_DAY_KCAL };
}

/** A calorie estimate as a rounded range, e.g. "1,700–2,100". */
export function kcalRange(n: number): string {
  const f = (x: number) => (Math.round(x / 50) * 50).toLocaleString('en-US');
  return `${f(n * 0.9)}–${f(n * 1.1)}`;
}

/** Sides that fit a slot on a given day: allowed foods only, safe for that day, best matches first. `main` = the meal's recipe, for Kosher (no dairy side with meat). */
export function sideOptions(ctx: PlanContext, dayIndex: number, slot: Slot, kind?: 'protein' | 'produce', main?: string | null): Recipe[] {
  return SIDE_IDS.map((id) => R[id])
    .filter((s) => s.for?.includes(slot) && (!kind || s.kind === kind) && check(s, ctx.A).ok && storage(s, dayIndex + 1).k !== 'unsafe' && !staleReason(s, dayIndex, ctx) && !kosherClash(ctx.A, main ? R[main] : undefined, s))
    .map((s) => ({ s, sc: score(s, ctx) + (slot === 'Dinner' && s.veg ? 1 : 0) + (s.best?.includes(slot) ? 2 : 0) }))
    .sort((a, b) => b.sc - a.sc)
    .map((x) => x.s);
}

/**
 * Add sides to a day until each main meal meets the protein guide and produce reaches the target, then one
 * fibrous fruit or vegetable side if the day is low on fiber.
 * Never adds a side to a meal that already has one, and never repeats a side within the day.
 * Returns a new day and how many sides were added.
 */
export function balanceDay(day: PlanDay, dayIndex: number, ctx: PlanContext): { day: PlanDay; added: number } {
  const meals = Object.fromEntries(Object.entries(day.meals).map(([k, m]) => [k, { ...m }])) as PlanDay['meals'];
  const next: PlanDay = { ...day, meals };
  let added = 0;
  for (const slot of SLOTS) {
    const m = meals[slot];
    if (!m?.r || m.side) continue;
    const target = proteinTarget(slot, ctx.hungry);
    if (target && (mealNutrition(m)?.pro ?? 0) < target) {
      const o = sideOptions(ctx, dayIndex, slot, 'protein', m.r)[0];
      if (o) {
        m.side = o.id;
        added++;
      }
    }
  }
  for (const slot of ['Dinner', 'Lunch', 'Afternoon snack', 'Breakfast'] as Slot[]) {
    if (dayNutrition(next, ctx.hungry).prod >= PRODUCE_TARGET) break;
    const m = meals[slot];
    if (!m?.r || m.side) continue;
    const used = Object.values(meals).map((x) => x?.side).filter(Boolean);
    const o = sideOptions(ctx, dayIndex, slot, 'produce', m.r).find((x) => !used.includes(x.id));
    if (o) {
      m.side = o.id;
      added++;
    }
  }
  // Fiber: one more fruit or vegetable side, the most fibrous that fits, when the day is under the guide.
  // Days with a meal out are left alone, since their estimate is incomplete, and so are meals already approved.
  const d = dayNutrition(next, ctx.hungry);
  if (!d.fiberOk && !d.out) {
    for (const slot of ['Dinner', 'Lunch', 'Afternoon snack', 'Breakfast'] as Slot[]) {
      const m = meals[slot];
      if (!m?.r || m.side || m.ok) continue;
      const used = Object.values(meals).map((x) => x?.side).filter(Boolean);
      const o = sideOptions(ctx, dayIndex, slot, 'produce', m.r)
        .filter((x) => !used.includes(x.id) && x.fiber >= 2)
        .sort((a, b) => b.fiber - a.fiber)[0];
      if (o) {
        m.side = o.id;
        added++;
        break;
      }
    }
  }
  return { day: next, added };
}
