export type Slot = 'Breakfast' | 'Lunch' | 'Afternoon snack' | 'Dinner' | 'Evening sweet';
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type Lane = 'hands' | 'oven' | 'stove' | 'chill';
export type Variety = 'favorites' | 'balanced' | 'variety';

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
  /** Pantry answer that means the user already has it. */
  pan?: string;
  /** Food key from the interview ratings. */
  f?: string;
}

export interface Task {
  t: string;
  l: Lane;
  /** Minutes. */
  m: number;
  /** Oven temperature in °F. */
  temp?: number;
  /** Sheet pans used in the oven (default 1; the oven holds 2). */
  pans?: number;
  /** Tasks with the same key are shared between recipes (e.g. one pot of rice). */
  key?: string;
  /** Packing-phase task, done after cooking. */
  end?: boolean;
}

export interface StorageInfo {
  k: 'fridge' | 'freezer' | 'room' | 'unsafe' | 'none';
  l: string;
  thaw?: string;
}

export interface Recipe {
  id: string;
  name: string;
  short: string;
  slot: Slot | 'Side';
  e: string;
  /** Portions per batch. */
  serves: number;
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
  /** [what, swap to, food key to check against ratings] */
  subs?: [string, string, string?][];
  kcal: number;
  /** Protein grams per portion (estimate). */
  pro: number;
  /** Fruit and vegetable servings per portion. */
  prod: number;
  /** Portion guidance in plain words. */
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
}

export interface PlanDay {
  d: Day;
  meals: Partial<Record<Slot, Meal>>;
}

export type WeekPlan = PlanDay[];
