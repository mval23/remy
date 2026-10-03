import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview, type Answers } from '../interview/types';
import { R } from './data/recipes';
import { WEEKS } from './data/weeks';
import { fitToGoals } from './goals';
import { buildPlan, eachMeal } from './planner';
import { check, context } from './rules';
import type { Variety, WeekPlan } from './types';

const SAMPLE: Answers = activeAnswers(fillWithSamples(emptyInterview()));
const counts = (plan: WeekPlan) => {
  const c: Record<string, number> = {};
  eachMeal(plan, (m) => m.r && (c[m.r] = (c[m.r] ?? 0) + 1));
  return c;
};

describe('recipe changes from the nutrition audit', () => {
  it('fits the new recipes to the sample profile and puts them in the week templates', () => {
    for (const id of ['oatsquares', 'miniquesadilla', 'appledip', 'tortilla']) expect(check(R[id], SAMPLE).ok, id).toBe(true);
    const planned = new Set<string>();
    for (const v of ['favorites', 'balanced', 'variety'] as Variety[]) for (const id of Object.keys(counts(buildPlan(v, context(SAMPLE)).plan))) planned.add(id);
    for (const id of ['oatsquares', 'miniquesadilla', 'appledip', 'tortilla']) expect(planned.has(id), id).toBe(true);
  });

  it('gives the new breakfast and snacks real protein for their size', () => {
    expect(R.oatsquares.pro).toBeGreaterThanOrEqual(18);
    expect(R.oatsquares.kcal).toBeLessThanOrEqual(400);
    for (const id of ['miniquesadilla', 'appledip']) {
      expect(R[id].pro, id).toBeGreaterThanOrEqual(12);
      expect(R[id].kcal, id).toBeLessThanOrEqual(250);
    }
  });

  it('plans bandeja paisa and alfredo at most once a week on its own, even when a template or fitting would repeat them', () => {
    const { days } = WEEKS.balanced;
    const original = days.map((d) => [...d]);
    try {
      // A template that asks for bandeja paisa every lunch.
      for (const d of days) d[1] = 'bandeja';
      const plan = buildPlan('balanced', context({ ...SAMPLE, rateA: { ...(SAMPLE.rateA as object), beans: 'like' } })).plan;
      expect(counts(plan).bandeja ?? 0).toBeLessThanOrEqual(1);
    } finally {
      original.forEach((d, i) => (days[i] = d));
    }
    for (const kcal of [2600, 3200]) {
      const fit = fitToGoals(buildPlan('balanced', context(SAMPLE)).plan, context(SAMPLE), { kcal, pro: null });
      const c = counts(fit.plan);
      expect(c.bandeja ?? 0).toBeLessThanOrEqual(1);
      expect(c.alfredo ?? 0).toBeLessThanOrEqual(1);
    }
  });
});
