import { asBudget, asPreparations, has, hasAny, real, arr } from '../interview/helpers';
import type { Answers } from '../interview/types';

export type Confidence = 'high' | 'medium' | 'low';

export interface Inference {
  id: string;
  text: string;
  src: string;
  conf: Confidence;
}

/** Hard safety rules, kept separate from preferences. */
export function safetyRules(A: Answers) {
  return {
    allergies: real(A.allergies),
    diet: arr(A.diet).filter((x) => x !== 'No restrictions'),
    intolerances: real(A.intolerances),
    confirmation: typeof A.allergy_confirm === 'string' ? A.allergy_confirm : null,
  };
}

/** Conclusions Remy draws from several answers, each with a confidence level and source. */
export function inferences(A: Answers, hidden: Record<string, boolean> = {}): Inference[] {
  const out: Inference[] = [];
  const ways = asPreparations(A.ways);
  const crispy = Object.values(ways).some((w) => hasAny(w, ['Roasted until crispy', 'Air-fried']));
  const soft = hasAny(A.textures, ['Mushy', 'Soggy']);
  if (crispy || soft)
    out.push({ id: 'crispy', text: 'Prefers crispy textures over soft ones', src: 'Inferred from your preparation choices and texture answers', conf: crispy && soft ? 'medium' : 'low' });
  if (A.visible === 'Hidden is fine if I can’t taste it')
    out.push({ id: 'hidden', text: 'Vegetables blended into familiar sauces work for you', src: 'You said hidden ingredients are fine', conf: 'high' });
  if (has(A.appetite, 'Late-night cravings') && has(A.schedule, 'Evening sweet'))
    out.push({ id: 'evening', text: 'Evening is the best time for your sweet', src: 'Inferred from late-night cravings and your evening sweet slot', conf: 'medium' });
  if (A.mixed === 'Some mixing is fine')
    out.push({ id: 'bowls', text: 'Bowls and wraps suit you better than casseroles', src: 'Inferred from your answer on mixed dishes', conf: 'medium' });
  if (has(A.reheat, 'Fried or crispy things'))
    out.push({ id: 'cookfresh', text: 'Crispy foods get frozen raw and cooked fresh', src: 'You said crispy things reheat badly', conf: 'high' });
  if (A.leftovers === 'Only if they don’t feel like leftovers' || A.leftovers === 'I dislike leftovers')
    out.push({ id: 'components', text: 'Cook components and recombine them through the week', src: 'Your leftovers answer', conf: 'high' });
  const b = asBudget(A.budget);
  if (b && b.currency === 'USD' && b.amount && b.amount < 55)
    out.push({ id: 'budget', text: 'Share ingredients across recipes and favor affordable staples', src: 'Your weekly budget', conf: 'high' });
  if (has(A.away, 'Friday dinner'))
    out.push({ id: 'fri', text: 'Friday dinner usually happens away from home', src: 'Meals away from home', conf: 'high' });
  if (A.freezer === 'Tiny')
    out.push({ id: 'tinyfreezer', text: 'Keep freezer use low and add a 20-minute mid-week top-up', src: 'Your freezer space', conf: 'high' });
  return out.filter((x) => !hidden[x.id]);
}

/** Questions worth asking in a later check-in, beyond the ones that were skipped. */
export const LATER_QUESTIONS = [
  'Which brands of yogurt, sauce or snacks do you trust?',
  'Are frozen vegetables okay, or fresh only?',
  'Any dishes from home or childhood you still love?',
];
