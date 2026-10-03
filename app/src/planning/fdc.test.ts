import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ING } from './data/ingredients';
import { MEAL_IDS, R, SIDE_IDS } from './data/recipes';
import { emptyPlanState, normalizePlanState } from '../storage/planState';
import { NUTRITION_DATA } from './data/version';
import { nutritionSource } from './macros';
import type { Nutrients } from './types';

/** The reviewed FoodData Central values, per 100 g (scripts/fdc-values.json, written by `fdc-match.mjs fetch`). */
const FDC: Record<string, { id: string; per100: Partial<Nutrients> }> = JSON.parse(readFileSync(new URL('../../scripts/fdc-values.json', import.meta.url), 'utf8'));

/**
 * Ingredients still on Remy's estimate, and why. Adding an ingredient without a source fails the test below,
 * so each new one gets a FoodData Central match or a package label, or is listed here.
 */
const ESTIMATED: Record<string, string> = {
  icecream: 'package label',
  berries: 'package label: FoodData Central has no mixed-berry blend',
  pizzadough: 'package label',
  obleas: 'package label',
  arequipe: 'package label',
  mascarpone: 'package label: not in FoodData Central',
  arepaflour: 'package label: FoodData Central only has masa, which is made differently',
  turkeysausage: 'package label: FoodData Central only has raw links',
  limes: 'only the juice is counted',
  lemons: 'only the juice is counted',
  spices: 'a pinch, counted as nothing',
};

/** Remy's values per 100 g: g and ml as stored, counted items through grams per unit. */
function per100(k: string): Nutrients {
  const g = ING[k];
  const f = g.u === 'g' || g.u === 'ml' ? 1 : 100 / (g.gpu ?? 100);
  return { pro: g.m.pro * f, carb: g.m.carb * f, fat: g.m.fat * f, fiber: g.m.fiber * f };
}

/** How many library meals and sides use each ingredient. */
function usage(): [string, number][] {
  const n: Record<string, number> = {};
  for (const id of [...MEAL_IDS, ...SIDE_IDS]) for (const [k] of R[id].ing) n[k] = (n[k] ?? 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1]);
}

describe('nutrition data version', () => {
  it('marks weeks planned before versions existed, so Nutrition can say the numbers changed', () => {
    const fresh = normalizePlanState(emptyPlanState());
    expect(fresh.nutritionData).toBe(NUTRITION_DATA);
    const { nutritionData: _v, ...old } = { ...emptyPlanState(), plan: [] };
    expect(normalizePlanState(old).nutritionData).toBe('');
    expect(normalizePlanState({ ...old, nutritionData: 'older' }).nutritionData).toBe('older');
  });
});

describe('nutrition data sources', () => {
  it('gives every ingredient fiber and a source, or a reason it is still an estimate', () => {
    for (const [k, g] of Object.entries(ING)) {
      expect(typeof g.m.fiber, k).toBe('number');
      if (g.src) expect(g.src.version, k).toMatch(/^(FDC|label) /);
      else expect(ESTIMATED[k], `${k} has no source`).toBeTruthy();
    }
  });

  it('calls a dish matched when only a squeeze or a pinch has no source', () => {
    // Lime juice is a few calories of a bowl; arepa flour is most of an arepa.
    const limeDish = [...MEAL_IDS].find((id) => R[id].ing.some(([k]) => k === 'limes') && R[id].ing.every(([k]) => k === 'limes' || ING[k].src));
    expect(limeDish).toBeTruthy();
    expect(nutritionSource(R[limeDish!].ing)).toBe('matched');
    expect(nutritionSource(R.arepas.ing)).toBe('estimated');
  });

  it('keeps the 30 most-used ingredients within 10% of FoodData Central (or 0.5 g for small amounts)', () => {
    const top = usage()
      .map(([k]) => k)
      .filter((k) => !ESTIMATED[k])
      .slice(0, 30);
    expect(top).toHaveLength(30);
    for (const k of top) {
      const fdc = FDC[k];
      expect(fdc, `${k} has no reviewed FDC values`).toBeTruthy();
      expect(ING[k].src?.id, k).toBe(fdc.id);
      const mine = per100(k);
      for (const n of ['pro', 'carb', 'fat', 'fiber'] as const) {
        const want = fdc.per100[n];
        if (want === undefined) continue;
        expect(Math.abs(mine[n] - want), `${k} ${n}: ${mine[n].toFixed(1)} vs ${want}`).toBeLessThanOrEqual(Math.max(0.5, 0.1 * want));
      }
    }
  });
});
