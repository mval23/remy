import { describe, expect, it } from 'vitest';
import { ING } from './data/ingredients';
import { MEAL_IDS, R, SIDE_IDS } from './data/recipes';
import { kcalOf, macrosOf } from './macros';

describe('calories and macros', () => {
  it('has protein, carbs, fat and fiber for every ingredient, and grams per unit for anything counted', () => {
    for (const [k, g] of Object.entries(ING)) {
      for (const x of [g.m.pro, g.m.carb, g.m.fat, g.m.fiber]) expect(x, k).toBeGreaterThanOrEqual(0);
      // Fiber is part of total carbohydrate.
      expect(g.m.fiber, k).toBeLessThanOrEqual(g.m.carb);
      if (g.u !== 'g' && g.u !== 'ml' && k !== 'spices') expect(g.gpu, k).toBeGreaterThan(0);
    }
  });

  it('adds them up per portion: 4 kcal per gram of protein and digestible carbs, 2 per gram of fiber, 9 per gram of fat', () => {
    const m = macrosOf([['eggs', 2], ['butter', 10]], 1);
    // Two large eggs (FDC 748967) and 10 g of butter.
    expect(m.pro).toBe(12);
    expect(m.fat).toBe(18);
    expect(kcalOf(10, 30, 10, 10)).toBe(4 * 10 + 4 * 20 + 2 * 10 + 9 * 10);
    expect(macrosOf([['oats', 100]], 1).fiber).toBe(10.1);
    for (const id of [...MEAL_IDS, ...SIDE_IDS]) {
      const r = R[id];
      expect(Math.abs(r.kcal - kcalOf(r.pro, r.carb, r.fat, r.fiber)), id).toBeLessThanOrEqual(15);
    }
  });

  it('keeps every meal and side in a believable range', () => {
    for (const id of MEAL_IDS) {
      const r = R[id];
      // A snack that is just fruit (every ingredient from Produce) can be as light as a cup of strawberries.
      const fruitOnly = r.ing.every(([k]) => ING[k].sec === 'Produce');
      const [lo, hi] = r.slot === 'Lunch' || r.slot === 'Dinner' ? [230, 950] : r.slot === 'Breakfast' ? [150, 650] : [fruitOnly ? 40 : 80, 450];
      expect(r.kcal, id).toBeGreaterThanOrEqual(lo);
      expect(r.kcal, id).toBeLessThanOrEqual(hi);
    }
    for (const id of SIDE_IDS) expect(R[id].kcal, id).toBeLessThanOrEqual(250);
  });
});
