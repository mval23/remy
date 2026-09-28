import { allRatings, arr, asPreparations, has, real, str } from '../interview/helpers';
import { ALLERGY_OPTS, FOODS } from '../interview/questions';
import type { Answers } from '../interview/types';
import { ING } from './data/ingredients';
import type { Day, Recipe, Slot, StorageInfo, Variety } from './types';
import { DAYS, SLOTS } from './types';

/** What the rules need to know about the person. */
export interface PlanContext {
  /** Active interview answers (see `activeAnswers`). */
  A: Answers;
  /** Score adjustments from rejections, by recipe id. */
  adj: Record<string, number>;
  /** User reported being often hungry: raise protein thresholds. */
  hungry: boolean;
  /** Meal recipes from last week, so a new week can rotate in something different. */
  recent: string[];
}

export const context = (A: Answers, adj: Record<string, number> = {}, hungry = false, recent: string[] = []): PlanContext => ({ A, adj, hungry, recent });

/** Score adjustment at or below which a recipe is left out of new plans (“Not again”, or rejected twice with a reason). */
export const AVOID_AT = -4;
export const avoided = (id: string, ctx: PlanContext) => (ctx.adj[id] ?? 0) <= AVOID_AT;
/** Score adjustment at or above which a recipe stays in rotation week after week (“Loved”). */
export const KEEP_AT = 2;

/* ---------- hard restrictions ---------- */

const ALLERGY_TAG: Record<string, string> = {
  Peanuts: 'peanut', 'Tree nuts': 'treenut', 'Milk / dairy': 'dairy', Eggs: 'egg', 'Wheat / gluten': 'gluten',
  Soy: 'soy', Fish: 'fish', Shellfish: 'shellfish', Sesame: 'sesame',
};
const DIET_TAGS: Record<string, string[]> = {
  Vegetarian: ['meat', 'fish', 'shellfish'], Vegan: ['meat', 'fish', 'shellfish', 'dairy', 'egg', 'honey'], Pescatarian: ['meat'],
  'No pork': ['pork'], 'No red meat': ['beef'], Halal: ['pork'], Kosher: ['pork', 'shellfish'],
};
const INTOLERANCE_TAGS: Record<string, string[]> = { Lactose: ['dairy'], Gluten: ['gluten'], 'Beans and lentils': ['beans'] };
export const TAG_LABEL: Record<string, string> = {
  peanut: 'peanuts', treenut: 'tree nuts', dairy: 'dairy', egg: 'eggs', gluten: 'wheat / gluten', soy: 'soy', fish: 'fish',
  shellfish: 'shellfish', sesame: 'sesame', meat: 'meat', beef: 'red meat', pork: 'pork', honey: 'honey', beans: 'beans',
};

/** Allergen and diet tags that must never appear. Typed-in allergies become `custom:<text>`. */
export function hardTags(A: Answers): Set<string> {
  const t = new Set<string>();
  for (const v of real(A.allergies)) t.add(ALLERGY_OPTS.includes(v) ? ALLERGY_TAG[v] : 'custom:' + v.toLowerCase());
  for (const d of arr(A.diet)) for (const x of DIET_TAGS[d] ?? []) t.add(x);
  for (const d of arr(A.intolerances)) for (const x of INTOLERANCE_TAGS[d] ?? []) t.add(x);
  return t;
}

function isAllergyTag(A: Answers, tag: string): boolean {
  return real(A.allergies).some((v) => (ALLERGY_OPTS.includes(v) ? ALLERGY_TAG[v] === tag : 'custom:' + v.toLowerCase() === tag));
}

