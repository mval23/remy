import { afterEach, describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { applyRemoved, applySlots, baseSlot, MEAL_IDS, R, SIDE_IDS } from './data/recipes';
import slotMap from './data/slots.json';
import removedList from './data/removed.json';
import { buildPlan, dropRemoved, eachMeal, regenerate } from './planner';
import { context } from './rules';
import type { WeekPlan } from './types';

const ctx = context(activeAnswers(fillWithSamples(emptyInterview())));
const used = (plan: WeekPlan) => {
  const ids = new Set<string>();
  eachMeal(plan, (m) => {
    if (m.r) ids.add(m.r);
    if (m.side) ids.add(m.side);
  });
  return ids;
};

afterEach(() => {
  applyRemoved([]);
  applySlots({});
});

describe('recipes deleted from the menu', () => {
  it('lists only real recipes in removed.json', () => {
    for (const id of removedList) expect(R[id], id).toBeDefined();
  });

  it('are never planned, even when a week template names them', () => {
    const before = buildPlan('balanced', ctx).plan;
    expect(used(before).has('teriyaki')).toBe(true);
    applyRemoved(['teriyaki', 'brownies']);
    expect(MEAL_IDS).not.toContain('teriyaki');
    // Still readable, so an old plan or backup that has it doesn't break.
    expect(R.teriyaki).toBeDefined();
    const after = buildPlan('balanced', ctx).plan;
    expect(used(after).has('teriyaki')).toBe(false);
    expect(used(after).has('brownies')).toBe(false);
    expect(used(regenerate('balanced', ctx, after, 0).plan).has('teriyaki')).toBe(false);
  });

  it('are swapped out of a week that already has them, leaving other meals alone', () => {
    const plan = buildPlan('balanced', ctx).plan;
    applyRemoved(['teriyaki']);
    const { plan: next, changed } = dropRemoved(plan, ctx);
    expect(changed).toBeGreaterThan(0);
    expect(used(next).has('teriyaki')).toBe(false);
    expect(next[0].meals.Breakfast).toEqual(plan[0].meals.Breakfast);
  });

  it('can be restored', () => {
    applyRemoved(['side_corn']);
    expect(SIDE_IDS).not.toContain('side_corn');
    applyRemoved([]);
    expect(SIDE_IDS).toContain('side_corn');
    expect(MEAL_IDS).toContain('teriyaki');
  });
});

describe('meals moved on the menu', () => {
  it('lists only real recipes and meals in slots.json', () => {
    for (const [id, slot] of Object.entries(slotMap as Record<string, string>)) {
      expect(baseSlot(id), id).toBeDefined();
      expect(['Breakfast', 'Lunch', 'Dinner', 'Afternoon snack', 'Evening sweet']).toContain(slot);
    }
  });

  it('plans a moved recipe only in its new meal, and moves it out of a week that has it in the old one', () => {
    const plan = buildPlan('balanced', ctx).plan;
    expect(plan[0].meals.Dinner?.r).toBe('spaghetti');
    applySlots({ spaghetti: 'Lunch' });
    expect(R.spaghetti.slot).toBe('Lunch');
    const rebuilt = buildPlan('balanced', ctx).plan;
    rebuilt.forEach((d) => expect(d.meals.Dinner?.r).not.toBe('spaghetti'));
    const { plan: next } = dropRemoved(plan, ctx);
    next.forEach((d) => expect(d.meals.Dinner?.r).not.toBe('spaghetti'));
    applySlots({});
    expect(R.spaghetti.slot).toBe('Dinner');
  });

  it('serves ajiaco, sancocho, bandeja paisa and sudado at lunch', () => {
    for (const id of ['ajiaco', 'sancocho', 'bandeja', 'sudado']) expect(R[id].slot, id).toBe('Lunch');
  });
});
