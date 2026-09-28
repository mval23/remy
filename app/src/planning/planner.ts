import { MEAL_IDS, R } from './data/recipes';
import { WEEKS } from './data/weeks';
import { balanceDay } from './nutrition';
import { activeSlots, avoided, check, isAway, KEEP_AT, score, storage, sweetDays, weekDays, type CheckResult, type PlanContext } from './rules';
import type { Meal, PlanDay, Recipe, Slot, Variety, WeekPlan } from './types';
import { SLOTS } from './types';

/**
 * Pick a recipe for a slot on day `day` (1–7 after prep).
 * Keeps the template choice when it's allowed, storage-safe and not avoided after feedback; otherwise picks
 * the best allowed alternative, preferring recipes already in the plan so prep day stays short.
 * Avoided recipes are used only when nothing else fits.
 */
export function resolve(templateId: string, slot: Slot, day: number, used: Set<string>, ctx: PlanContext): string | null {
  const r = R[templateId];
  if (r && check(r, ctx.A).ok && storage(r, day).k !== 'unsafe' && !avoided(r.id, ctx)) return templateId;
  const fits = MEAL_IDS.map((id) => R[id]).filter((x) => x.slot === slot && check(x, ctx.A).ok && storage(x, day).k !== 'unsafe');
  const preferred = fits.filter((x) => !avoided(x.id, ctx));
  const candidates = preferred.length ? preferred : fits;
  candidates.sort((a, b) => score(b, ctx) + (used.has(b.id) ? 3 : 0) - (score(a, ctx) + (used.has(a.id) ? 3 : 0)));
  return candidates[0]?.id ?? null;
}

/** Minutes of prep-day work (everything except fridge and freezer time). */
const work = (r: Recipe) => r.tasks.filter((t) => t.l !== 'chill').reduce((s, t) => s + t.m, 0);
/** A rotated-in recipe may take at most this many more minutes than the one it replaces. */
const ROTATE_EXTRA_MINUTES = 5;

/** How many recipes per meal slot a new week swaps for something different. */
const ROTATE_PER_SLOT: Record<Variety, number> = { favorites: 0, balanced: 1, variety: 2 };

/**
 * Which template recipes to swap this week, so consecutive weeks don't repeat exactly.
 * Only recipes eaten last week (`ctx.recent`) rotate out, never ones marked Loved, least-liked first.
 * Replacements must pass every rule, keep safely until the last day they're eaten, contain
 * something the person likes (score above 0), take about the same prep-day work (so prep day
 * doesn't grow), and not be last week's or already in the template.
 * The result is deterministic, so rebuilding the same week gives the same swaps.
 */
export function rotation(variety: Variety, ctx: PlanContext): Record<string, string> {
  const swap: Record<string, string> = {};
  const limit = ROTATE_PER_SLOT[variety];
  if (!limit || !ctx.recent.length) return swap;
  const template = WEEKS[variety].days;
  const recent = new Set(ctx.recent);
  const inTemplate = new Set(template.flat());
  const taken = new Set<string>();
  SLOTS.forEach((slot, si) => {
    const lastDay: Record<string, number> = {};
    template.forEach((row, i) => {
      lastDay[row[si]] = i + 1;
    });
    const out = Object.keys(lastDay)
      .filter((id) => R[id] && recent.has(id) && (ctx.adj[id] ?? 0) < KEEP_AT)
      .sort((a, b) => score(R[a], ctx) - score(R[b], ctx) || a.localeCompare(b))
      .slice(0, limit);
    for (const id of out) {
      const pick = MEAL_IDS.map((x) => R[x])
        .filter(
          (r) =>
            r.slot === slot && !recent.has(r.id) && !inTemplate.has(r.id) && !taken.has(r.id) && !avoided(r.id, ctx) &&
            check(r, ctx.A).ok && storage(r, lastDay[id]).k !== 'unsafe' && score(r, ctx) > 0 &&
            work(r) <= work(R[id]) + ROTATE_EXTRA_MINUTES,
        )
        .sort((a, b) => score(b, ctx) - score(a, ctx) || a.id.localeCompare(b.id))[0];
      if (pick) {
        swap[id] = pick.id;
        taken.add(pick.id);
      }
    }
  });
  return swap;
}

/**
 * Build a week from a template.
 * With `previous`, approved meals that are still allowed are kept and only the rest is rebuilt.
 * After the first week, some recipes rotate (see `rotation`).
 * Adds balancing sides when the user asked for them.
 */
export function buildPlan(variety: Variety, ctx: PlanContext, previous?: WeekPlan | null): { plan: WeekPlan; changed: number } {
  const template = WEEKS[variety].days;
  const slots = activeSlots(ctx.A);
  const days = weekDays(ctx.A);
  const sweets = sweetDays(ctx.A);
  const used = new Set<string>();
  const swap = rotation(variety, ctx);
  let changed = 0;

  let plan: WeekPlan = days.map((d, i) => {
    const meals: PlanDay['meals'] = {};
    SLOTS.forEach((slot, si) => {
      if (!slots.includes(slot)) return;
      if (slot === 'Evening sweet' && !sweets.includes(i)) {
        meals[slot] = { skip: true };
        return;
      }
      const prev = previous?.[i]?.meals[slot];
      if (prev?.ok && prev.r && check(R[prev.r], ctx.A).ok) {
        meals[slot] = prev;
        used.add(prev.r);
        return;
      }
      if (isAway(ctx.A, d, slot)) {
        meals[slot] = { out: true };
        return;
      }
      const planned = template[i][si];
      const rid = resolve(swap[planned] ?? planned, slot, i + 1, used, ctx);
      if (rid) used.add(rid);
      if (!prev || prev.r !== rid) changed++;
      meals[slot] = rid ? { r: rid, ok: false } : { r: null, need: true, ok: false };
    });
    return { d, meals };
  });

  if (ctx.A.balance === 'Yes, suggest sides') plan = plan.map((day, i) => balanceDay(day, i, ctx).day);
  return { plan, changed };
}

