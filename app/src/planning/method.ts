import { ING } from './data/ingredients';
import { R } from './data/recipes';
import { portions, portionSizes } from './planner';
import type { Schedule, ScheduledTask } from './schedule';
import type { Recipe, Task, WeekPlan } from './types';
import { quantityText } from './units';

/**
 * Cooking instructions with amounts, scaled to how much the week needs.
 * Pure: the prep screen, cook mode and recipe page all read from here.
 */

/** A piece of instruction text; amounts are marked so screens can show them in bold. */
export interface Part {
  t: string;
  amount?: boolean;
}

/** One recipe's share of a task: which recipe, how many batches this week, and the portion size (goals; 1 = as written). */
export interface Source {
  r: Recipe;
  batches: number;
  scale?: number;
}

/** Batches of each recipe this week (portions ÷ servings per batch, rounded up). */
export function batchesFor(plan: WeekPlan): Record<string, number> {
  const pc = portions(plan);
  return Object.fromEntries(Object.keys(pc).map((id) => [id, Math.max(1, Math.ceil(pc[id] / R[id].serves))]));
}

/** An ingredient’s name for use inside a sentence: "Marinara sauce (680 g jar)" → "marinara sauce". */
export function ingredientName(k: string, q: number): string {
  let n = ING[k].n.replace(/ \(.*\)$/, '');
  n = n.charAt(0).toLowerCase() + n.slice(1);
  // "1 egg", "1 banana"; counted things only.
  if (!ING[k].u && q <= 1 && n.endsWith('s') && !n.endsWith('ss')) n = n.slice(0, -1);
  return n;
}

/** Total amount of ingredient `k` across the sources (a shared task, like one pot of rice, adds them up). */
function total(k: string, sources: Source[]): number {
  return sources.reduce((s, { r, batches, scale }) => s + (r.ing.find(([key]) => key === k)?.[1] ?? 0) * batches * (scale ?? 1), 0);
}

const PLACEHOLDER = /\{(\w+)(?:\*([\d.]+))?(?::(\w+))?\}/g;

/** Ingredient keys a line refers to (for checking recipes). */
export const placeholders = (line: string): string[] => [...line.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((k) => k !== 'portions');

/** Fill in one instruction line. */
export function renderLine(line: string, sources: Source[]): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of line.matchAll(PLACEHOLDER)) {
    const [whole, k, factor, unit] = m;
    if (m.index! > last) parts.push({ t: line.slice(last, m.index) });
    const f = factor ? Number(factor) : 1;
    const q = total(k, sources) * f;
    // {portions} = portions made this week; {portions*2} = e.g. squares at two per portion.
    if (k === 'portions') parts.push({ t: String(Math.round(sources.reduce((s, x) => s + x.r.serves * x.batches, 0) * f)), amount: true });
    else if (!ING[k]) parts.push({ t: whole });
    else if (unit === 'q') parts.push({ t: quantityText(q, ING[k].u), amount: true });
    else if (unit) parts.push({ t: quantityText(q, unit), amount: true });
    else {
      parts.push({ t: quantityText(q, ING[k].u), amount: true });
      parts.push({ t: ` ${ingredientName(k, q)}` });
    }
    last = m.index! + whole.length;
  }
  if (last < line.length) parts.push({ t: line.slice(last) });
  return parts;
}

export const partsText = (parts: Part[]) => parts.map((p) => p.t).join('');

/** Steps for a task: its detailed lines, or just its name when it hasn’t been written out yet. */
export function taskLines(task: Task, sources: Source[]): Part[][] {
  return task.how?.length ? task.how.map((l) => renderLine(l, sources)) : [];
}

/** Ingredients of a recipe, scaled to `batches`. */
export function scaledIngredients(r: Recipe, batches: number, scale = 1): { k: string; amount: string; name: string }[] {
  return r.ing.map(([k, q]) => ({ k, amount: quantityText(q * batches * scale, ING[k].u), name: ingredientName(k, q * batches * scale) }));
}

/** Everything written out in detail? (Recipes are being rewritten a few at a time.) */
export const isDetailed = (r: Recipe) => r.tasks.length > 0 && r.tasks.every((t) => !!t.how?.length);

