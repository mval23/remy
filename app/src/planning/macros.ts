import { ING } from './data/ingredients';
import type { Recipe } from './types';

/**
 * Macros per portion, added up from the ingredients (`ING[k].m`: grams of protein, carbs and fat
 * per 100 g or 100 ml, or per one unit for everything else). Rough estimates: brands and portions vary.
 */
export interface Macros {
  kcal: number;
  pro: number;
  carb: number;
  fat: number;
}

export function macrosOf(ing: [string, number][], serves: number): Macros {
  let pro = 0, carb = 0, fat = 0;
  for (const [k, q] of ing) {
    const g = ING[k];
    if (!g?.m) continue;
    const per = g.u === 'g' || g.u === 'ml' ? q / 100 : q;
    pro += g.m[0] * per;
    carb += g.m[1] * per;
    fat += g.m[2] * per;
  }
  const n = Math.max(1, serves);
  pro /= n;
  carb /= n;
  fat /= n;
  return { kcal: Math.round((4 * (pro + carb) + 9 * fat) / 10) * 10, pro: Math.round(pro), carb: Math.round(carb), fat: Math.round(fat) };
}

/** A recipe with its macros worked out from its ingredients (library, AI and saved recipes alike). */
export const withMacros = <T extends Omit<Recipe, keyof Macros>>(r: T): T & Macros => ({ ...r, ...macrosOf(r.ing, r.serves) });
