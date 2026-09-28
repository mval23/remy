import { MEAL_IDS, R, REMOVED } from './data/recipes';
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
  if (r && r.slot === slot && !REMOVED.has(templateId) && check(r, ctx.A).ok && storage(r, day).k !== 'unsafe' && !avoided(r.id, ctx)) return templateId;
  return bestFor(slot, day, used, ctx) ?? (PARTNER[slot] ? bestFor(PARTNER[slot]!, day, used, ctx) : null);
}

/** The best recipe of `slot`'s own kind that fits the rules and keeps until `day`; recipes already this week come first. */
function bestFor(slot: Slot, day: number, used: Set<string>, ctx: PlanContext): string | null {
  const fits = MEAL_IDS.map((id) => R[id]).filter((x) => x.slot === slot && check(x, ctx.A).ok && storage(x, day).k !== 'unsafe');
  const preferred = fits.filter((x) => !avoided(x.id, ctx));
  const candidates = preferred.length ? preferred : fits;
  candidates.sort((a, b) => score(b, ctx) + (used.has(b.id) ? 3 : 0) - (score(a, ctx) + (used.has(a.id) ? 3 : 0)));
  return candidates[0]?.id ?? null;
}

/**
 * Lunch and dinner stand in for each other. When nothing for one of them fits the rules and keeps until a late day
 * (days 5–7 need a dish that freezes), a freezer-friendly main from the other meal fills it, preferably one already
 * cooked this week, so a meal is never left empty just because the lunch list is short.
 */
const PARTNER: Partial<Record<Slot, Slot>> = { Lunch: 'Dinner', Dinner: 'Lunch' };

/** A recipe can be served at this meal: its own meal, or borrowed from the other main meal. */
export const servesAt = (r: Recipe, slot: Slot, m?: Meal) => r.slot === slot || (!!m?.borrowed && PARTNER[slot] === r.slot);

/** A meal with this recipe, marked borrowed when the recipe belongs to the other main meal. */
export const mealWith = (id: string, slot: Slot): Meal => (R[id].slot === slot ? { r: id, ok: false } : { r: id, ok: false, borrowed: true });

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
      if (prev?.ok && prev.r && !REMOVED.has(prev.r) && servesAt(R[prev.r], slot, prev) && check(R[prev.r], ctx.A).ok) {
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
      meals[slot] = rid ? mealWith(rid, slot) : { r: null, need: true, ok: false };
    });
    return { d, meals };
  });

  if (ctx.A.balance === 'Yes, suggest sides') plan = plan.map((day, i) => balanceDay(day, i, ctx).day);
  return { plan, changed };
}

/**
 * “New menu”: a different week for every meal that isn't approved. Approved meals stay.
 * Each unapproved recipe is swapped, on every day it appears, for one that isn't on the current menu,
 * passes every rule, isn't avoided after feedback and keeps safely until its last day. Recipes the person
 * likes (score above 0) come first. `seed` picks among the best few, so tapping again gives another option;
 * the result is deterministic for the same seed.
 */
