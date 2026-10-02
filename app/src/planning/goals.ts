import type { Answers } from '../interview/types';
import { noWeightLoss } from '../profile/screen';
import { MEAL_IDS, R } from './data/recipes';
import { dayNutrition, LIGHT_DAY_KCAL, MAIN_SLOTS, sideOptions, type NutritionSettings } from './nutrition';
import { avoided, check, score, storage, type PlanContext } from './rules';
import type { Meal, PlanDay, Slot, WeekPlan } from './types';
import { SLOTS } from './types';

/**
 * Daily goals the person typed in (from a professional or their own). Remy never works them out from body data.
 * The menu is fitted toward them within safe limits: never below about 1,200 kcal a day, sweets always stay,
 * and portions change by at most 20%.
 */
export interface Goals {
  kcal: number | null;
  pro: number | null;
  /** The lowest daily calories fitting may aim for: the estimate's floor. Missing = about 1,200. */
  floor?: number;
}

/** Portion sizes stay within this range, in steps of 5%. */
export const SCALE_MIN = 0.8;
export const SCALE_MAX = 1.2;
/** Close enough: within this share of the calorie goal. */
const TOLERANCE = 0.06;
const MAX_SWAPS = 8;

/**
 * Goals from the typed text; anything unrealistic is ignored. None at all when the health and age screen says
 * Remy shouldn't plan weight loss (pregnancy, breastfeeding, under 18, an eating disorder): see profile/screen.ts.
 */
export function goalsOf(n: Pick<NutritionSettings, 'kcal' | 'pro'> & Partial<Pick<NutritionSettings, 'from' | 'floor'>>, A: Answers): Goals {
  const floor = n.from === 'estimate' && n.floor ? Math.max(n.floor, LIGHT_DAY_KCAL) : LIGHT_DAY_KCAL;
  if (noWeightLoss(A)) return { kcal: null, pro: null, floor };
  const k = Number(n.kcal);
  const p = Number(n.pro);
  return { kcal: k >= 800 && k <= 5000 ? Math.round(k) : null, pro: p >= 20 && p <= 300 ? Math.round(p) : null, floor };
}
export const hasGoals = (g: Goals) => g.kcal !== null || g.pro !== null;

const copyPlan = (plan: WeekPlan): WeekPlan => plan.map((d) => ({ ...d, meals: Object.fromEntries(Object.entries(d.meals).map(([k, m]) => [k, m && { ...m }])) as PlanDay['meals'] }));

/** Average per day, over days with no meal out (a meal out isn't counted, so those days would look low). */
export function weekAverage(plan: WeekPlan, hungry: boolean): { kcal: number; pro: number } {
  const days = plan.map((d) => dayNutrition(d, hungry)).filter((d) => !d.out && d.kcal > 0);
  if (!days.length) return { kcal: 0, pro: 0 };
  return { kcal: days.reduce((s, d) => s + d.kcal, 0) / days.length, pro: days.reduce((s, d) => s + d.pro, 0) / days.length };
}

export interface FitResult {
  plan: WeekPlan;
  /** Recipes swapped for lighter or heavier ones. */
  swapped: number;
  /** Protein sides added. */
  sides: number;
  /** Portion size for main meals (1 = as written); whole-item dishes stay as written. */
  scale: number;
  /** Days brought back toward the target with a snack swap or a side. */
  dayFixes: number;
  /** Where the week lands, per day on average. */
  kcal: number;
  pro: number;
}

/**
 * Fit a week toward the goals, in three steps:
 * 1. Swap unapproved recipes (on every day they appear) for lighter or heavier ones that pass every rule.
 * 2. Add protein sides to unapproved meals on days below the protein goal.
 * 3. Fine-tune main-meal portions (80–120%, in 10% steps; whole-item dishes like burritos stay as written).
 * 4. Bring days still far from the target (more than 12% off, or under the floor) back with a snack swap or a side.
 * Approved meals keep their recipe; sweets are never swapped out or shrunk. Pure and deterministic.
 */
