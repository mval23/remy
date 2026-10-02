import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { ALLERGY_OPTS } from '../interview/questions';
import { emptyInterview, type Answers, type Ratings } from '../interview/types';
import { ING } from './data/ingredients';
import { R } from './data/recipes';
import { hardTags } from './rules';
import { safeSubs, withSwap } from './subs';

const SAMPLE: Answers = activeAnswers(fillWithSamples(emptyInterview()));
const DIETS = ['Vegetarian', 'Vegan', 'Pescatarian', 'No pork', 'No red meat', 'Halal', 'Kosher'];
const withSubs = Object.values(R).filter((r) => r.subs?.length);
const shown = (id: string, A: Answers) => safeSubs(R[id], A).map((s) => s.to);

describe('substitutions', () => {
  it('name real ingredients: the one swapped out is in the recipe, the ones coming in exist', () => {
    expect(withSubs.length).toBeGreaterThan(10);
    for (const r of withSubs)
      for (const s of r.subs!) {
        expect(r.ing.some(([k]) => k === s.out), `${r.id}: ${s.out}`).toBe(true);
        for (const k of s.in) expect(ING[k], `${r.id}: ${k}`).toBeDefined();
      }
  });

  it('never suggest an ingredient carrying a blocked allergen or diet tag, for every allergy and diet', () => {
    const profiles: Answers[] = [
      ...ALLERGY_OPTS.map((a) => ({ ...SAMPLE, allergies: [a] })),
      ...DIETS.map((d) => ({ ...SAMPLE, diet: [d] })),
      { ...SAMPLE, intolerances: ['Lactose', 'Gluten', 'Caffeine'] },
    ];
    for (const A of profiles) {
      const tags = hardTags(A);
      for (const r of withSubs)
        for (const s of safeSubs(r, A)) {
          const sub = r.subs!.find((x) => x.to === s.to)!;
          for (const k of sub.in) for (const t of ING[k].alg ?? []) expect(tags.has(t), `${r.id} → ${s.to} (${t}) for ${JSON.stringify(A.allergies ?? A.diet ?? A.intolerances)}`).toBe(false);
        }
    }
  });

  it('hides ground beef for “No red meat”, and shows it with the rating for someone who likes beef', () => {
    expect(shown('burritos', { ...SAMPLE, diet: ['No red meat'] })).not.toContain('ground beef');
    const subs = safeSubs(R.burritos, SAMPLE);
    expect(subs.find((s) => s.to === 'ground beef')?.note).toBe('like it');
    expect(subs.map((s) => s.to)).toContain('leave it out');
  });

  it('hides swaps to a food rated Never or Dislike', () => {
    const ratings: Ratings = { ...(SAMPLE.rateA as Ratings), turkey: 'never' };
    expect(shown('spaghetti', { ...SAMPLE, rateA: ratings })).not.toContain('ground turkey');
    expect(shown('spaghetti', SAMPLE)).toContain('ground turkey');
  });

  it('hides a swap that would break a food-safety rule (queso fresco in pregnancy)', () => {
    expect(shown('arepas', SAMPLE)).toContain('queso fresco, crumbled');
    expect(shown('arepas', { ...SAMPLE, health: ['Pregnancy'] })).not.toContain('queso fresco, crumbled');
  });

  it('keeps a food when another ingredient still has it', () => {
    const r = withSwap(R.arepas, R.arepas.subs![0]);
    expect(r.ing.map(([k]) => k)).toContain('quesofresco');
    expect(r.ing.map(([k]) => k)).not.toContain('mozzarella');
    expect(r.foods.cheese).toBeDefined();
    const noChips = withSwap(R.brownies, R.brownies.subs![0]);
    expect(noChips.ing.map(([k]) => k)).not.toContain('chips');
  });
});
