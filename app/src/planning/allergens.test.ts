import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { QBY } from '../interview/questions';
import { emptyInterview, type Answers } from '../interview/types';
import { safetyRules } from '../profile/profile';
import { ING } from './data/ingredients';
import { MEAL_IDS, R } from './data/recipes';
import { emptyGroceryEdits, toItems } from './grocery';
import { balanceDay } from './nutrition';
import { buildPlan, eachMeal } from './planner';
import { check, context, kosherClash, labelChecks, STRICT_ALLERGY, STRICT_ALLERGY_OLD } from './rules';

const blocked = (id: string, A: Answers) => {
  const c = check(R[id], A);
  return c.ok === false && 'blocked' in c && c.blocked;
};
const allergic = (allergy: string, strict = false): Answers => ({
  allergies: [allergy],
  allergy_confirm: strict ? STRICT_ALLERGY : 'Yes, never include it',
});

describe('allergen data', () => {
  it('blocks a known carrier of every major allergen', () => {
    const carriers: [string, string][] = [
      ['Peanuts', 'pboats'],
      ['Tree nuts', 'pestopasta'],
      ['Milk / dairy', 'oats'],
      ['Eggs', 'eggbites'],
      ['Wheat / gluten', 'spaghetti'],
      ['Soy', 'friedrice'],
      ['Fish', 'salmonbowl'],
      ['Shellfish', 'shrimp'],
    ];
    for (const [allergy, id] of carriers) expect(blocked(id, allergic(allergy)), `${allergy} → ${id}`).toBe(true);
  });

  it('counts the soy lecithin in chocolate chips', () => {
    expect(blocked('brownies', allergic('Soy'))).toBe(true);
  });

  it('extends the stricter rule to ingredients that often carry the allergen', () => {
    // Burger buns often carry sesame: allowed with the usual rule (and flagged on the grocery list), blocked with the stricter one.
    expect(check(R.turkeyburgers, allergic('Sesame')).ok).toBe(true);
    expect(labelChecks('buns', allergic('Sesame'))).toEqual(['may contain sesame']);
    expect(blocked('turkeyburgers', allergic('Sesame', true))).toBe(true);
    // Oats often carry gluten.
    expect(check(R.oats, allergic('Wheat / gluten')).ok).toBe(true);
    expect(blocked('oats', allergic('Wheat / gluten', true))).toBe(true);
  });

  it('keeps answers saved with the old “may contain” wording working, and shows what the rule does', () => {
    const A: Answers = { allergies: ['Sesame'], allergy_confirm: STRICT_ALLERGY_OLD };
    expect(blocked('turkeyburgers', A)).toBe(true);
    expect(safetyRules(A).confirmation).toBe(STRICT_ALLERGY);
    const values = (QBY.allergy_confirm.opts ?? []).map((o) => (typeof o === 'string' ? o : o.v));
    expect(values).toContain(STRICT_ALLERGY);
  });

  it('matches typed-in allergies against hidden parts', () => {
    const mustard: Answers = { allergies: ['Mustard'] };
    for (const id of ['tunapasta', 'wraps', 'caesar']) expect(blocked(id, mustard), id).toBe(true);
    expect(check(R.spaghetti, mustard).ok).toBe(true);
    const cilantro: Answers = { allergies: ['Cilantro'] };
    expect(blocked('burritos', cilantro)).toBe(true);
    const corn: Answers = { allergies: ['Corn'] };
    expect(blocked('guacamole', corn)).toBe(true);
  });

  it('keeps every hidden part, may-contain and label tag well formed', () => {
    const tags = new Set(['peanut', 'treenut', 'dairy', 'egg', 'gluten', 'soy', 'fish', 'shellfish', 'sesame', 'halal', 'kosher']);
    for (const [k, g] of Object.entries(ING)) {
      for (const t of g.may ?? []) expect(tags.has(t), `${k} may ${t}`).toBe(true);
      for (const l of g.label ?? []) for (const t of l.for ?? []) expect(tags.has(t), `${k} label ${t}`).toBe(true);
      for (const p of g.parts ?? []) expect(p, k).toBe(p.toLowerCase());
    }
  });
});

