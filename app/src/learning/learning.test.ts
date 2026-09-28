import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { allRatings } from '../interview/helpers';
import { emptyInterview, type Answers } from '../interview/types';
import { R } from '../planning/data/recipes';
import { dayNutrition } from '../planning/nutrition';
import { buildPlan, eachMeal } from '../planning/planner';
import { avoided, check, context, storage } from '../planning/rules';
import { emptyPlanState, type PlanState } from '../storage/planState';
import {
  answerSuggestion,
  applyCheckin,
  checkinDue,
  forgetAllLearned,
  forgetLearned,
  learnFromRejection,
  mealsToRate,
  noticeSuggestion,
  placeTrial,
  weekQuestions,
  weightTrend,
} from './learning';
import { emptyCheckin, type CheckinDraft } from './types';

const SAMPLE: Answers = activeAnswers(fillWithSamples(emptyInterview()));
const with_ = (patch: Answers): Answers => ({ ...SAMPLE, ...patch });

/** A planned sample week, as the app has it after the profile is confirmed. */
function week(A: Answers = SAMPLE, patch: Partial<PlanState> = {}): PlanState {
  const base = { ...emptyPlanState(), variety: 'balanced' as const, weekStartedAt: 1, ...patch };
  return { ...base, plan: buildPlan('balanced', context(A, base.adj, base.hungry)).plan };
}
const withCheckin = (s: PlanState, c: Partial<CheckinDraft>): PlanState => ({ ...s, checkin: { ...emptyCheckin(), ...c } });
const recipesIn = (s: PlanState) => {
  const ids = new Set<string>();
  eachMeal(s.plan!, (m) => {
    if (m.r) ids.add(m.r);
    if (m.side) ids.add(m.side);
  });
  return ids;
};