/* ---------- reading the plan ---------- */

export function eachMeal(plan: WeekPlan, fn: (m: Meal, slot: Slot, dayIndex: number, day: PlanDay) => void) {
  plan.forEach((day, i) => {
    for (const slot of SLOTS) {
      const m = day.meals[slot];
      if (m) fn(m, slot, i, day);
    }
  });
}

/** Portions per recipe id across the week, sides included. */
export function portions(plan: WeekPlan): Record<string, number> {
  const c: Record<string, number> = {};
  eachMeal(plan, (m) => {
    if (m.r) {
      c[m.r] = (c[m.r] ?? 0) + 1;
      if (m.side) c[m.side] = (c[m.side] ?? 0) + 1;
    }
  });
  return c;
}

export function approvalCounts(plan: WeekPlan) {
  let total = 0, ok = 0;
  eachMeal(plan, (m) => {
    if (m.r || m.need) {
      total++;
      if (m.ok) ok++;
    }
  });
  return { total, ok };
}

/** Recipes that need cooking or packing on prep day (not store-bought). */
export function recipesToCook(plan: WeekPlan): Recipe[] {
  return Object.keys(portions(plan)).map((id) => R[id]).filter((r) => r.tasks.length > 0);
}

/* ---------- changing the plan (all return a new plan) ---------- */

const withMeal = (plan: WeekPlan, d: number, slot: Slot, fn: (m: Meal) => Meal): WeekPlan =>
  plan.map((day, i) => (i === d ? { ...day, meals: { ...day.meals, [slot]: fn(day.meals[slot] ?? {}) } } : day));

export const setApproved = (plan: WeekPlan, d: number, slot: Slot, ok: boolean) => withMeal(plan, d, slot, (m) => ({ ...m, ok }));

const approveAllMeals = (day: PlanDay): PlanDay => ({
  ...day,
  meals: Object.fromEntries(Object.entries(day.meals).map(([k, m]) => [k, m?.r ? { ...m, ok: true } : m])),
});

export const approveDay = (plan: WeekPlan, d: number): WeekPlan => plan.map((day, i) => (i === d ? approveAllMeals(day) : day));

export const approveAll = (plan: WeekPlan): WeekPlan => plan.map(approveAllMeals);

/** Swap in a different recipe for one meal. Other meals are untouched. The side is dropped. */
export const replaceMeal = (plan: WeekPlan, d: number, slot: Slot, recipeId: string) => withMeal(plan, d, slot, () => ({ r: recipeId, ok: false }));

/** Plan a meal on a slot that was skipped or eaten out. */
export const openSlot = (plan: WeekPlan, d: number, slot: Slot) => withMeal(plan, d, slot, () => ({ r: null, need: true, ok: false }));

export const setSide = (plan: WeekPlan, d: number, slot: Slot, sideId: string | null) =>
  withMeal(plan, d, slot, (m) => {
    const next = { ...m };
    if (sideId) next.side = sideId;
    else delete next.side;
    return next;
  });

export interface ReplacementOptions {
  allowed: Recipe[];
  blocked: { r: Recipe; reason: string; allergy: boolean }[];
  hidden: { r: Recipe; reason: string }[];
}

/** Alternatives for one meal, best first, plus what was ruled out and why. */
export function replacementOptions(plan: WeekPlan, d: number, slot: Slot, ctx: PlanContext): ReplacementOptions {
  const current = plan[d].meals[slot]?.r;
  const all = MEAL_IDS.map((id) => R[id]).filter((r) => r.slot === slot && r.id !== current);
  const out: ReplacementOptions = { allowed: [], blocked: [], hidden: [] };
  for (const r of all) {
    const c: CheckResult = check(r, ctx.A);
    if (c.ok) out.allowed.push(r);
    else if ('blocked' in c) out.blocked.push({ r, reason: c.reason, allergy: c.allergy });
    else out.hidden.push({ r, reason: c.reason });
  }
  out.allowed.sort((a, b) => score(b, ctx) - score(a, ctx));
  return out;
}

/** The best allowed, storage-safe alternative (“Pick for me”). */
export function autoReplacement(plan: WeekPlan, d: number, slot: Slot, ctx: PlanContext): string | null {
  return replacementOptions(plan, d, slot, ctx).allowed.find((r) => storage(r, d + 1).k !== 'unsafe')?.id ?? null;
}

/** Can the meal at (from, slot) swap with the same slot on day `to`? Returns the reason if not. */
export function moveBlocker(plan: WeekPlan, from: number, to: number, slot: Slot): string | null {
  const a = plan[from].meals[slot];
  const b = plan[to].meals[slot];
  if (!a?.r) return 'Nothing to move';
  if (!b) return `No ${slot.toLowerCase()} planned that day`;
  const ra = R[a.r];
  if (storage(ra, to + 1).k === 'unsafe') return `Day ${to + 1} is past the ${ra.fridge}-day fridge limit, and it doesn’t freeze well`;
  if (b.r && storage(R[b.r], from + 1).k === 'unsafe') return `${R[b.r].short} wouldn’t be safe on day ${from + 1}`;
  return null;
}

export function swapMeals(plan: WeekPlan, from: number, to: number, slot: Slot): WeekPlan {
  const a = plan[from].meals[slot];
  const b = plan[to].meals[slot];
  return plan.map((day, i) => {
    if (i === from) return { ...day, meals: { ...day.meals, [slot]: b } };
    if (i === to) return { ...day, meals: { ...day.meals, [slot]: a } };
    return day;
  });
}
