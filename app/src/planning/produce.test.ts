import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { MEAL_IDS, R } from './data/recipes';
import { plateText, portionGrams, produceOf } from './macros';
import { balanceDay, dayNutrition, FIBER_OK, FIBER_TARGET } from './nutrition';
import { context } from './rules';
import type { PlanDay } from './types';

const SAMPLE = activeAnswers(fillWithSamples(emptyInterview()));

describe('produce servings from the ingredients', () => {
  it('counts 80 g of fruit or vegetables as a serving, to the nearest quarter', () => {
    expect(produceOf([['strawberries', 160]], 1)).toBe(2);
    expect(produceOf([['broccoli', 1]], 4)).toBe(1.25);
    expect(produceOf([['carrots', 2], ['spinach', 60]], 2)).toBe(1.25);
  });

  it('leaves out potatoes and other starchy staples, and counts beans and tomato sauce', () => {
    expect(produceOf([['potatoes', 400], ['yuca', 200], ['plantains', 2]], 1)).toBe(0);
    expect(produceOf([['beanscan', 1]], 3)).toBe(1);
    expect(produceOf([['crushedtomatoes', 1]], 10)).toBe(1);
  });

  it('gives every library recipe its produce from the ingredients', () => {
    expect(R.fruit_mango.prod).toBe(2.5);
    expect(R.eggbites.prod).toBe(0);
    for (const id of MEAL_IDS) expect(R[id].prod, id).toBe(produceOf(R[id].ing, R[id].serves));
  });
});

describe('portion weight', () => {
  it('counts cooked grains, and the broth they soak up only once', () => {
    expect(portionGrams([['rice', 100]], 1)).toBe(300);
    expect(portionGrams([['rice', 100], ['chickenbroth', 150]], 1)).toBe(300);
    expect(portionGrams([['chickenbreast', 400]], 2)).toBe(150);
    expect(portionGrams([['rice', 100]], 1, 280)).toBe(280);
  });

  it('puts the computed weight into portion texts, so they can’t drift from the recipe', () => {
    expect(plateText({ plate: 'About {grams} g.', grams: 412 })).toBe('About 410 g.');
    for (const r of Object.values(R)) {
      // A whole-portion weight ("About 350 g."), as opposed to a part of it ("About 150 g cooked pasta").
      expect(r.plate, r.id).not.toMatch(/^About \d+ (g|ml)[.,:]/);
      expect(r.plate, r.id).not.toMatch(/bowl, about \d+ ml/);
      if (r.plate.includes('{grams}')) {
        expect(r.grams, r.id).toBeGreaterThan(150);
        expect(r.grams, r.id).toBeLessThan(1000);
      }
    }
  });
});

describe('fiber', () => {
  const day = (meals: PlanDay['meals']): PlanDay => ({ d: 'Mon', meals });

  it('adds up across the day, and flags days under 80% of the guide', () => {
    const d = dayNutrition(day({ Breakfast: { r: 'oats' }, Lunch: { r: 'bowl_quinoa' }, Dinner: { r: 'chili' } }), false);
    expect(d.fiber).toBe(Math.round(R.oats.fiber + R.bowl_quinoa.fiber + R.chili.fiber));
    expect(d.fiberOk).toBe(d.fiber >= FIBER_TARGET * FIBER_OK);
  });

  it('adds one fibrous fruit or vegetable side to a low-fiber day, never to an approved meal', () => {
    const low = day({ Breakfast: { r: 'pancakes' }, Lunch: { r: 'burritos', ok: true }, Dinner: { r: 'quesadilla' }, 'Evening sweet': { r: 'brownies' } });
    expect(dayNutrition(low, false).fiberOk).toBe(false);
    const { day: balanced } = balanceDay(low, 0, context(SAMPLE));
    expect(balanced.meals.Lunch?.side).toBeUndefined();
    const sides = Object.values(balanced.meals).map((m) => m?.side).filter(Boolean) as string[];
    expect(sides.length).toBeGreaterThan(0);
    expect(dayNutrition(balanced, false).fiber).toBeGreaterThan(dayNutrition(low, false).fiber);
  });
});
