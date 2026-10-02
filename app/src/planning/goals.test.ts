import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview, type Answers } from '../interview/types';
import { R } from './data/recipes';
import { ING } from './data/ingredients';
import { fitToGoals, goalsOf, SCALE_MAX, SCALE_MIN, weekAverage } from './goals';
import { emptyGroceryEdits, groceryList } from './grocery';
import { buysMonthly, forecastWeeks, monthList, MONTH_WEEKS } from './month';
import { dayNutrition } from './nutrition';
import { approveAll, buildPlan, eachMeal, regenerate } from './planner';
import { check, context, storage } from './rules';
import { schedule } from './schedule';
import type { WeekPlan } from './types';

const SAMPLE: Answers = activeAnswers(fillWithSamples(emptyInterview()));
const ctx = context(SAMPLE);
const week = () => buildPlan('balanced', ctx).plan;
const recipes = (plan: WeekPlan) => {
  const ids = new Set<string>();
  eachMeal(plan, (m) => m.r && ids.add(m.r));
  return ids;
};
const safeAndAllowed = (plan: WeekPlan) =>
  plan.every((d, i) => Object.values(d.meals).every((m) => !m?.r || (check(R[m.r], SAMPLE).ok && storage(R[m.r], i + 1).k !== 'unsafe')));

describe('daily goals', () => {
  it('reads realistic goals and ignores the rest', () => {
    expect(goalsOf({ kcal: '1700', pro: '120' }, {})).toEqual({ kcal: 1700, pro: 120 });
    expect(goalsOf({ kcal: '17', pro: '' }, {})).toEqual({ kcal: null, pro: null });
  });

  it('brings a week down toward a lower calorie goal, safely', () => {
    const plan = week();
    const before = weekAverage(plan, false).kcal;
    const fit = fitToGoals(plan, ctx, { kcal: 1700, pro: null });
    expect(fit.kcal).toBeLessThan(before);
    expect(Math.abs(fit.kcal - 1700)).toBeLessThan(Math.abs(before - 1700));
    expect(fit.scale).toBeGreaterThanOrEqual(SCALE_MIN);
    expect(safeAndAllowed(fit.plan)).toBe(true);
    // Never a light day, and the sweet stays every day it was planned.
    for (const d of fit.plan) expect(dayNutrition(d, false).light).toBe(false);
    plan.forEach((d, i) => expect(!!fit.plan[i].meals['Evening sweet']?.r).toBe(!!d.meals['Evening sweet']?.r));
  });

  it('never aims below about 1,200 kcal, even when asked to', () => {
    const fit = fitToGoals(week(), ctx, { kcal: 900, pro: null });
    for (const d of fit.plan) expect(dayNutrition(d, false).light).toBe(false);
  });

  it('raises a week toward a higher goal, with portions at most 20% bigger', () => {
    const fit = fitToGoals(week(), ctx, { kcal: 3200, pro: null });
    expect(fit.kcal).toBeGreaterThan(weekAverage(week(), false).kcal);
    expect(fit.scale).toBeLessThanOrEqual(SCALE_MAX);
  });

  it('adds protein sides until each day reaches the protein goal where it can', () => {
    const plan = week();
    const goal = Math.round(weekAverage(plan, false).pro + 20);
    const fit = fitToGoals(plan, ctx, { kcal: null, pro: goal });
    expect(fit.sides).toBeGreaterThan(0);
    expect(fit.pro).toBeGreaterThan(weekAverage(plan, false).pro);
  });

  it('keeps approved meals and gives the same answer when fitted again', () => {
    const approved = approveAll(week());
    const fit = fitToGoals(approved, ctx, { kcal: 1700, pro: 150 });
    expect(recipes(fit.plan)).toEqual(recipes(approved));
    expect(fit.swapped).toBe(0);
    const again = fitToGoals(fit.plan, ctx, { kcal: 1700, pro: 150 });
    expect(again.plan).toEqual(fit.plan);
  });

  it('cooks and shops for the smaller portions', () => {
    const fit = fitToGoals(week(), ctx, { kcal: 1600, pro: null });
    expect(fit.scale).toBeLessThan(1);
    // The same meals at full portions, for comparison.
    const full = fit.plan.map((d) => ({ ...d, meals: Object.fromEntries(Object.entries(d.meals).map(([k, m]) => [k, m && { ...m, x: undefined }])) }));
    const q = (p: WeekPlan, k: string) => groceryList(p, SAMPLE, emptyGroceryEdits()).find((x) => x.k === k)!.q!;
    const dinner = [...recipes(fit.plan)].find((id) => R[id].slot === 'Dinner')!;
    // The dinner's biggest ingredient weighed in grams, so rounding to whole units can't hide the change.
    const k = R[dinner].ing.filter(([x]) => ING[x].u === 'g').sort((x, y) => y[1] - x[1])[0][0];
    expect(q(fit.plan, k)).toBeLessThan(q(full, k));
    expect(q(fit.plan, k)).toBeGreaterThanOrEqual(q(full, k) * SCALE_MIN - 1);
  });
});

