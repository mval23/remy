import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview, type Answers } from '../interview/types';
import { buildPlan } from '../planning/planner';
import { context } from '../planning/rules';
import { emptyPlanState, type PlanState } from '../storage/planState';
import { ADJUST_KCAL, applyCheckin, ATE, forgetLearned, proposeAdjustment, weekQuestions, weeklyLossPct } from './learning';
import { emptyCheckin, type ProgressEntry } from './types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;
const s = fillWithSamples(emptyInterview());
const A: Answers = activeAnswers({ ...s, answers: { ...s.answers, progress: 'Add an optional weekly weight' } });

/** A week planned from an estimate of 1,700 kcal (floor 1,500), last changed long ago. */
function state(patch: Partial<PlanState> = {}): PlanState {
  const base = { ...emptyPlanState(), variety: 'balanced' as const, weekStartedAt: 1, ...patch };
  return {
    ...base,
    nutrition: { ...base.nutrition, kcal: '1700', pro: '95', from: 'estimate', floor: 1500, adjustedAt: 0, ...patch.nutrition },
    plan: buildPlan('balanced', context(A)).plan,
  };
}
/** Weigh-ins, newest first like `PlanState.progress`: one per week, `kg` oldest to newest. */
const weighIns = (kg: number[], extra: Partial<ProgressEntry> = {}): ProgressEntry[] =>
  kg.map((w, i) => ({ at: NOW - (kg.length - 1 - i) * 7 * DAY, weight: w, unit: 'kg' as const, ...extra })).reverse();

describe('weight trend for adjustments', () => {
  it('works out % lost a week from 3+ weigh-ins over 2+ weeks', () => {
    expect(weeklyLossPct(weighIns([80, 79.6, 79.2]), NOW)).toBeCloseTo(0.5, 1);
    expect(weeklyLossPct(weighIns([80, 79.6]), NOW)).toBeNull();
    // Old weigh-ins don't count.
    expect(weeklyLossPct(weighIns([80, 79, 78]).map((p) => ({ ...p, at: p.at - 60 * DAY })), NOW)).toBeNull();
  });
});

describe('check-in adjustment of an estimate-based target', () => {
  const steady = weighIns([80, 80, 80.1]);

  it('only touches targets that came from the estimate, at most every 2 weeks', () => {
    expect(proposeAdjustment(state({ nutrition: { ...emptyPlanState().nutrition, kcal: '1700', from: 'typed' } }), { ate: ATE[0] }, steady, NOW)).toBeNull();
    expect(proposeAdjustment(state({ nutrition: { ...emptyPlanState().nutrition, kcal: '1700', from: 'estimate', floor: 1500, adjustedAt: NOW - 5 * DAY } }), { ate: ATE[0] }, steady, NOW)).toBeNull();
  });

  it('lowers the target by 100 when weight holds steady while most of the food was eaten', () => {
    expect(proposeAdjustment(state(), { ate: ATE[0], hunger: 'Mostly fine' }, steady, NOW)).toMatchObject({ delta: -ADJUST_KCAL });
  });

  it('never lowers it under the floor', () => {
    expect(proposeAdjustment(state({ nutrition: { ...emptyPlanState().nutrition, kcal: '1550', from: 'estimate', floor: 1500, adjustedAt: 0 } }), { ate: ATE[0] }, steady, NOW)).toBeNull();
  });

  it('raises it when often hungry two check-ins running, or losing more than 1% a week', () => {
    const hungry = [{ at: NOW, hunger: 'Often hungry' }, { at: NOW - 7 * DAY, hunger: 'Often hungry' }];
    expect(proposeAdjustment(state(), { hunger: 'Often hungry', ate: ATE[0] }, hungry, NOW)).toMatchObject({ delta: ADJUST_KCAL });
    expect(proposeAdjustment(state(), { ate: ATE[0] }, weighIns([80, 78.8, 77.6]), NOW)).toMatchObject({ delta: ADJUST_KCAL });
  });

  it('leaves it alone when half the food or less was eaten, and says why', () => {
    expect(proposeAdjustment(state(), { ate: 'About half' }, steady, NOW)).toMatchObject({ delta: 0, why: expect.stringContaining('taste and effort') });
  });

  it('applies through the check-in, explains it, fits next week to it, and can be undone', () => {
    const st = { ...state(), progress: weighIns([80, 80]).map((p) => ({ ...p, at: p.at - 7 * DAY })) };
    const withDraft = { ...st, checkin: { ...emptyCheckin(), weight: '80.1', q: { ate: ATE[0], hunger: 'Mostly fine' } } };
    const { next, changes } = applyCheckin(withDraft, A, NOW);
    expect(next.nutrition.kcal).toBe('1600');
    expect(next.nutrition.adjustedAt).toBe(NOW);
    expect(changes.join(' ')).toContain('Aim for about 1,600 kcal a day (−100)');
    const item = next.learned.find((x) => x.effect === 'target')!;
    expect(item.kcal).toBe(-100);
    expect(forgetLearned(next, item.id).nutrition.kcal).toBe('1700');
  });

  it('asks how much of the planned food was eaten', () => {
    const st = state();
    expect(weekQuestions(st.plan!, A, st).map((q) => q.id)).toContain('ate');
  });
});
