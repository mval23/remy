import { str } from '../interview/helpers';
import type { Answers } from '../interview/types';
import type { ShopDays } from './calendar';
import { ING } from './data/ingredients';
import { MEAL_IDS, R } from './data/recipes';
import { avoided, check, KEEP_AT, score, storage, windowMinutes, type PlanContext } from './rules';
import { duration, packingCounts, schedule } from './schedule';
import type { Day, Meal, PlanDay, Recipe, Slot, Variety, WeekPlan } from './types';
import { DAY_FULL, DAYS, SLOTS } from './types';

/**
 * Week rules the planner keeps (audit, section 10), one small pure function each, with plain-language problems:
 * fresh food used while it keeps, freezer and container space, prep time within the person's window, and a mix of
 * proteins at lunch and dinner. `repairWeek` fixes what it can by swapping unapproved meals; whatever is left is
 * shown on the Menu settings sheet. Storage days, allergies and diets are already hard filters in `rules.ts`.
 */

export type Rule = 'fresh' | 'freezer' | 'containers' | 'prep' | 'protein';
export interface Problem {
  rule: Rule;
  text: string;
  /** Day index (0–6) and slot, when the problem is one meal. */
  day?: number;
  slot?: Slot;
  recipe?: string;
}

const each = (plan: WeekPlan, fn: (m: Meal, slot: Slot, i: number, day: PlanDay) => void) =>
  plan.forEach((day, i) => {
    for (const slot of SLOTS) {
      const m = day.meals[slot];
      if (m) fn(m, slot, i, day);
    }
  });
const dayName = (plan: WeekPlan, i: number) => DAY_FULL[plan[i].d];
const work = (r: Recipe) => r.tasks.filter((t) => t.l !== 'chill').reduce((s, t) => s + t.m, 0);

/* ---------- fresh food ---------- */

/**
 * Days from the fresh shop to the day each meal is eaten (index 0 = the first day after prep). With no fresh-shop
 * day set, Remy assumes the shopping happens on prep day.
 */
export function freshAges(A: Answers, shop?: ShopDays): number[] {
  const prep = DAYS.indexOf((str(A.prepday) || 'Sun') as Day);
  const gap = shop?.fresh ? (prep - DAYS.indexOf(shop.fresh) + 7) % 7 : 0;
  return Array.from({ length: 7 }, (_, i) => gap + i + 1);
}

/** The first fresh item of a recipe that won't keep until day `i`, with its age and shelf life. */
function staleItem(r: Recipe, age: number): { k: string; shelf: number } | null {
  for (const k of r.fresh ?? []) {
    const shelf = ING[k]?.shelf;
    if (shelf && age > shelf) return { k, shelf };
  }
  return null;
}

/** Why a recipe can't be eaten on day index `i` with this shopping, or null when its fresh items keep. */
export function staleReason(r: Recipe, i: number, ctx: PlanContext): string | null {
  const age = freshAges(ctx.A, ctx.shop)[i];
  const stale = staleItem(r, age);
  return stale ? `Its ${ING[stale.k].n.toLowerCase()} wouldn’t keep ${age} days from the shop` : null;
}

export function freshProblems(plan: WeekPlan, ctx: PlanContext): Problem[] {
  const ages = freshAges(ctx.A, ctx.shop);
  const out: Problem[] = [];
  each(plan, (m, slot, i) => {
    if (m.out || !m.r) return;
    for (const id of [m.r, m.side]) {
      if (!id) continue;
      const stale = staleItem(R[id], ages[i]);
      if (stale)
        out.push({ rule: 'fresh', day: i, slot, recipe: id, text: `${R[id].short} on ${dayName(plan, i)}: ${ING[stale.k].n.toLowerCase()} would be ${ages[i]} days from the shop and keep about ${stale.shelf}.` });
    }
  });
  return out;
}

/* ---------- space ---------- */

export function spaceProblems(plan: WeekPlan, A: Answers): Problem[] {
  const p = packingCounts(plan, A);
  const out: Problem[] = [];
  if (A.freezer !== undefined && p.freezer > p.freezerCap)
    out.push({ rule: 'freezer', text: `About ${p.freezer} portions go in the freezer, and you have room for about ${p.freezerCap}. A short mid-week cook, or eating out a late-week meal, would make room.` });
  if (A.containers !== undefined && p.containers > p.containerCap)
    out.push({ rule: 'containers', text: `About ${p.containers} containers are needed and you have about ${p.containerCap}. Freezer bags work for the rest.` });
  return out;
}

/* ---------- prep time ---------- */

export function prepProblems(plan: WeekPlan, A: Answers): Problem[] {
  const total = schedule(plan, A).total;
  const [, max] = windowMinutes(A);
  return total > max ? [{ rule: 'prep', text: `Prep day takes about ${duration(total)}, longer than your ${duration(max)}.` }] : [];
}

