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

/** Grams of an ingredient amount: g and ml as they are (1 ml counted as 1 g), counted units through `gpu`. */
export function gramsOf(k: string, q: number): number {
  const g = ING[k];
  if (!g) return 0;
  return g.u === 'g' || g.u === 'ml' ? q : q * (g.gpu ?? 0);
}

/** Fruit and vegetable servings per portion: 80 g of fruit or vegetables each (`ING[k].veg`), to the nearest quarter. */
export function produceOf(ing: [string, number][], serves: number): number {
  const grams = ing.reduce((s, [k, q]) => s + (ING[k]?.veg ?? 0) * gramsOf(k, q), 0);
  return Math.round((grams / 80 / Math.max(1, serves)) * 4) / 4;
}

/** How much heavier an ingredient gets when cooked (grains and pasta take up water; raw meat loses about a quarter). */
const COOKED: Record<string, number> = { rice: 3, quinoa: 2.7, spaghetti: 2.2, pasta: 2.2, lasagna: 2.2, arepaflour: 2 };
const cookedFactor = (k: string) => COOKED[k] ?? (ING[k]?.state === 'raw' && ING[k]?.sec === 'Meat' ? 0.75 : 1);

/** Liquids that rice and other grains soak up when they're cooked in them (arroz con pollo cooks its rice in broth). */
const ABSORBED = ['chickenbroth', 'vegbroth', 'milk'];

/**
 * Cooked grams per portion: the weighed batch when a kitchen test recorded one (`yieldG`), otherwise an estimate
 * from the ingredients. The estimate ignores water added or simmered off while cooking, apart from grains and pasta,
 * whose cooking liquid is counted once (broth or milk they soak up isn't added again).
 */
export function portionGrams(ing: [string, number][], serves: number, yieldG?: number): number {
  let total = yieldG;
  if (total === undefined) {
    const water = ing.reduce((s, [k, q]) => s + gramsOf(k, q) * Math.max(0, (COOKED[k] ?? 1) - 1), 0);
    const liquid = ing.reduce((s, [k, q]) => s + (ABSORBED.includes(k) ? gramsOf(k, q) : 0), 0);
    total = ing.reduce((s, [k, q]) => s + gramsOf(k, q) * cookedFactor(k), 0) - Math.min(water, liquid);
  }
  return Math.round(total / Math.max(1, serves));
}

/** The portion text with `{grams}` replaced by the portion weight, rounded to 10 g. */
export const plateText = (r: Pick<Recipe, 'plate' | 'grams'>) => r.plate.replace('{grams}', String(Math.round(r.grams / 10) * 10));

/** Everything worked out from a recipe's ingredients rather than typed. */
export type Derived = Macros & { prod: number; grams: number };

/** A recipe with its macros, produce servings and portion weight worked out from its ingredients (library, AI and saved recipes alike). */
export const withMacros = <T extends Omit<Recipe, keyof Derived>>(r: T): T & Derived => ({
  ...r,
  ...macrosOf(r.ing, r.serves),
  prod: produceOf(r.ing, r.serves),
  grams: portionGrams(r.ing, r.serves, r.yieldG),
});