describe('diet rules', () => {
  it('treats pork as red meat', () => {
    const A: Answers = { diet: ['No red meat'] };
    expect(blocked('bandeja', A)).toBe(true);
    expect(blocked('carbonara', A)).toBe(true);
    expect(blocked('spaghetti', A)).toBe(true);
    expect(check(R.arrozconpollo, A).ok).toBe(true);
  });

  it('keeps meat and dairy apart for Kosher, in dishes and in sides', () => {
    const A: Answers = { diet: ['Kosher'] };
    for (const id of ['lasagna', 'quesadilla', 'chickenparm', 'burritos']) expect(blocked(id, A), id).toBe(true);
    for (const id of ['arrozconpollo', 'oats', 'brownies']) expect(check(R[id], A).ok, id).toBe(true);
    expect(kosherClash(A, R.arrozconpollo, R.side_cheese)).toBe(true);
    expect(kosherClash(A, R.arrozconpollo, R.side_apple)).toBe(false);
    expect(kosherClash({}, R.lasagna)).toBe(false);
    // Balancing never adds a dairy side to a meat meal.
    const ctx = context(A);
    const day = { d: 'Mon' as const, meals: { Lunch: { r: 'arrozconpollo' }, Dinner: { r: 'sudado' } } };
    const { day: balanced } = balanceDay(day, 0, ctx);
    for (const m of Object.values(balanced.meals)) if (m?.side) expect(kosherClash(A, R[m.r!], R[m.side]), m.side).toBe(false);
  });

  it('plans whole Kosher weeks with no meat-and-dairy dish', () => {
    const s = fillWithSamples(emptyInterview());
    const A = activeAnswers({ ...s, answers: { ...s.answers, diet: ['Kosher'] } });
    for (const v of ['favorites', 'balanced', 'variety'] as const)
      eachMeal(buildPlan(v, context(A)).plan, (m) => {
        if (m.r) expect(kosherClash(A, R[m.r], m.side ? R[m.side] : undefined), `${v} ${m.r} + ${m.side}`).toBe(false);
      });
  });

  it('flags certification and alcohol on the label for Halal and Kosher', () => {
    expect(labelChecks('chickenbreast', { diet: ['Halal'] })).toEqual(['halal-certified']);
    expect(labelChecks('chickenbreast', { diet: ['Kosher'] })).toEqual(['kosher-certified']);
    expect(labelChecks('vanilla', { diet: ['Halal'] })).toEqual(['contains alcohol; alcohol-free vanilla works too']);
    expect(labelChecks('chickenbreast', {})).toEqual([]);
  });

  it('leaves out coffee for a caffeine intolerance, but keeps chocolate', () => {
    const A: Answers = { intolerances: ['Caffeine'] };
    expect(blocked('tiramisu', A)).toBe(true);
    expect(check(R.brownies, A).ok).toBe(true);
  });
});

describe('label checks on the grocery list', () => {
  it('shows queso fresco’s pasteurized-milk check to everyone, and allergy checks only to those they concern', () => {
    const totals = { total: { quesofresco: 200, buns: 4 }, from: { quesofresco: ['Tinga'], buns: ['Burgers'] } };
    const plain = toItems(totals, {}, emptyGroceryEdits());
    expect(plain.find((x) => x.k === 'quesofresco')!.checks).toEqual(['made with pasteurized milk']);
    expect(plain.find((x) => x.k === 'buns')!.checks).toEqual([]);
    const sesame = toItems(totals, allergic('Sesame'), emptyGroceryEdits());
    expect(sesame.find((x) => x.k === 'buns')!.checks).toEqual(['may contain sesame']);
  });

  it('keeps every library meal reachable for the sample profile', () => {
    const SAMPLE = activeAnswers(fillWithSamples(emptyInterview()));
    const allowed = MEAL_IDS.filter((id) => check(R[id], SAMPLE).ok);
    expect(allowed.length).toBeGreaterThan(40);
  });
});
