import { allRatings } from '../interview/helpers';
import { LEVELS } from '../interview/questions';
import type { Answers } from '../interview/types';
import { ING } from './data/ingredients';
import { check } from './rules';
import type { Recipe, Sub } from './types';

/**
 * The recipe as it would be after a swap: the `out` ingredient replaced by the `in` ones, and the foods updated
 * to match. A food stays when another remaining ingredient still has it (parmesan keeps cheese after a mozzarella swap).
 */
export function withSwap(r: Recipe, s: Sub): Recipe {
  const qty = r.ing.find(([k]) => k === s.out)?.[1] ?? 1;
  const ing: [string, number][] = [...r.ing.filter(([k]) => k !== s.out), ...s.in.map((k): [string, number] => [k, qty])];
  const foods = { ...r.foods };
  const gone = ING[s.out]?.f;
  if (gone && !ing.some(([k]) => ING[k]?.f === gone)) delete foods[gone];
  for (const k of s.in) {
    const f = ING[k]?.f;
    if (f && !(f in foods)) foods[f] = 1;
  }
  return { ...r, ing, foods };
}

const ACCEPTED = ['love', 'like', 'okay', 'ways'];

/**
 * Swaps that are safe and welcome for this person: the swapped recipe passes every allergy, diet, food-safety and
 * taste rule, and each new food is one they rated Okay or better. `note` names how they rated it ("like it").
 */
export function safeSubs(r: Recipe, A: Answers): { from: string; to: string; note: string }[] {
  const rat = allRatings(A);
  const levelName = (lv: string) => LEVELS.find((l) => l.id === lv)?.name.toLowerCase() ?? lv;
  return (r.subs ?? []).flatMap((s) => {
    if (!check(withSwap(r, s), A).ok) return [];
    const foods = s.in.map((k) => ING[k]?.f).filter((f): f is string => !!f);
    if (foods.some((f) => !ACCEPTED.includes(rat[f]))) return [];
    return [{ from: s.from, to: s.to, note: foods.length ? levelName(rat[foods[0]]) : '' }];
  });
}
