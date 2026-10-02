import { ING } from './data/ingredients';
import type { Recipe } from './types';

/**
 * Macros per portion, added up from the ingredients (`ING[k].m`: grams per 100 g or 100 ml, or per one unit for
 * everything else). Rough estimates: brands and portions vary.
 */
export interface Macros {
  kcal: number;
  pro: number;
  /** Total carbohydrate, fiber included. */
  carb: number;
  fat: number;
  fiber: number;
}

/**
 * Energy from protein, carbohydrate, fat and fiber: 4 kcal per gram of protein and of digestible carbohydrate,
 * 2 per gram of fiber (the FDA and EU convention), 9 per gram of fat.
 */
export const kcalOf = (pro: number, carb: number, fat: number, fiber: number) => 4 * pro + 4 * Math.max(0, carb - fiber) + 2 * Math.min(fiber, carb) + 9 * fat;

export function macrosOf(ing: [string, number][], serves: number): Macros {
  let pro = 0, carb = 0, fat = 0, fiber = 0;
  for (const [k, q] of ing) {
    const g = ING[k];
    if (!g?.m) continue;
    const per = g.u === 'g' || g.u === 'ml' ? q / 100 : q;
    pro += g.m.pro * per;
    carb += g.m.carb * per;
    fat += g.m.fat * per;
    fiber += g.m.fiber * per;
  }
  const n = Math.max(1, serves);
  pro /= n;
  carb /= n;
  fat /= n;
  fiber /= n;
  return {
    kcal: Math.round(kcalOf(pro, carb, fat, fiber) / 10) * 10,
    pro: Math.round(pro),
    carb: Math.round(carb),
    fat: Math.round(fat),
    fiber: Math.round(fiber * 10) / 10,
  };
}

/**
 * Where a recipe's numbers come from: 'matched' when every ingredient has a FoodData Central or label source,
 * otherwise 'estimated' (Remy's rough values).
 */
export const nutritionSource = (ing: [string, number][]): 'matched' | 'estimated' => (ing.every(([k]) => ING[k]?.src) ? 'matched' : 'estimated');

/** Macros as screens show them: day and meal totals may not carry fiber yet. */
export type MacroShown = Omit<Macros, 'fiber'> & { fiber?: number };

/** A recipe with its macros worked out from its ingredients (library, AI and saved recipes alike). */
export const withMacros = <T extends Omit<Recipe, keyof Macros>>(r: T): T & Macros => ({ ...r, ...macrosOf(r.ing, r.serves) });