describe('weekly check-in', () => {
  it('lists each meal recipe once, without sides', () => {
    const rate = mealsToRate(week().plan!);
    expect(rate.length).toBeGreaterThan(3);
    expect(rate.every((x) => !R[x.id].side && x.times > 0)).toBe(true);
    expect(new Set(rate.map((x) => x.id)).size).toBe(rate.length);
  });

  it('“Not again” leaves the recipe out of the next week, and says so', () => {
    const s = week();
    const target = mealsToRate(s.plan!)[0].id;
    const { changes, next } = applyCheckin(withCheckin(s, { rated: { [target]: 'no' }, why: { [target]: ['Texture'] } }), SAMPLE, 1000);
    expect(recipesIn(next).has(target)).toBe(false);
    expect(avoided(target, context(SAMPLE, next.adj))).toBe(true);
    expect(changes).toContain(`Leave ${R[target].short.toLowerCase()} out of new weeks`);
    expect(next.learned[0].text).toContain('(texture)');
  });

  it('“Not again” still works on a recipe that was loved before', () => {
    const s = week(SAMPLE, { adj: { oats: 4 } });
    const { next } = applyCheckin(withCheckin(s, { rated: { oats: 'no' } }), SAMPLE);
    expect(avoided('oats', context(SAMPLE, next.adj))).toBe(true);
  });

  it('“Loved” ranks a recipe higher; deleting that item puts the score back', () => {
    const s = week();
    const { next } = applyCheckin(withCheckin(s, { rated: { oats: 'loved' } }), SAMPLE);
    expect(next.adj.oats).toBe(2);
    const item = next.learned.find((x) => x.recipe === 'oats')!;
    expect(forgetLearned(next, item.id).adj.oats).toBeUndefined();
  });

  it('starts a new week: fresh grocery list, pantry kept, check-in cleared', () => {
    const s = withCheckin(
      week(SAMPLE, { groceries: { checked: { rice: true }, have: { oil: true }, qty: { rice: '2' }, deleted: { eggs: true }, custom: [{ id: 'c', n: 'Foil', sec: 'Other', q: '' }] } }),
      { rated: { oats: 'fine' } },
    );
    const { changes, next } = applyCheckin(s, SAMPLE, 5000);
    expect(next.weekStartedAt).toBe(5000);
    expect(next.groceries).toEqual({ checked: {}, have: { oil: true }, qty: {}, deleted: {}, custom: [] });
    expect(next.checkin).toEqual(emptyCheckin());
    expect(changes.at(-1)).toMatch(/^Plan a new week \(prep day about .+, this week was .+\) and start a fresh grocery list$/);
  });

  it('never plans anything the safety rules block', () => {
    const A = with_({ allergies: ['Milk / dairy'] });
    const { next } = applyCheckin(withCheckin(week(A), { rated: { teriyaki: 'loved' } }), A);
    for (const id of recipesIn(next)) expect(check(R[id], A).ok, id).toBe(true);
  });

  it('“Prep day too long” moves one step toward repeat favorites', () => {
    const { changes, next } = applyCheckin(withCheckin(week(), { q: { prep: 'Too long' } }), SAMPLE);
    expect(next.variety).toBe('favorites');
    expect(changes[0]).toContain('fewer recipes to cook');
    const again = applyCheckin(withCheckin(next, { q: { prep: 'Too long' } }), SAMPLE);
    expect(again.next.variety).toBe('favorites');
    expect(again.changes[0]).toContain('already at its shortest');
  });

  it('“Often hungry” raises the protein guide until hunger settles', () => {
    const { changes, next } = applyCheckin(withCheckin(week(), { q: { hunger: 'Often hungry' } }), SAMPLE);
    expect(next.hungry).toBe(true);
    expect(changes).toContain('Aim 5 g higher on protein at breakfast, lunch and dinner');
    const later = applyCheckin(withCheckin(next, { q: { hunger: 'Mostly fine' } }), SAMPLE);
    expect(later.next.hungry).toBe(false);
    expect(later.next.learned.some((x) => x.effect === 'hungry')).toBe(false);
  });

  it('low energy adds sides to light days where one fits', () => {
    const { next } = applyCheckin(withCheckin(week(), { q: { energy: 'Low' } }), SAMPLE);
    const before = week().plan!.filter((d) => dayNutrition(d, false).light).length;
    const after = next.plan!.filter((d) => dayNutrition(d, false).light).length;
    expect(after).toBeLessThanOrEqual(before);
  });

  it('records body check-ins, and weight only when the user opted in', () => {
    const c = { q: { hunger: 'Mostly fine', fit: 'Looser' }, weight: '170', unit: 'lb' as const };
    const noWeight = applyCheckin(withCheckin(week(), c), with_({ progress: 'How I feel and how clothes fit' }), 10).next;
    expect(noWeight.progress[0]).toEqual({ at: 10, hunger: 'Mostly fine', fit: 'Looser' });
    const withWeight = applyCheckin(withCheckin(week(), c), with_({ progress: 'Add an optional weekly weight' }), 10).next;
    expect(withWeight.progress[0].weight).toBe(170);
  });

  it('is due on the last two days of the week, but not right after a check-in', () => {
    // The sample preps on Sunday, so Saturday is day 6 of 7.
    const saturday = new Date(2026, 8, 26, 18);
    const tuesday = new Date(2026, 8, 22, 18);
    expect(checkinDue(SAMPLE, 0, saturday)).toBe(true);
    expect(checkinDue(SAMPLE, 0, tuesday)).toBe(false);
    expect(checkinDue(SAMPLE, saturday.getTime() - 60_000, saturday)).toBe(false);
  });

  it('saves no progress entry when the body questions were skipped', () => {
    expect(applyCheckin(withCheckin(week(), { rated: { oats: 'fine' } }), SAMPLE).next.progress).toEqual([]);
  });

  it('asks about the sweet portion only when sweets were planned', () => {
    expect(weekQuestions(week().plan!, SAMPLE, week()).map((q) => q.id)).toContain('sweet');
    const noSweets = with_({ schedule: ['Breakfast', 'Lunch', 'Dinner'], fromprep: ['Breakfast', 'Lunch', 'Dinner'] });
    expect(weekQuestions(week(noSweets).plan!, noSweets, week(noSweets)).map((q) => q.id)).not.toContain('sweet');
  });
});