describe('new menu', () => {
  it('changes every unapproved meal, keeps approved ones, and follows every rule', () => {
    const plan = week();
    const withApproved = plan.map((d, i) => (i === 0 ? { ...d, meals: { ...d.meals, Breakfast: { ...d.meals.Breakfast!, ok: true } } } : d));
    const { plan: next, changed } = regenerate('balanced', ctx, withApproved, 0);
    expect(changed).toBeGreaterThan(0);
    expect(next[0].meals.Breakfast).toEqual(withApproved[0].meals.Breakfast);
    expect(safeAndAllowed(next)).toBe(true);
    const before = recipes(plan);
    let different = 0;
    eachMeal(next, (m) => {
      if (m.r && !m.ok && !before.has(m.r)) different++;
    });
    expect(different).toBeGreaterThan(0);
  });

  it('gives another option when tapped again, and is repeatable', () => {
    const plan = week();
    const a = regenerate('balanced', ctx, plan, 0).plan;
    const b = regenerate('balanced', ctx, a, 1).plan;
    expect(recipes(b)).not.toEqual(recipes(a));
    expect(regenerate('balanced', ctx, plan, 0).plan).toEqual(a);
  });
});

describe('monthly shopping', () => {
  it('buys what keeps monthly, and fresh food weekly', () => {
    expect(buysMonthly('thighs')).toBe(true);
    expect(buysMonthly('rice')).toBe(true);
    expect(buysMonthly('cheddar')).toBe(true);
    expect(buysMonthly('corn')).toBe(true);
    expect(buysMonthly('potatoes')).toBe(true);
    expect(buysMonthly('milk')).toBe(false);
    expect(buysMonthly('eggs')).toBe(false);
    expect(buysMonthly('grapes')).toBe(false);
    expect(buysMonthly('tortillas')).toBe(false);
  });

  it('adds up four weeks of staples, rotating recipes the way check-ins do', () => {
    const plan = week();
    const weeks = forecastWeeks(plan, 'balanced', ctx, { kcal: null, pro: null });
    expect(weeks).toHaveLength(MONTH_WEEKS);
    for (const w of weeks) expect(safeAndAllowed(w)).toBe(true);
    const month = monthList(weeks, SAMPLE, emptyGroceryEdits());
    expect(month.every((x) => buysMonthly(x.k))).toBe(true);
    const oneWeek = groceryList(plan, SAMPLE, emptyGroceryEdits()).find((x) => x.k === 'rice')!;
    const monthRice = month.find((x) => x.k === 'rice')!;
    expect(monthRice.q!).toBeGreaterThan(oneWeek.q! * 2);
    // Prep still fits a day each week.
    for (const w of weeks) expect(schedule(w, SAMPLE).total).toBeLessThan(6 * 60);
  });
});