export type CheckResult =
  | { ok: true }
  | { ok: false; blocked: true; allergy: boolean; reason: string }
  | { ok: false; hidden: true; reason: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Is this recipe allowed for this person?
 * Blocked = safety (allergy, diet, intolerance); never overridden.
 * Hidden = preference (dislike, never-list, wrong preparation, off-putting smell).
 */
export function check(r: Recipe, A: Answers): CheckResult {
  const tags = hardTags(A);
  for (const [k] of r.ing) {
    const g = ING[k];
    const name = g.n.toLowerCase();
    for (const t of g.alg ?? []) if (tags.has(t)) return { ok: false, blocked: true, allergy: isAllergyTag(A, t), reason: `Contains ${name} (${TAG_LABEL[t] ?? t})` };
    for (const t of tags) if (t.startsWith('custom:') && name.includes(t.slice(7))) return { ok: false, blocked: true, allergy: true, reason: `Contains ${name}` };
  }
  const rat = allRatings(A);
  const ways = asPreparations(A.ways);
  for (const f of Object.keys(r.foods)) {
    if (rat[f] === 'never') return { ok: false, hidden: true, reason: `${FOODS[f].n} is on your Never list` };
    if (rat[f] === 'dislike') return { ok: false, hidden: true, reason: `You rated ${FOODS[f].n.toLowerCase()} Dislike` };
    const way = r.foods[f];
    if (rat[f] === 'ways' && typeof way === 'string') {
      const accepted = ways[f] ?? [];
      if (accepted.length && !accepted.includes(way)) return { ok: false, hidden: true, reason: `${FOODS[f].n} only works ${accepted.join(' or ').toLowerCase()} for you` };
    }
  }
  // Never-list words match whole words, allow plurals, and don't match "olive oil" for "olives".
  const never = arr(A.never).map((x) => x.toLowerCase().trim().replace(/(es|s)$/, '')).filter(Boolean);
  for (const [k] of r.ing) {
    const name = ING[k].n.toLowerCase();
    for (const n of never) if (new RegExp(`\\b${escapeRe(n)}(e|es|s)?\\b(?! oil)`).test(name)) return { ok: false, hidden: true, reason: `${ING[k].n} is on your never list` };
  }
  if (has(A.smells, 'Fish') && r.ing.some(([k]) => k === 'salmon')) return { ok: false, hidden: true, reason: 'You said fish smells put you off' };
  return { ok: true };
}

export const allowed = (r: Recipe, A: Answers) => check(r, A).ok;

/* ---------- preference scoring ---------- */

const LEVEL_POINTS: Record<string, number> = { love: 3, like: 2, okay: 1, ways: 1.5 };

export function score(r: Recipe, ctx: PlanContext): number {
  const { A } = ctx;
  const rat = allRatings(A);
  let s = 0;
  for (const f of Object.keys(r.foods)) s += LEVEL_POINTS[rat[f]] ?? 0;
  for (const x of r.sauces ?? []) if (has(A.sauces, x)) s += 1.5;
  for (const x of r.sweet ?? []) if (has(A.sweets, x)) s += 2;
  if (A.satisfy === 'Something chocolatey' && r.sweet?.includes('Chocolate')) s += 1.5;
  if (A.satisfy === 'Something cold and creamy' && r.sweet?.includes('Ice cream')) s += 1.5;
  if (r.cold && r.slot !== 'Afternoon snack' && A.temps && !has(A.temps, 'Cold breakfasts') && !has(A.temps, 'Cold lunches')) s -= 3;
  return s + (ctx.adj[r.id] ?? 0);
}

/** Plain-language reasons a recipe fits, e.g. "Chicken (love it)". */
export function matches(r: Recipe, A: Answers): string[] {
  const rat = allRatings(A);
  const names: Record<string, string> = { love: 'love it', like: 'like it' };
  const out: string[] = [];
  for (const f of Object.keys(r.foods)) {
    if (rat[f] === 'love' || rat[f] === 'like') out.push(`${FOODS[f].n} (${names[rat[f]]})`);
    else if (rat[f] === 'ways') out.push(`${FOODS[f].n.toLowerCase()} ${String(r.foods[f]).toLowerCase()}`);
  }
  for (const x of r.sauces ?? []) if (has(A.sauces, x)) out.push(`${x} sauce`);
  for (const x of r.sweet ?? []) if (has(A.sweets, x)) out.push(x.toLowerCase());
  return out;
}

/* ---------- storage safety ---------- */

/**
 * Where a portion eaten `day` days after prep should live.
 * Cooked food stays in the fridge only up to its limit; after that it must be frozen, or it's unsafe.
 */
export function storage(r: Recipe | undefined, day: number): StorageInfo {
  if (!r) return { k: 'none', l: '' };
  if (r.st) return r.st;
  if (r.store) return { k: 'freezer', l: 'Store-bought · freezer' };
  if (r.room) return { k: 'room', l: 'Pantry' };
  if (r.fridge >= day) return { k: 'fridge', l: `Fridge · day ${day}` };
  if (r.freezer > 0) return { k: 'freezer', l: 'Freezer', thaw: r.thaw };
  return { k: 'unsafe', l: 'Past safe fridge time' };
}

/* ---------- week shape from the profile ---------- */

/** The 7 days after prep day, in order. */
export function weekDays(A: Answers): Day[] {
  const prep = DAYS.indexOf((str(A.prepday) || 'Sun') as Day);
  return Array.from({ length: 7 }, (_, i) => DAYS[(prep + 1 + i) % 7]);
}

/** Meal slots that come from prep day. */
export function activeSlots(A: Answers): Slot[] {
  const fromPrep = real(A.fromprep);
  if (fromPrep.length) return SLOTS.filter((s) => fromPrep.includes(s));
  const schedule = real(A.schedule);
  return schedule.length ? SLOTS.filter((s) => schedule.includes(s)) : [...SLOTS];
}

export function isAway(A: Answers, day: Day, slot: Slot): boolean {
  const away = arr(A.away);
  if (slot === 'Dinner') return (day === 'Fri' && away.includes('Friday dinner')) || (day === 'Sat' && away.includes('Saturday dinner'));
  if (slot === 'Breakfast') return (day === 'Sat' || day === 'Sun') && away.includes('Weekend brunch');
  return false;
}

/** Day indexes (0–6) that get an evening sweet, from how often the user wants one. */
export function sweetDays(A: Answers): number[] {
  const map: Record<string, number[]> = {
    'Every day': [0, 1, 2, 3, 4, 5, 6],
    'Most days': [0, 1, 2, 4, 5, 6],
    'A few times a week': [1, 3, 5],
    'Now and then': [2, 5],
  };
  return map[str(A.sweetfreq)] ?? map['Every day'];
}

export function defaultVariety(A: Answers): Variety {
  const repeats = str(A.repeats);
  let v: Variety = 'balanced';
  if (repeats.includes('4')) v = 'favorites';
  if (repeats.includes('different') || repeats === 'Twice at most') v = 'variety';
  if (A.preptime === '1–2 hours') v = 'favorites';
  return v;
}

/** Prep time window in minutes [min, max]. */
export function windowMinutes(A: Answers): [number, number] {
  const map: Record<string, [number, number]> = { '1–2 hours': [60, 120], '2–3 hours': [120, 180], '3–4 hours': [180, 240], '4+ hours': [240, 330] };
  return map[str(A.preptime)] ?? [180, 240];
}