describe('“Remy noticed” suggestions', () => {
  it('suggests a crispy side for a disliked vegetable', () => {
    const s = noticeSuggestion(SAMPLE, {});
    expect(allRatings(SAMPLE).zucchini).toBe('dislike');
    expect(s?.side).toBe('side_zucchini');
    expect(s?.text).toContain('No pressure');
  });

  it('never suggests foods on the Never list, or anything when the user won’t retry foods', () => {
    const never = with_({ rateB: { ...allRatings(SAMPLE), zucchini: 'never' } });
    expect(noticeSuggestion(never, {})?.food).not.toBe('zucchini');
    expect(noticeSuggestion(with_({ retry: 'No thanks' }), {})).toBeNull();
    expect(noticeSuggestion(with_({ newfoods: 'Stick to what I know' }), {})).toBeNull();
  });

  it('never suggests a side that breaks a safety rule', () => {
    const s = noticeSuggestion(with_({ allergies: ['Wheat / gluten'] }), {});
    expect(s?.side).not.toBe('side_zucchini');
  });

  it('“Try it once” puts the side in next week once, then it’s gone', () => {
    const sug = noticeSuggestion(SAMPLE, {})!;
    const s = answerSuggestion(week(), sug, 'yes', 1);
    expect(s.trial).toBe('side_zucchini');
    expect(noticeSuggestion(SAMPLE, s.noticed)?.food).not.toBe('zucchini');
    const { changes, next } = applyCheckin(s, SAMPLE);
    expect(recipesIn(next).has('side_zucchini')).toBe(true);
    expect(next.trial).toBeNull();
    expect(changes.some((c) => c.includes('zucchini fries as a side, once'))).toBe(true);
    const after = applyCheckin(next, SAMPLE).next;
    expect(recipesIn(after).has('side_zucchini')).toBe(false);
  });

  it('places the trial side only on a day it keeps safely', () => {
    const plan = placeTrial(week().plan!, 'side_zucchini');
    plan.forEach((d, i) => {
      for (const m of Object.values(d.meals)) if (m?.side === 'side_zucchini') expect(storage(R.side_zucchini, i + 1).k).not.toBe('unsafe');
    });
  });

  it('deleting “stop asking” lets Remy ask again', () => {
    const sug = noticeSuggestion(SAMPLE, {})!;
    const s = answerSuggestion(week(), sug, 'stop');
    expect(noticeSuggestion(SAMPLE, s.noticed)?.food).not.toBe('zucchini');
    const undone = forgetLearned(s, s.learned[0].id);
    expect(noticeSuggestion(SAMPLE, undone.noticed)?.food).toBe('zucchini');
  });
});

describe('learned preferences', () => {
  it('a planner rejection ranks the meal lower and can be undone', () => {
    const s = learnFromRejection(week(), 'oats', 'Texture');
    expect(s.adj.oats).toBe(-2);
    expect(s.learned[0].text).toBe('Skipped overnight oats (texture)'.replace('overnight oats', R.oats.short.toLowerCase()));
    expect(forgetLearned(s, s.learned[0].id).adj.oats).toBeUndefined();
  });

  it('deleting everything learned resets scores, hunger and inferences, but not answers', () => {
    let s = applyCheckin(withCheckin(week(), { rated: { oats: 'loved' }, q: { hunger: 'Often hungry', sweet: 'I wanted more' } }), SAMPLE).next;
    s = forgetAllLearned(s, SAMPLE);
    expect(s.learned).toEqual([]);
    expect(s.adj).toEqual({});
    expect(s.hungry).toBe(false);
    expect(s.sweetPortion).toBeNull();
    expect(Object.keys(s.hiddenInferences).length).toBeGreaterThan(0);
    expect(s.plan).not.toBeNull();
  });
});

describe('weight trend', () => {
  it('needs at least 3 weigh-ins and compares the newest with the oldest of the last 4', () => {
    expect(weightTrend([{ at: 2, weight: 170 }, { at: 1, weight: 172 }])).toBeNull();
    const t = weightTrend([{ at: 5, weight: 168, unit: 'lb' }, { at: 4 }, { at: 3, weight: 170, unit: 'lb' }, { at: 2, weight: 171, unit: 'lb' }, { at: 1, weight: 172, unit: 'lb' }, { at: 0, weight: 190, unit: 'lb' }]);
    expect(t).toEqual({ entries: 4, change: -4, unit: 'lb' });
  });

  it('converts mixed units to the newest one', () => {
    const t = weightTrend([{ at: 3, weight: 77, unit: 'kg' }, { at: 2, weight: 172, unit: 'lb' }, { at: 1, weight: 174, unit: 'lb' }]);
    expect(t?.unit).toBe('kg');
    expect(t?.change).toBeCloseTo(77 - 174 * 0.45359237, 1);
  });
});
