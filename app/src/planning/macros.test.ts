import { describe, expect, it } from 'vitest';
import { ING } from './data/ingredients';
import { MEAL_IDS, R, SIDE_IDS } from './data/recipes';
import { macrosOf } from './macros';

describe('calories and macros', () => {
  it('has rough protein, carbs and fat for every ingredient', () => {
    for (const [k, g] of Object.entries(ING)) {
      expect(g.m, k).toHaveLength(3);
      for (const x of g.m!) expect(x, k).toBeGreaterThanOrEqual(0);
    }
  });

  it('adds them up per portion, with calories from 4/4/9 per gram', () => {
    const m = macrosOf([['eggs', 2], ['butter', 10]], 1);
    expect(m.pro).toBe(13);
    expect(m.fat).toBe(18);
    for (const id of [...MEAL_IDS, ...SIDE_IDS]) {
      const r = R[id];
      expect(Math.abs(r.kcal - (4 * (r.pro + r.carb) + 9 * r.fat)), id).toBeLessThanOrEqual(15);
    }
  });

  it('keeps every meal and side in a believable range', () => {
    for (const id of MEAL_IDS) {
      const r = R[id];
      const [lo, hi] = r.slot === 'Lunch' || r.slot === 'Dinner' ? [250, 950] : r.slot === 'Breakfast' ? [150, 650] : [80, 450];
      expect(r.kcal, id).toBeGreaterThanOrEqual(lo);
      expect(r.kcal, id).toBeLessThanOrEqual(hi);
    }
    for (const id of SIDE_IDS) expect(R[id].kcal, id).toBeLessThanOrEqual(250);
  });
});
