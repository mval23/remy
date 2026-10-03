import { afterEach, describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { applyRemoved, applySlots, baseSlot, MEAL_IDS, R, SIDE_IDS } from './data/recipes';
import slotMap from './data/slots.json';
import removedList from './data/removed.json';
import { buildPlan, dropRemoved, eachMeal, regenerate } from './planner';
import { context, storage } from './rules';
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
    expect(used(before).has('burritos')).toBe(true);
    applyRemoved(['burritos', 'brownies']);
    expect(MEAL_IDS).not.toContain('burritos');
    // Still readable, so an old plan or backup that has it doesn't break.
    expect(R.burritos).toBeDefined();
    const after = buildPlan('balanced', ctx).plan;
    expect(used(after).has('burritos')).toBe(false);
    expect(used(after).has('brownies')).toBe(false);
    expect(used(regenerate('balanced', ctx, after, 0).plan).has('burritos')).toBe(false);
  });

  it('are swapped out of a week that already has them, leaving other meals alone', () => {
    const plan = buildPlan('balanced', ctx).plan;
    applyRemoved(['burritos']);
    const { plan: next, changed } = dropRemoved(plan, ctx);
    expect(changed).toBeGreaterThan(0);
    expect(used(next).has('burritos')).toBe(false);
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

describe('a short lunch list', () => {
  // Every lunch that freezes, gone: the lunches left only keep 3–4 days, so days 5–7 need something from the freezer.
  const freezable = () => MEAL_IDS.filter((id) => R[id].slot === 'Lunch' && R[id].freezer > 0);

  it('never leaves a lunch empty: a freezer-friendly dinner fills the late days, marked borrowed', () => {
    applyRemoved(freezable());
    const { plan } = buildPlan('balanced', ctx);
    plan.forEach((day, i) => {
      const m = day.meals.Lunch;
      if (!m || m.out) return;
      expect(m.r, `lunch on day ${i + 1}`).toBeTruthy();
      expect(storage(R[m.r!], i + 1).k, `lunch on day ${i + 1}`).not.toBe('unsafe');
      if (R[m.r!].slot !== 'Lunch') expect(m.borrowed).toBe(true);
    });
    expect(plan.some((day) => day.meals.Lunch?.borrowed)).toBe(true);
  });

  it('keeps an approved borrowed lunch when the plan loads or is rebuilt', () => {
    applyRemoved(freezable());
    const { plan } = buildPlan('balanced', ctx);
    const d = plan.findIndex((day) => day.meals.Lunch?.borrowed);
    const approved = plan.map((day, i) => (i === d ? { ...day, meals: { ...day.meals, Lunch: { ...day.meals.Lunch!, ok: true } } } : day));
    expect(dropRemoved(approved, ctx).plan[d].meals.Lunch).toEqual(approved[d].meals.Lunch);
    expect(buildPlan('balanced', ctx, approved).plan[d].meals.Lunch).toEqual(approved[d].meals.Lunch);
  });

  it('fills a lunch saved as “needs a choice” when the plan loads', () => {
    applyRemoved(freezable());
    const { plan } = buildPlan('balanced', ctx);
    const empty = plan.map((day, i) => (i === 6 ? { ...day, meals: { ...day.meals, Lunch: { r: null, need: true, ok: false } } } : day));
    const m = dropRemoved(empty, ctx).plan[6].meals.Lunch!;
    expect(m.r).toBeTruthy();
    expect(storage(R[m.r!], 7).k).not.toBe('unsafe');
  });
});
