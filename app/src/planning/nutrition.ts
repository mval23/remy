import type { Answers } from '../interview/types';
import { R, SIDE_IDS } from './data/recipes';
import { check, score, storage, type PlanContext } from './rules';
import type { Meal, PlanDay, Recipe, Slot } from './types';
import { SLOTS } from './types';

/**
 * General balance guidance, not a nutrition prescription.
 * Checks protein at main meals and fruit/veg servings per day, using rough estimates.
 */

/** Minimum fruit and vegetable servings for a balanced day. */
export const PRODUCE_TARGET = 3;
/** Days estimated below this are flagged as light; Remy never plans them deliberately. */
export const LIGHT_DAY_KCAL = 1200;

export interface NutritionSettings {
  /** Show calorie and macro estimates: true, false, or null for “follow the interview” (on for “Detailed”). */
  nums: boolean | null;
  /** Optional targets from a professional, as typed. */
  kcal: string;
  pro: string;
}
export const defaultNutrition = (): NutritionSettings => ({ nums: null, kcal: '', pro: '' });

export const balanceOn = (A: Answers) => A.balance !== 'No thanks';
export const estimatesOn = (s: NutritionSettings, A: Answers) => s.nums === true || (s.nums !== false && A.pace === 'Detailed');

/** Protein guide in grams for a slot (0 = not checked). Raised by 5 g if the user is often hungry. */
export function proteinTarget(slot: Slot | 'Side', hungry: boolean): number {
  const extra = hungry ? 5 : 0;
  if (slot === 'Breakfast') return 15 + extra;
  if (slot === 'Lunch' || slot === 'Dinner') return 25 + extra;
  return 0;
}

export function mealNutrition(m: Meal | undefined) {
  if (!m?.r) return null;
  const r = R[m.r];
  const s = m.side ? R[m.side] : null;
  return { kcal: r.kcal + (s?.kcal ?? 0), pro: r.pro + (s?.pro ?? 0), carb: r.carb + (s?.carb ?? 0), fat: r.fat + (s?.fat ?? 0), prod: r.prod + (s?.prod ?? 0) };
}

export interface DayNutrition {
  kcal: number;
  pro: number;
  carb: number;
  fat: number;
  prod: number;
  /** A meal is eaten out, so the estimate is incomplete. */
  out: boolean;
  sweet: boolean;
  /** Main meals below the protein guide. */
  low: Slot[];
  proteinOk: boolean;
  produceOk: boolean;
  ok: boolean;
  light: boolean;
}

export function dayNutrition(day: PlanDay, hungry: boolean): DayNutrition {
  let kcal = 0, pro = 0, carb = 0, fat = 0, prod = 0, out = false, sweet = false;
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
    prod += n.prod;
    if (slot === 'Evening sweet') sweet = true;
    const target = proteinTarget(slot, hungry);
    if (target && n.pro < target) low.push(slot);
  }
  const proteinOk = low.length === 0;
  const produceOk = prod >= PRODUCE_TARGET;
  return { kcal, pro, carb, fat, prod, out, sweet, low, proteinOk, produceOk, ok: proteinOk && produceOk, light: !out && kcal > 0 && kcal < LIGHT_DAY_KCAL };
}

/** A calorie estimate as a rounded range, e.g. "1,700–2,100". */
export function kcalRange(n: number): string {
  const f = (x: number) => (Math.round(x / 50) * 50).toLocaleString('en-US');
  return `${f(n * 0.9)}–${f(n * 1.1)}`;
}

/** Sides that fit a slot on a given day: allowed foods only, safe for that day, best matches first. */
export function sideOptions(ctx: PlanContext, dayIndex: number, slot: Slot, kind?: 'protein' | 'produce'): Recipe[] {
  return SIDE_IDS.map((id) => R[id])
    .filter((s) => s.for?.includes(slot) && (!kind || s.kind === kind) && check(s, ctx.A).ok && storage(s, dayIndex + 1).k !== 'unsafe')
    .map((s) => ({ s, sc: score(s, ctx) + (slot === 'Dinner' && s.veg ? 1 : 0) + (s.best?.includes(slot) ? 2 : 0) }))
    .sort((a, b) => b.sc - a.sc)
    .map((x) => x.s);
}

/**
 * Add sides to a day until each main meal meets the protein guide and produce reaches the target.
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
      const o = sideOptions(ctx, dayIndex, slot, 'protein')[0];
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
    const o = sideOptions(ctx, dayIndex, slot, 'produce').find((x) => !used.includes(x.id));
    if (o) {
      m.side = o.id;
      added++;
    }
  }
  return { day: next, added };
}
