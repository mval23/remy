export type Slot = 'Breakfast' | 'Lunch' | 'Afternoon snack' | 'Dinner' | 'Evening sweet';
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type Lane = 'hands' | 'oven' | 'stove' | 'chill';
export type Variety = 'favorites' | 'balanced' | 'variety';
/**
 * Food-safety risks that matter more for some people (see `profile/screen.ts`):
 * an egg sauce that doesn't fully cook, an egg with a runny yolk, fresh cheese served unheated.
 */
export type Risk = 'raw-egg' | 'soft-egg' | 'fresh-cheese';

export const SLOTS: Slot[] = ['Breakfast', 'Lunch', 'Afternoon snack', 'Dinner', 'Evening sweet'];
export const SLOT_SHORT: Record<Slot, string> = {
  Breakfast: 'Breakfast',
  Lunch: 'Lunch',
  'Afternoon snack': 'Snack',
  Dinner: 'Dinner',
  'Evening sweet': 'Sweet',
};
export const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_FULL: Record<Day, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

/** Nutrients per 100 g/ml or per unit. Sugar, saturated fat and sodium come with matched data. */
export interface Nutrients {
  pro: number;
  carb: number;
  fat: number;
  fiber: number;
  sugar?: number;
  satFat?: number;
  sodiumMg?: number;
}

/** A nutrient source: a USDA FoodData Central food (`id` = its FDC ID) or the label of the package the owner buys. */
export interface NutrientSource {
  kind: 'fdc' | 'label';
  id?: string;
  /** e.g. 'FDC SR Legacy 2018-04' or 'label 2026-10'. */
  version: string;
}

export interface Ingredient {
  n: string;
  /** Unit for quantities ('' means a count). */
  u: string;
  /** Price per unit in USD, when sold loose. */
  p?: number;
  /** Package size in units, price and name, when sold in packs. */
  pk?: number;
  pp?: number;
  pkn?: string;
  sec: string;
  /** Allergen and diet tags, e.g. 'shellfish', 'dairy', 'meat'. */
  alg?: string[];
  /**
   * Allergens it often carries by cross-contact or depending on the brand (sesame on buns, gluten in oats).
   * Blocked only for people who chose the stricter allergy rule; Remy can't see factory lines.
   */
  may?: string[];
  /** Hidden components, so typed-in allergies match them ("egg", "mustard" in mayonnaise). */
  parts?: string[];
  /** What to check on the package. `for` = the tags that make it matter (allergy, diet or 'halal' / 'kosher'); none = everyone. */
  label?: { note: string; for?: string[] }[];
  /** Pantry answer that means the user already has it. */
  pan?: string;
  /** Food key from the interview ratings. */
  f?: string;
  /**
   * Grams of protein, carbohydrate (total, fiber included), fat and fiber per 100 g or 100 ml (for g/ml units),
   * otherwise per one unit. Where they come from is in `src`.
   */
  m: Nutrients;
  /** Where the nutrient values come from. Missing = Remy's rough estimate (USDA-style values from memory, not yet matched). */
  src?: NutrientSource;
  /** Grams per unit, for anything not measured in g or ml: the edible part of produce, drained weight of beans and tuna. */
  gpu?: number;
  /** How the amount is measured: raw meat and potatoes, dry grains and pasta, drained cans. Missing = as sold. */
  state?: 'raw' | 'dry' | 'drained';
  /**
   * Share of its weight that counts as fruit or vegetables (80 g = 1 serving). Missing = 0. Potatoes, yuca and
   * plantains don't count (starchy staples); beans and tomato sauces do.
   */
  veg?: number;
  /** Days a fresh item keeps from the fresh shop, for items a dish uses raw on the day (`Recipe.fresh`). */
  shelf?: number;
  /** Kept so older saved recipes still read; library recipes don't use it and the AI isn't offered it. */
  retired?: boolean;
  /** Food-safety risks this ingredient brings to any recipe, unless the recipe cooks them away (`Recipe.cooks`). */
  risk?: Risk[];
}