export function fitToGoals(input: WeekPlan, ctx: PlanContext, goals: Goals): FitResult {
  let plan = copyPlan(input);
  // Start from as-written portions, so fitting again gives the same answer.
  for (const d of plan) for (const m of Object.values(d.meals)) if (m) delete m.x;
  const target = goals.kcal === null ? null : Math.max(goals.kcal, goals.floor ?? LIGHT_DAY_KCAL);
  let swapped = 0;
  let sides = 0;

  // 1. Swaps.
  if (target !== null) {
    for (let n = 0; n < MAX_SWAPS; n++) {
      const avg = weekAverage(plan, ctx.hungry).kcal;
      const gap = target - avg;
      if (Math.abs(gap) <= target * TOLERANCE) break;
      const best = bestSwap(plan, ctx, gap);
      if (!best) break;
      for (const d of plan) {
        const m = d.meals[best.slot];
        if (m?.r === best.from && !m.ok) d.meals[best.slot] = { ...m, r: best.to };
      }
      swapped++;
    }
  }

  // 2. Protein sides, then 3. portions (and protein again, since smaller portions have less of it).
  sides += addProtein(plan, ctx, goals.pro);
  let scale = 1;
  let dayFixes = 0;
  if (target !== null) {
    const floor = goals.floor ?? LIGHT_DAY_KCAL;
    scale = portionScale(plan, ctx, target, floor);
    plan = withScale(plan, scale);
    sides += addProtein(plan, ctx, goals.pro);
    dayFixes = fixDays(plan, ctx, target, floor);
  }
  const avg = weekAverage(plan, ctx.hungry);
  return { plan, swapped, sides, scale, dayFixes, kcal: Math.round(avg.kcal), pro: Math.round(avg.pro) };
}

interface Swap {
  slot: Slot;
  from: string;
  to: string;
}

/** The swap that moves the weekly average closest to the goal, preferring recipes the person likes more. */
function bestSwap(plan: WeekPlan, ctx: PlanContext, gap: number): Swap | null {
  const counted = plan.filter((d) => !dayNutrition(d, ctx.hungry).out).length || 1;
  const inPlan = new Set<string>();
  for (const d of plan) for (const m of Object.values(d.meals)) if (m?.r) inPlan.add(m.r);
  let best: (Swap & { rank: number }) | null = null;
  for (const slot of SLOTS) {
    if (slot === 'Evening sweet') continue;
    const uses: Record<string, { n: number; last: number }> = {};
    plan.forEach((d, i) => {
      const m = d.meals[slot];
      if (!m?.r || m.ok) return;
      uses[m.r] = { n: (uses[m.r]?.n ?? 0) + 1, last: i + 1 };
    });
    for (const [from, u] of Object.entries(uses)) {
      const cur = R[from];
      for (const id of MEAL_IDS) {
        const r = R[id];
        if (r.slot !== slot || inPlan.has(id) || avoided(id, ctx) || !check(r, ctx.A).ok || storage(r, u.last).k === 'unsafe' || (r.maxPerWeek !== undefined && u.n > r.maxPerWeek)) continue;
        const change = ((r.kcal - cur.kcal) * u.n) / counted;
        // Must move toward the goal and not overshoot by more than it closes.
        if (Math.sign(change) !== Math.sign(gap) || Math.abs(gap - change) >= Math.abs(gap)) continue;
        const liked = score(r, ctx);
        if (liked <= 0) continue;
        const rank = Math.abs(gap - change) - liked * 10;
        if (!best || rank < best.rank) best = { slot, from, to: id, rank };
      }
    }
  }
  return best && { slot: best.slot, from: best.from, to: best.to };
}

/** Add protein sides to unapproved meals without one, on days below the protein goal. */
function addProtein(plan: WeekPlan, ctx: PlanContext, goal: number | null): number {
  if (goal === null) return 0;
  let added = 0;
  plan.forEach((day, i) => {
    for (const slot of ['Breakfast', 'Afternoon snack', 'Lunch', 'Dinner'] as Slot[]) {
      if (dayNutrition(day, ctx.hungry).pro >= goal) return;
      const m = day.meals[slot];
      if (!m?.r || m.ok || m.side) continue;
      const side = sideOptions(ctx, i, slot, 'protein', m.r).sort((a, b) => b.pro / b.kcal - a.pro / a.kcal)[0];
      if (!side) continue;
      m.side = side.id;
      added++;
    }
  });
  return added;
}

const MAIN = new Set<Slot>(MAIN_SLOTS);

function withScale(plan: WeekPlan, x: number): WeekPlan {
  return plan.map((d) => ({
    ...d,
    meals: Object.fromEntries(Object.entries(d.meals).map(([k, m]) => [k, m?.r && MAIN.has(k as Slot) && x !== 1 && !R[m.r].whole ? ({ ...m, x } as Meal) : m])) as PlanDay['meals'],
  }));
}