export function regenerate(variety: Variety, ctx: PlanContext, previous: WeekPlan, seed: number): { plan: WeekPlan; changed: number } {
  let plan = buildPlan(variety, ctx, previous).plan.map((day) => ({ ...day, meals: Object.fromEntries(Object.entries(day.meals).map(([k, m]) => [k, m && { ...m }])) as PlanDay['meals'] }));
  const current = new Set<string>();
  eachMeal(previous, (m) => m.r && current.add(m.r));
  eachMeal(plan, (m) => m.ok && m.r && current.add(m.r));
  const taken = new Set<string>();
  for (const slot of SLOTS) {
    // Unapproved recipes in this slot, and the last day each is eaten.
    const lastDay: Record<string, number> = {};
    plan.forEach((day, i) => {
      const m = day.meals[slot];
      if (m?.r && !m.ok) lastDay[m.r] = i + 1;
    });
    Object.keys(lastDay).sort().forEach((id, k) => {
      const fits = MEAL_IDS.map((x) => R[x]).filter(
        (r) => r.slot === slot && !current.has(r.id) && !taken.has(r.id) && !avoided(r.id, ctx) && check(r, ctx.A).ok && storage(r, lastDay[id]).k !== 'unsafe',
      );
      const liked = fits.filter((r) => score(r, ctx) > 0);
      const pool = (liked.length ? liked : fits).sort((a, b) => score(b, ctx) - score(a, ctx) || a.id.localeCompare(b.id)).slice(0, 4);
      if (!pool.length) return;
      const pick = pool[(seed + k) % pool.length];
      taken.add(pick.id);
      for (const day of plan) {
        const m = day.meals[slot];
        if (m?.r === id && !m.ok) day.meals[slot] = { r: pick.id, ok: false };
      }
    });
  }
  if (ctx.A.balance === 'Yes, suggest sides') plan = plan.map((day, i) => balanceDay(day, i, ctx).day);
  let changed = 0;
  plan.forEach((day, i) => {
    for (const slot of SLOTS) if (day.meals[slot]?.r && day.meals[slot]?.r !== previous[i]?.meals[slot]?.r) changed++;
  });
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

/**
 * Portion size per recipe this week (1 = as written). Goals can make main-meal portions a little smaller or
 * bigger; cooking amounts and the grocery list follow it. Averaged over the recipe's meals; sides stay 1.
 */
export function portionSizes(plan: WeekPlan): Record<string, number> {
  const sum: Record<string, number> = {};
  const n: Record<string, number> = {};
  eachMeal(plan, (m) => {
    if (!m.r) return;
    sum[m.r] = (sum[m.r] ?? 0) + (m.x ?? 1);
    n[m.r] = (n[m.r] ?? 0) + 1;
  });
  return Object.fromEntries(Object.keys(sum).map((id) => [id, sum[id] / n[id]]));
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

/** Dishes and sides on this week's menu, not counting store-bought items: one count for every screen. */
export function menuCount(plan: WeekPlan): { dishes: number; sides: number } {
  const ids = Object.keys(portions(plan)).filter((id) => !R[id].store);
  const sides = ids.filter((id) => R[id].side).length;
  return { dishes: ids.length - sides, sides };
}

/** "11 dishes + 1 side" */
export function menuCountText(plan: WeekPlan): string {
  const { dishes, sides } = menuCount(plan);
  return `${dishes} dish${dishes === 1 ? '' : 'es'}${sides ? ` + ${sides} side${sides === 1 ? '' : 's'}` : ''}`;
}

/** Minutes of hands-on work for one batch. */
export const handsOnMinutes = (r: Recipe) => r.tasks.filter((t) => t.l === 'hands').reduce((s, t) => s + t.m, 0);

export type OptionOrder = 'match' | 'light' | 'protein' | 'quick';

/** Replacement options in the chosen order; "match" keeps Remy's own order (best fit first). Ties keep that order too. */
export function sortOptions(list: Recipe[], order: OptionOrder): Recipe[] {
  const key: Record<OptionOrder, (r: Recipe) => number> = { match: () => 0, light: (r) => r.kcal, protein: (r) => -r.pro, quick: handsOnMinutes };
  return list.map((r, i) => ({ r, i })).sort((a, b) => key[order](a.r) - key[order](b.r) || a.i - b.i).map((x) => x.r);
}

/** Whether every planned meal on a day is approved (nothing to approve counts as not done). */
export function dayApproved(day: PlanDay): boolean {
  const meals = Object.values(day.meals).filter((m) => m && (m.r || m.need));
  return meals.length > 0 && meals.every((m) => m!.ok);
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
export const replaceMeal = (plan: WeekPlan, d: number, slot: Slot, recipeId: string) => withMeal(plan, d, slot, () => mealWith(recipeId, slot));

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
  // Nothing for this meal keeps until this day: offer freezer-friendly mains from the other meal too.
  const partner = PARTNER[slot];
  if (partner && !out.allowed.some((r) => storage(r, d + 1).k !== 'unsafe')) {
    const extra = MEAL_IDS.map((id) => R[id]).filter((r) => r.slot === partner && r.id !== current && check(r, ctx.A).ok && storage(r, d + 1).k !== 'unsafe');
    out.allowed.push(...extra.sort((a, b) => score(b, ctx) - score(a, ctx)));
  }
  return out;
}

/** The best allowed, storage-safe alternative (“Pick for me”). */
/**
 * Repair a saved plan when it loads. Recipes deleted from the menu, or moved to another meal there, are taken out:
 * each meal that uses one gets the best allowed replacement (or needs a choice when nothing fits), and deleted
 * sides are dropped. Meals left empty ("needs a choice") are filled when something now fits, borrowing from the other
 * main meal if needed. Other meals are untouched.
 */
export function dropRemoved(plan: WeekPlan, ctx: PlanContext): { plan: WeekPlan; changed: number } {
  let next = plan;
  let changed = 0;
  plan.forEach((_day, d) => {
    for (const slot of SLOTS) {
      const m = next[d].meals[slot];
      if (m?.side && REMOVED.has(m.side)) {
        next = setSide(next, d, slot, null);
        changed++;
      }
      if (m?.r && (REMOVED.has(m.r) || !servesAt(R[m.r], slot, m))) {
        const id = autoReplacement(next, d, slot, ctx);
        next = withMeal(next, d, slot, () => (id ? mealWith(id, slot) : { r: null, need: true, ok: false }));
        changed++;
      } else if (m && !m.r && m.need) {
        const id = autoReplacement(next, d, slot, ctx);
        if (id) {
          next = withMeal(next, d, slot, () => mealWith(id, slot));
          changed++;
        }
      }
    }
  });
  return { plan: next, changed };
}

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
