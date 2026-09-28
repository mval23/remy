import type { Answers } from '../interview/types';
import { R } from './data/recipes';
import { eachMeal, portions, portionSizes } from './planner';
import { storage } from './rules';
import type { Lane, Recipe, Task, WeekPlan } from './types';

export interface ScheduledTask {
  /** Stable id: the shared key, or recipe id and task number. */
  id: string;
  t: string;
  l: Lane;
  /** Start and end, in minutes from the start of prep. */
  s: number;
  e: number;
  temp?: number;
  pans?: number;
  /** Recipes this task serves (short names). */
  for: string[];
  /** The recipe tasks behind it, with batches, for instructions and amounts. A shared task has several. */
  refs: { r: Recipe; batches: number; task: Task; scale?: number }[];
  /** The oven needs a new temperature for this task. */
  setTemp?: boolean;
}

export interface Schedule {
  tasks: ScheduledTask[];
  /** Minutes from start to the end of cleanup. */
  total: number;
  recipes: number;
}

/**
 * Lay out every prep task on a timeline.
 * Lanes: your hands (one thing at a time), stove (2 burners), oven (2 pans, one temperature at a time),
 * chill (fridge/freezer time, unlimited). Hands-on work fills the gaps while things cook.
 * Tasks that share a `key` (one pot of rice for two recipes) run once.
 * Packing tasks run after cooking.
 */
export function schedule(plan: WeekPlan, A: Answers): Schedule {
  const pc = portions(plan);
  const size = portionSizes(plan);
  const recipes = Object.keys(pc).map((id) => R[id]).filter((r) => r.tasks.length > 0);
  const passive = (r: Recipe) => r.tasks.filter((t) => t.l !== 'hands').reduce((s, t) => s + t.m, 0);
  const minTemp = (r: Recipe) => Math.min(999, ...r.tasks.filter((t) => t.temp).map((t) => t.temp as number));
  // Low oven temperatures first (you raise the oven, not lower it), then the longest background work.
  recipes.sort((a, b) => minTemp(a) - minTemp(b) || passive(b) - passive(a));

  const placed: ScheduledTask[] = [{ id: 'start', t: 'Set up the kitchen', l: 'hands', s: 0, e: 10, for: [], refs: [] }];
  const shared: Record<string, ScheduledTask> = {};

  const fits = (l: Lane, s: number, m: number, temp?: number, pans = 1) => {
    if (l === 'chill') return true;
    const e = s + m;
    const overlap = placed.filter((p) => p.l === l && p.s < e && p.e > s);
    if (l === 'oven') {
      if (overlap.some((p) => p.temp !== temp)) return false;
      return overlap.reduce((n, p) => n + (p.pans ?? 1), 0) + pans <= 2;
    }
    return overlap.length < (l === 'stove' ? 2 : 1);
  };

  const chainEnd: Record<string, number> = {};
  for (const packingPhase of [false, true]) {
    for (const r of recipes) {
      const batches = Math.ceil(pc[r.id] / r.serves);
      let ready = chainEnd[r.id] ?? 10;
      for (const [ti, t] of r.tasks.entries()) {
        if (!!t.end !== packingPhase) continue;
        if (t.key && shared[t.key]) {
          const o = shared[t.key];
          if (!o.for.includes(r.short)) o.for.push(r.short);
          o.refs.push({ r, batches, task: t, scale: size[r.id] });
          ready = Math.max(ready, o.e);
          continue;
        }
        const m = t.l === 'hands' && batches > 1 ? Math.round(t.m * (1 + 0.5 * (batches - 1))) : t.m;
        const starts = [ready, ...placed.filter((p) => p.l === t.l).map((p) => p.e)].filter((x) => x >= ready).sort((a, b) => a - b);
        const s = starts.find((c) => fits(t.l, c, m, t.temp, t.pans)) ?? Math.max(ready, ...placed.map((p) => p.e));
        const o: ScheduledTask = { id: t.key ? `key:${t.key}` : `${r.id}:${ti}`, t: t.t, l: t.l, s, e: s + m, temp: t.temp, pans: t.pans, for: [r.short], refs: [{ r, batches, task: t, scale: size[r.id] }] };
        placed.push(o);
        if (t.key) shared[t.key] = o;
        if (t.l !== 'chill') ready = o.e;
      }
      chainEnd[r.id] = ready;
    }
  }

  const lastWork = Math.max(...placed.filter((p) => p.l !== 'chill').map((p) => p.e));
  const cleanup = A.cleanup === 'As little as possible' ? 12 : 18;
  placed.push({ id: 'cleanup', t: 'Final cleanup: load the dishwasher, wipe down, take out trash', l: 'hands', s: lastWork, e: lastWork + cleanup, for: [], refs: [] });
  placed.sort((a, b) => a.s - b.s || (a.l === 'hands' ? -1 : 1));
  let lastTemp: number | undefined;
  for (const p of placed) {
    if (p.l !== 'oven') continue;
    if (p.temp !== lastTemp) p.setTemp = true;
    lastTemp = p.temp;
  }
  return { tasks: placed, total: lastWork + cleanup, recipes: recipes.length };
}

/** Clock time for a minute offset from a 1:00 PM start. */
export function clockTime(min: number, startHour = 13): string {
  const t = startHour * 60 + min;
  const h = Math.floor(t / 60) % 24;
  const m = t % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ') || '0 min';
}

const BAGGED = new Set(['pancakes', 'tenders', 'popcorn', 'bark', 'brownies', 'quesadilla', 'cookies', 'pretzels']);

/** Containers, bags and freezer portions, compared with what the user said they have. */
export function packingCounts(plan: WeekPlan, A: Answers) {
  const pc = portions(plan);
  let containers = 0, bags = 0, foil = 0, freezer = 0;
  for (const id of Object.keys(pc)) {
    const r = R[id];
    if (r.store || r.side) continue;
    if (id === 'burritos') foil += pc[id];
    else if (BAGGED.has(id)) bags += pc[id];
    else containers += pc[id];
  }
  eachMeal(plan, (m, _slot, i) => {
    if (m.r && !R[m.r].store && storage(R[m.r], i + 1).k === 'freezer') freezer++;
  });
  const containerCap = ({ 'Under 10': 9, '10–15': 15, '16–25': 25, '25+': 99 } as Record<string, number>)[String(A.containers)] ?? 99;
  const freezerCap = ({ Tiny: 6, 'Some space': 20, 'Lots of space': 99 } as Record<string, number>)[String(A.freezer)] ?? 99;
  return { containers, bags, foil, freezer, containerCap, freezerCap };
}

/** Where each prep-made dish goes, by day: fridge, freezer or pantry. */
export function packPlan(plan: WeekPlan) {
  const by: Record<string, { fridge: string[]; freezer: string[]; room: string[] }> = {};
  eachMeal(plan, (m, _slot, i, day) => {
    for (const id of [m.r, m.r ? m.side : undefined]) {
      if (!id) continue;
      const r = R[id];
      if (r.store || r.st) continue;
      const st = storage(r, i + 1);
      const o = (by[id] ??= { fridge: [], freezer: [], room: [] });
      (st.k === 'fridge' ? o.fridge : st.k === 'freezer' ? o.freezer : o.room).push(day.d);
    }
  });
  return by;
}
