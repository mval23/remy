import type { Recipe } from './types';

/**
 * Remy measures in metric: grams, millilitres and °C. Small spoon amounts stay in tbsp (15 ml) and tsp (5 ml),
 * and some things are counted (eggs, tortillas, heads of broccoli).
 */

/**
 * Earlier versions stored amounts in US units. Multiply an old amount by this to get the current (metric) unit.
 * Only ingredients whose unit changed are listed. Used to convert saved AI recipes (see `migrateRecipe`).
 */
export const US_TO_METRIC: Record<string, number> = {
  thighs: 454, tenders: 454, beef: 454, turkey: 454, shrimp: 454, salmon: 454, flank: 454,
  spinach: 30, potatoes: 454, grapes: 454, berries: 140, corn: 150, greenbeans: 120,
  milk: 240, yogurt: 245, cheddar: 113, cheeseblock: 28.35, parmesan: 90, creamcheese: 28.35, butter: 14,
  spaghetti: 454, pasta: 454, rice: 185, oats: 90, panko: 60, chips: 170, popcorn: 200,
  flour: 125, sugar: 200, cocoa: 5, teriyaki: 240, salsa: 250, bbq: 240, honeymustard: 240, pb: 16,
};

const F_TO_C: Record<number, number> = { 325: 160, 320: 160, 350: 180, 375: 190, 400: 200, 425: 220, 450: 230 };
export const fahrenheitToCelsius = (f: number) => F_TO_C[f] ?? Math.round(((f - 32) * 5) / 9 / 5) * 5;

/** Round a metric amount to what a kitchen scale or jug is read to. */
export function roundMetric(q: number): number {
  if (q < 10) return Math.max(1, Math.round(q));
  if (q < 100) return Math.round(q / 5) * 5;
  return Math.round(q / 10) * 10;
}

/** Convert an AI recipe saved in US units. Library recipes are already metric. */
export function migrateRecipe(r: Recipe): Recipe {
  return {
    ...r,
    ing: r.ing.map(([k, q]) => [k, US_TO_METRIC[k] ? roundMetric(q * US_TO_METRIC[k]) : q]),
    tasks: r.tasks.map((t) => (t.temp && t.temp > 260 ? { ...t, temp: fahrenheitToCelsius(t.temp) } : t)),
  };
}

/** 1.5 → "1½", 0.333 → "⅓" */
export function fraction(q: number): string {
  const whole = Math.floor(q + 1e-9);
  const f = q - whole;
  const marks: [number, string][] = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.667, '⅔'], [0.75, '¾'], [1, '']];
  let best = marks[0];
  for (const m of marks) if (Math.abs(f - m[0]) < Math.abs(f - best[0])) best = m;
  const w = best[0] === 1 ? whole + 1 : whole;
  return (w ? String(w) : '') + best[1] || '0';
}

const PLURAL: Record<string, string> = { head: 'heads', box: 'boxes', bag: 'bags', jar: 'jars', can: 'cans', clove: 'cloves', sleeve: 'sleeves' };

/** An amount in its unit, e.g. "570 g", "1.2 kg", "750 ml", "1½ tbsp", "3 cloves", "2". */
export function quantityText(q: number, u: string): string {
  if (u === 'g' || u === 'ml') {
    const n = roundMetric(q);
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')} ${u === 'g' ? 'kg' : 'L'}`;
    return `${n} ${u}`;
  }
  const n = fraction(q);
  if (!u) return n;
  return `${n} ${(q > 1.01 && PLURAL[u]) || u}`;
}