/** The main-meal portion size (80–120%, steps of 10%) that brings the average closest to the goal, without taking any day under the floor. */
function portionScale(plan: WeekPlan, ctx: PlanContext, target: number, floor: number): number {
  const avg = weekAverage(plan, ctx.hungry).kcal;
  if (!avg || Math.abs(target - avg) <= target * 0.03) return 1;
  let mainKcal = 0;
  let days = 0;
  for (const d of plan) {
    if (dayNutrition(d, ctx.hungry).out) continue;
    days++;
    for (const slot of MAIN_SLOTS) {
      const m = d.meals[slot];
      if (m?.r && !R[m.r].whole) mainKcal += R[m.r].kcal;
    }
  }
  if (!mainKcal) return 1;
  const raw = 1 + ((target - avg) * days) / mainKcal;
  let x = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(raw * 10) / 10));
  // Never take a day under the floor (about 1,200 kcal, or the estimate's floor).
  const under = (p: WeekPlan) => p.some((d) => {
    const n = dayNutrition(d, ctx.hungry);
    return !n.out && n.kcal > 0 && n.kcal < floor;
  });
  while (x < 1 && under(withScale(plan, x))) x = Math.round((x + 0.1) * 10) / 10;
  return x;
}

/** How far a day may land from the target before Remy changes it: 12% either way, and never under the floor. */
export const DAY_BAND = 0.12;

/**
 * Snacks a day could switch to: allowed, safe on that day, liked, and quick to prep (already on this week's menu,
 * or 10 minutes of work or less, like fruit), so fixing one day doesn't add much to prep day.
 */
function snackOptions(plan: WeekPlan, ctx: PlanContext, dayIndex: number): string[] {
  const inPlan = new Set<string>();
  for (const d of plan) for (const m of Object.values(d.meals)) if (m?.r) inPlan.add(m.r);
  return MEAL_IDS.filter((id) => {
    const r = R[id];
    if (r.slot !== 'Afternoon snack' || avoided(id, ctx) || !check(r, ctx.A).ok || storage(r, dayIndex + 1).k === 'unsafe' || score(r, ctx) <= 0) return false;
    return inPlan.has(id) || r.tasks.reduce((s, t) => s + t.m, 0) <= 10;
  });
}

/**
 * Bring days still far from the target back toward it, one day at a time: a lighter or heavier snack, or a protein
 * side on a main meal when the day is low. Unapproved meals only; sweets are never touched. Returns how many days changed.
 */
function fixDays(plan: WeekPlan, ctx: PlanContext, target: number, floor: number): number {
  const lo = Math.max(floor, target * (1 - DAY_BAND));
  const hi = target * (1 + DAY_BAND);
  let fixed = 0;
  plan.forEach((day, i) => {
    const before = dayNutrition(day, ctx.hungry);
    if (before.out || !before.kcal || (before.kcal >= lo && before.kcal <= hi)) return;
    const kcal = () => dayNutrition(day, ctx.hungry).kcal;
    const off = (k: number) => (k < lo ? lo - k : k > hi ? k - hi : 0);
    // A different snack, the one that lands closest to the target.
    const snack = day.meals['Afternoon snack'];
    if (snack?.r && !snack.ok) {
      const now = snack.r;
      let best: { id: string; miss: number } | null = null;
      for (const id of snackOptions(plan, ctx, i)) {
        day.meals['Afternoon snack'] = { ...snack, r: id };
        const miss = Math.abs(kcal() - target);
        if (off(kcal()) < off(before.kcal) && (!best || miss < best.miss)) best = { id, miss };
      }
      day.meals['Afternoon snack'] = { ...snack, r: best?.id ?? now };
    }
    // Still high: drop a side the day doesn't need (protein and produce stay met without it), heaviest first.
    for (const slot of [...SLOTS].sort((a, b) => (R[day.meals[b]?.side ?? '']?.kcal ?? 0) - (R[day.meals[a]?.side ?? '']?.kcal ?? 0))) {
      if (kcal() <= hi) break;
      const m = day.meals[slot];
      if (!m?.side || m.ok) continue;
      const side = m.side;
      delete m.side;
      const n = dayNutrition(day, ctx.hungry);
      if (!n.proteinOk || !n.produceOk) m.side = side;
    }
    // Still low: a protein side on a main meal.
    for (const slot of ['Lunch', 'Dinner', 'Breakfast'] as Slot[]) {
      if (kcal() >= lo) break;
      const m = day.meals[slot];
      if (!m?.r || m.ok || m.side) continue;
      const side = sideOptions(ctx, i, slot, 'protein', m.r)[0];
      if (side) m.side = side.id;
    }
    if (kcal() !== before.kcal) fixed++;
  });
  return fixed;
}