/* ---------- a mix of proteins ---------- */

const PROTEIN_GROUP: Record<string, string> = {
  chickenbreast: 'chicken', tenders: 'chicken', thighs: 'chicken', beef: 'beef', flank: 'beef', turkey: 'turkey', turkeysausage: 'turkey',
  chorizo: 'pork', bacon: 'pork', salmon: 'fish', tuna: 'fish', shrimp: 'shellfish', eggs: 'eggs', beanscan: 'beans', redbeans: 'beans', chickpeas: 'beans',
};

/** The protein a dish is built on: the group giving it the most protein (chicken, beef, fish, eggs, beans…). */
export function mainProtein(r: Recipe): string {
  const g: Record<string, number> = {};
  for (const [k, q] of r.ing) {
    const group = PROTEIN_GROUP[k];
    const i = ING[k];
    if (!group || !i) continue;
    g[group] = (g[group] ?? 0) + i.m.pro * (i.u === 'g' || i.u === 'ml' ? q / 100 : q);
  }
  return Object.entries(g).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
}

/**
 * The largest share of lunches and dinners one protein may have, by variety. None on Repeat favorites: repeating
 * what you love is the point. Swaps only ever bring in a dish liked at least as much (taste comes first).
 */
export const PROTEIN_SHARE: Record<Variety, number> = { favorites: 1, balanced: 0.7, variety: 0.6 };

function proteinShare(plan: WeekPlan): { group: string; share: number; total: number } {
  const c: Record<string, number> = {};
  let total = 0;
  each(plan, (m, slot) => {
    if (m.out || !m.r || (slot !== 'Lunch' && slot !== 'Dinner')) return;
    const g = mainProtein(R[m.r]);
    c[g] = (c[g] ?? 0) + 1;
    total++;
  });
  const [group, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0] ?? ['other', 0];
  return { group, share: total ? n / total : 0, total };
}

export function proteinProblems(plan: WeekPlan, variety: Variety): Problem[] {
  const { group, share, total } = proteinShare(plan);
  const limit = PROTEIN_SHARE[variety];
  if (total < 6 || share <= limit + 1e-9) return [];
  return [{ rule: 'protein', text: `${Math.round(share * 100)}% of lunches and dinners are built on ${group}; Remy aims for at most ${Math.round(limit * 100)}% for a mix.` }];
}

/** Every week rule, in the order they matter. */
export function weekProblems(plan: WeekPlan, ctx: PlanContext, variety: Variety): Problem[] {
  return [...freshProblems(plan, ctx), ...spaceProblems(plan, ctx.A), ...prepProblems(plan, ctx.A), ...proteinProblems(plan, variety)];
}

/* ---------- repairs ---------- */

/** Recipes that could take a meal's place on day index `i`: allowed, safe that day, liked, not left out after feedback. */
function options(slot: Slot, i: number, ctx: PlanContext, ok: (r: Recipe) => boolean): Recipe[] {
  return MEAL_IDS.map((id) => R[id]).filter((r) => r.slot === slot && check(r, ctx.A).ok && storage(r, i + 1).k !== 'unsafe' && !avoided(r.id, ctx) && score(r, ctx) > 0 && ok(r));
}

const inPlan = (plan: WeekPlan) => {
  const s = new Set<string>();
  each(plan, (m) => m.r && s.add(m.r));
  return s;
};
const count = (plan: WeekPlan, id: string) => {
  let n = 0;
  each(plan, (m) => m.r === id && n++);
  return n;
};
/** Recipes already on the menu first (no extra prep), then the best liked; never past `maxPerWeek`. */
const pick = (plan: WeekPlan, ctx: PlanContext, list: Recipe[], uses = 1) => {
  const on = inPlan(plan);
  return list
    .filter((r) => r.maxPerWeek === undefined || count(plan, r.id) + uses <= r.maxPerWeek)
    .sort((a, b) => score(b, ctx) + (on.has(b.id) ? 3 : 0) - (score(a, ctx) + (on.has(a.id) ? 3 : 0)) || a.id.localeCompare(b.id))[0];
};

/** Put `to` in place of `from` on every unapproved meal of the week (or only day `only`). Sides are dropped; balancing adds them again. */
function swapIn(plan: WeekPlan, slot: Slot, from: string, to: string, only?: number): WeekPlan {
  return plan.map((d, i) => {
    const m = d.meals[slot];
    if (!m || m.r !== from || m.ok || (only !== undefined && i !== only)) return d;
    return { ...d, meals: { ...d.meals, [slot]: { r: to, ok: false } } };
  });
}

/** Days (index) a recipe is planned at a slot, unapproved. */
const daysOf = (plan: WeekPlan, slot: Slot, id: string) => plan.flatMap((d, i) => (d.meals[slot]?.r === id && !d.meals[slot]?.ok ? [i] : []));

