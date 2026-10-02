import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples, sequence } from '../interview/engine';
import { QBY } from '../interview/questions';
import { emptyInterview, type Answers } from '../interview/types';
import { weightOn } from '../learning/learning';
import { R } from '../planning/data/recipes';
import { goalsOf } from '../planning/goals';
import { buildPlan, eachMeal } from '../planning/planner';
import { check, context, recipeRisks } from '../planning/rules';
import type { Variety } from '../planning/types';
import { careMode, noWeightLoss, REFER_NOTE, riskFlags } from './screen';

/** The sample picky-eater profile from the interview. */
const SAMPLE: Answers = activeAnswers(fillWithSamples(emptyInterview()));
/** The sample profile with some answers changed, filtered the way the app filters them. */
const sampleWith = (patch: Answers): Answers => {
  const s = fillWithSamples(emptyInterview());
  return activeAnswers({ ...s, answers: { ...s.answers, ...patch } });
};
const PREGNANT = sampleWith({ health: ['Pregnancy'] });
const OLDER = sampleWith({ age: '65 or older' });

const planned = (A: Answers) => {
  const ids = new Set<string>();
  for (const v of ['favorites', 'balanced', 'variety'] as Variety[]) eachMeal(buildPlan(v, context(A)).plan, (m) => m.r && ids.add(m.r));
  return ids;
};

describe('health and age screen', () => {
  it('sorts people into standard, gentle and refer', () => {
    expect(careMode(SAMPLE)).toBe('standard');
    expect(careMode({ health: ['Pregnancy'] })).toBe('refer');
    expect(careMode({ health: ['Breastfeeding'] })).toBe('refer');
    expect(careMode({ health: ['An eating disorder, now or in the past'] })).toBe('refer');
    expect(careMode({ age: 'Under 18' })).toBe('refer');
    expect(careMode({ age: '65 or older' })).toBe('gentle');
    expect(careMode({ age: 'Prefer not to say', health: ['Blood pressure'] })).toBe('standard');
  });

  it('leaves the sample profile exactly as it was', () => {
    expect(riskFlags(SAMPLE)).toEqual([]);
    expect(noWeightLoss(SAMPLE)).toBe(false);
    expect(goalsOf({ kcal: '1700', pro: '110' }, SAMPLE)).toEqual({ kcal: 1700, pro: 110 });
  });

  it('knows which recipes carry a food-safety risk, and which cook it away', () => {
    expect(recipeRisks(R.carbonara)).toEqual(['raw-egg']);
    expect(recipeRisks(R.bandeja)).toEqual(['soft-egg']);
    for (const id of ['arepapollo', 'tinga', 'pericos', 'esquites']) expect(recipeRisks(R[id]), id).toEqual(['fresh-cheese']);
    expect(recipeRisks(R.pandebono)).toEqual([]);
  });

  it('in pregnancy, blocks egg sauces, runny yolks and unheated queso fresco as safety rules', () => {
    for (const id of ['carbonara', 'bandeja', 'arepapollo', 'tinga', 'pericos', 'esquites']) {
      const c = check(R[id], PREGNANT);
      expect(c.ok, id).toBe(false);
      expect(c.ok === false && 'blocked' in c && c.blocked, id).toBe(true);
    }
    expect(check(R.pandebono, PREGNANT).ok).toBe(true);
    const ids = planned(PREGNANT);
    for (const id of ['carbonara', 'bandeja', 'arepapollo', 'tinga', 'pericos', 'esquites']) expect(ids.has(id), id).toBe(false);
  });

  it('at 65 or older, blocks only the egg sauce that doesn’t fully cook', () => {
    expect(check(R.carbonara, OLDER).ok).toBe(false);
    // Plain answers, so the sample profile's dislikes (beans) don't hide bandeja paisa.
    expect(check(R.arepapollo, { age: '65 or older' }).ok).toBe(true);
    expect(check(R.bandeja, { age: '65 or older' }).ok).toBe(true);
  });

  it('turns off goals, fitting and weight tracking in refer mode', () => {
    const A = sampleWith({ health: ['Pregnancy'], progress: 'Add an optional weekly weight', pace: 'Detailed', calories: '1300' });
    expect(goalsOf({ kcal: '1300', pro: '100' }, A)).toEqual({ kcal: null, pro: null });
    expect(weightOn(A)).toBe(false);
    expect(A.pace).toBeUndefined();
    expect(A.calories).toBeUndefined();
    const ids = sequence({ ...fillWithSamples(emptyInterview()).answers, age: 'Under 18' }).map((q) => q.id);
    expect(ids).toContain('age');
    for (const id of ['pace', 'calories', 'progress']) expect(ids, id).not.toContain(id);
  });

  it('says why when someone in refer mode picks weight loss', () => {
    expect(QBY.goal.ack!('Lose weight and body fat, sustainably', { health: ['Pregnancy'] })).toBe(REFER_NOTE);
    expect(QBY.goal.ack!('Lose weight and body fat, sustainably', {})).not.toBe(REFER_NOTE);
    expect(QBY.health.ack!(['An eating disorder, now or in the past'], {})).toBe(REFER_NOTE);
  });
});