export interface Task {
  t: string;
  l: Lane;
  /** Minutes. */
  m: number;
  /** Oven temperature in °C. */
  temp?: number;
  /** Sheet pans used in the oven (default 1; the oven holds 2). */
  pans?: number;
  /** Tasks with the same key are shared between recipes (e.g. one pot of rice). */
  key?: string;
  /** Packing-phase task, done after cooking. */
  end?: boolean;
  /**
   * Detailed instructions, one step per line. Amounts come from the recipe’s ingredients, scaled to the week:
   * {k} = amount and name ("570 g boneless chicken breasts"), {k:q} = amount only ("570 g"),
   * {k*0.5} or {k*0.5:q} = a share of it, {k*1.6:ml} = the amount in another unit (e.g. water for rice).
   */
  how?: string[];
  /** Equipment this task needs, for the “before you start” list. */
  gear?: string[];
}

export interface StorageInfo {
  k: 'fridge' | 'freezer' | 'room' | 'unsafe' | 'none';
  l: string;
  thaw?: string;
}

/** A suggested swap. `out` = the ingredient it replaces; `in` = the ingredients that come in ([] = leave it out), the closest match in `ING`, so the allergy, diet and taste checks can test it. */
export interface Sub {
  from: string;
  to: string;
  out: string;
  in: string[];
}

export interface Recipe {
  id: string;
  name: string;
  short: string;
  slot: Slot | 'Side';
  e: string;
  /** Portions per batch. */
  serves: number;
  /** Portioned as whole items (a burrito, a fillet, a sandwich): never scaled to fit goals, since 80% of a tortilla isn't a thing. */
  whole?: boolean;
  /** The most days a week Remy plans it on its own (heavy dishes like bandeja paisa). The person can still choose it more. */
  maxPerWeek?: number;
  /** Fresh ingredients used raw on the day it's eaten (avocado, lettuce, berries): they must still be good that day. */
  fresh?: string[];
  /** Safe days in the fridge after prep day. */
  fridge: number;
  /** Months in the freezer for best quality (0 = don't freeze). */
  freezer: number;
  cold?: boolean;
  /** Keeps at room temperature (up to `fridge` days). */
  room?: boolean;
  /** Store-bought, no prep. */
  store?: boolean;
  /** Foods from the interview ratings; a string names the preparation used. */
  foods: Record<string, 1 | string>;
  sauces?: string[];
  sweet?: string[];
  /** [ingredient key, quantity per batch] */
  ing: [string, number][];
  why: string[];
  note?: string;
  steps: string[];
  reheat: string;
  thaw?: string;
  tasks: Task[];
  /** Swaps the recipe page suggests; each is checked against the person's rules before it's shown (`planning/subs.ts`). */
  subs?: Sub[];
  /** Food-safety risks from how the dish is made (e.g. carbonara's egg sauce). */
  risk?: Risk[];
  /** Ingredient risks the method removes (e.g. pandebono bakes its queso fresco). */
  cooks?: Risk[];
  kcal: number;
  /** Protein grams per portion (estimate). kcal, pro, carb and fat are added up from the ingredients (see macros.ts). */
  pro: number;
  /** Carbohydrate grams per portion (estimate). */
  carb: number;
  /** Fat grams per portion (estimate). */
  fat: number;
  /** Fiber grams per portion (estimate, one decimal). */
  fiber: number;
  /** Fruit and vegetable servings per portion (80 g each), worked out from the ingredients' `veg` share. */
  prod: number;
  /** Cooked grams per portion: the weighed batch (`yieldG`) when known, otherwise estimated from the ingredients. */
  grams: number;
  /** The whole cooked batch, weighed in a kitchen test. */
  yieldG?: number;
  /** Portion guidance in plain words. `{grams}` becomes the portion weight, rounded to 10 g. */
  plate: string;
  /* sides only */
  side?: boolean;
  kind?: 'protein' | 'produce';
  for?: Slot[];
  best?: Slot[];
  veg?: boolean;
  /** Fixed storage label for store-bought or cook-fresh sides. */
  st?: StorageInfo;
}

export interface Meal {
  r?: string | null;
  ok?: boolean;
  side?: string;
  /** Eaten away from home. */
  out?: boolean;
  /** No sweet planned this day (sweet frequency). */
  skip?: boolean;
  /** Slot needs a choice: nothing in the library fits. */
  need?: boolean;
  /** A dinner eaten at lunch (or a lunch at dinner): nothing for this meal fits and keeps until this day, so a freezer-friendly main from the other meal fills it. */
  borrowed?: boolean;
  /** Portion size when fitted to the person's goals: 0.8–1.2 of the recipe's portion (missing = 1). Main meals only. */
  x?: number;
}

export interface PlanDay {
  d: Day;
  meals: Partial<Record<Slot, Meal>>;
}

export type WeekPlan = PlanDay[];