/* ---------- prep day ---------- */

/** One step of cook mode or the recipe-by-recipe view. */
export interface CookStep {
  /** Stable id, for ticking steps off. */
  id: string;
  title: string;
  lane: Task['l'];
  minutes: number;
  temp?: number;
  /** Recipes it’s for (short names). */
  for: string[];
  /** The same recipes, by id, with batches (empty for setting up and cleaning up). */
  sources: Source[];
  lines: Part[][];
  /** Minutes from the start of prep (timeline order only). */
  start?: number;
  /** A shared task already done for an earlier recipe (recipe-by-recipe view). */
  alreadyDone?: string;
}

/** The recipes cooked on prep day, with batches, in the order the schedule starts them. */
export function recipesToPrep(plan: WeekPlan, sc: Schedule): Source[] {
  const b = batchesFor(plan);
  const size = portionSizes(plan);
  const order: string[] = [];
  for (const t of sc.tasks) for (const s of t.refs) if (!order.includes(s.r.id)) order.push(s.r.id);
  return order.map((id) => ({ r: R[id], batches: b[id], scale: size[id] }));
}

/** Timeline order: every scheduled task, with its instructions. */
export function timelineSteps(sc: Schedule): CookStep[] {
  return sc.tasks.map((t: ScheduledTask) => ({
    id: t.id,
    title: t.t,
    lane: t.l,
    minutes: t.e - t.s,
    temp: t.temp,
    for: t.for,
    sources: t.refs.filter((x, i) => t.refs.findIndex((y) => y.r.id === x.r.id) === i).map(({ r, batches, scale }) => ({ r, batches, scale })),
    lines: t.refs.length ? taskLines(t.refs[0].task, t.refs) : [],
    start: t.s,
  }));
}

/** Recipe by recipe: each dish start to finish. A shared task appears once, where it’s first needed. */
export function recipeSteps(plan: WeekPlan, sc: Schedule): { r: Recipe; batches: number; steps: CookStep[] }[] {
  const byTask = new Map<Task, ScheduledTask>();
  for (const t of sc.tasks) for (const s of t.refs) byTask.set(s.task, t);
  const seen = new Map<string, string>();
  return recipesToPrep(plan, sc).map(({ r, batches, scale }) => ({
    r,
    batches,
    steps: r.tasks.map((task, i) => {
      const st = byTask.get(task);
      const id = st?.id ?? `${r.id}:${i}`;
      const step: CookStep = { id, title: task.t, lane: task.l, minutes: st ? st.e - st.s : task.m, temp: task.temp, for: st?.for ?? [r.short], sources: [{ r, batches, scale }], lines: taskLines(task, st?.refs ?? [{ r, batches, scale }]) };
      if (seen.has(id)) step.alreadyDone = seen.get(id);
      else seen.set(id, r.short);
      return step;
    }),
  }));
}

/** Things you pack into rather than cook with; the prep screen counts these separately. */
const SUPPLIES = new Set(['containers', 'freezer bag', 'foil', 'jars']);

/**
 * Equipment for the day, once each. "2 sheet pans" and "sheet pan" merge into "sheet pan ×2":
 * the most any one step needs at the same time.
 */
export function gearList(plan: WeekPlan, sc: Schedule): string[] {
  const most: Record<string, number> = {};
  const uses: Record<string, number> = {};
  for (const { r } of recipesToPrep(plan, sc))
    for (const t of r.tasks)
      for (const g of t.gear ?? []) {
        // "2 sheet pans" is a count; "20 cm square baking pan" is a size.
        const m = /^(\d+) (?!cm\b|mm\b)(.+)$/.exec(g);
        const n = m ? Number(m[1]) : 1;
        const name = m ? m[2].replace(/(?<=[^s])s$/, '') : g;
        if (SUPPLIES.has(name)) continue;
        most[name] = Math.max(most[name] ?? 0, n);
        uses[name] = (uses[name] ?? 0) + 1;
      }
  return Object.keys(most)
    .sort((a, b) => uses[b] - uses[a] || a.localeCompare(b))
    .map((name) => (most[name] > 1 ? `${name} ×${most[name]}` : name));
}