/**
 * Fix the week rules where it can, with deterministic swaps of unapproved meals, and say what changed.
 * Sweets are never swapped. Returns the new week and one line per change.
 */
export function repairWeek(input: WeekPlan, ctx: PlanContext, variety: Variety): { plan: WeekPlan; fixes: string[] } {
  let plan = input;
  const fixes: string[] = [];
  const ages = freshAges(ctx.A, ctx.shop);

  // 1. Fresh food: that day's meal becomes one whose fresh items still keep.
  for (const p of freshProblems(plan, ctx)) {
    const m = plan[p.day!].meals[p.slot!];
    if (!m || m.ok || m.r !== p.recipe || p.slot === 'Evening sweet') continue;
    const to = pick(plan, ctx, options(p.slot!, p.day!, ctx, (r) => r.id !== p.recipe && !staleItem(r, ages[p.day!])));
    if (!to) continue;
    plan = swapIn(plan, p.slot!, p.recipe!, to.id, p.day);
    fixes.push(`${dayName(plan, p.day!)}: ${to.short} instead of ${R[p.recipe!].short}, since its fresh ingredients wouldn’t keep until then`);
  }

  // 2. Freezer space: late-week meals that live in the freezer become ones that keep in the fridge or pantry.
  for (let n = 0; n < 10; n++) {
    const p = packingCounts(plan, ctx.A);
    if (ctx.A.freezer === undefined || p.freezer <= p.freezerCap) break;
    let done = false;
    for (let i = plan.length - 1; i >= 0 && !done; i--) {
      for (const slot of SLOTS) {
        const m = plan[i].meals[slot];
        if (slot === 'Evening sweet' || !m?.r || m.ok || R[m.r].store || storage(R[m.r], i + 1).k !== 'freezer') continue;
        const to = pick(plan, ctx, options(slot, i, ctx, (r) => storage(r, i + 1).k !== 'freezer' && !staleItem(r, ages[i])));
        if (!to) continue;
        fixes.push(`${dayName(plan, i)}: ${to.short} instead of ${R[m.r].short}, to save freezer space`);
        plan = swapIn(plan, slot, m.r, to.id, i);
        done = true;
        break;
      }
    }
    if (!done) break;
  }

  // 3. Prep time: the dish with the most work becomes a quicker one, on all its days.
  const [, max] = windowMinutes(ctx.A);
  for (let n = 0; n < 5 && schedule(plan, ctx.A).total > max; n++) {
    const candidates = [...inPlan(plan)]
      .filter((id) => R[id].slot !== 'Evening sweet' && R[id].slot !== 'Side')
      .sort((a, b) => work(R[b]) - work(R[a]));
    let done = false;
    for (const id of candidates) {
      const slot = R[id].slot as Slot;
      const days = daysOf(plan, slot, id);
      if (!days.length || days.length < count(plan, id)) continue;
      const to = pick(plan, ctx, options(slot, Math.max(...days), ctx, (r) => r.id !== id && work(r) < work(R[id]) && days.every((i) => storage(r, i + 1).k !== 'unsafe' && !staleItem(r, ages[i]))), days.length);
      if (!to) continue;
      plan = swapIn(plan, slot, id, to.id);
      fixes.push(`${to.short} instead of ${R[id].short}, to keep prep day within your window`);
      done = true;
      break;
    }
    if (!done) break;
  }

  // 4. A mix of proteins: the least-liked dish of the main protein becomes a liked dish built on another.
  for (let n = 0; n < 4; n++) {
    const { group, share, total } = proteinShare(plan);
    if (total < 6 || share <= PROTEIN_SHARE[variety] + 1e-9) break;
    const ids = [...inPlan(plan)]
      .filter((id) => (R[id].slot === 'Lunch' || R[id].slot === 'Dinner') && mainProtein(R[id]) === group && (ctx.adj[id] ?? 0) < KEEP_AT)
      .sort((a, b) => score(R[a], ctx) - score(R[b], ctx) || a.localeCompare(b));
    let done = false;
    for (const id of ids) {
      const slot = R[id].slot as Slot;
      const days = daysOf(plan, slot, id);
      if (!days.length || days.length < count(plan, id)) continue;
      const to = pick(plan, ctx, options(slot, Math.max(...days), ctx, (r) => mainProtein(r) !== group && score(r, ctx) >= score(R[id], ctx) && work(r) <= work(R[id]) + 5 && days.every((i) => storage(r, i + 1).k !== 'unsafe' && !staleItem(r, ages[i]))), days.length);
      if (!to) continue;
      plan = swapIn(plan, slot, id, to.id);
      fixes.push(`${to.short} instead of ${R[id].short}, for a mix of proteins`);
      done = true;
      break;
    }
    if (!done) break;
  }
  return { plan, fixes };
}
