import { emptyCheckin, type CheckinDraft, type LearnedItem, type Noticed, type ProgressEntry, type SweetPortion } from '../learning/types';
import { emptyGroceryEdits, type GroceryEdits } from '../planning/grocery';
import type { ShopMode } from '../planning/month';
import { noShopDays, type ShopDays } from '../planning/calendar';
import { defaultNutrition, type NutritionSettings } from '../planning/nutrition';
import type { Recipe, Variety, WeekPlan } from '../planning/types';
import { migrateRecipe } from '../planning/units';
import { defaultReminderSettings, type ReminderSettings } from '../reminders/reminders';

/** Everything about the current week and what Remy has learned, apart from the interview. */
export interface PlanState {
  plan: WeekPlan | null;
  /** The weeks planned after this one (a month ahead with this one). Approved meals stay; the rest are drafts. */
  ahead: WeekPlan[];
  variety: Variety | null;
  /** Day selected in the planner (0–6). */
  day: number;
  /** Meal recipes from the previous week; new weeks rotate some of them out. */
  recent: string[];
  /** When the current week was planned (0 = before weeks were tracked). Grocery check-offs belong to one week. */
  weekStartedAt: number;
  groceries: GroceryEdits;
  nutrition: NutritionSettings;
  /** Score adjustments from feedback and rejected meals, by recipe id. */
  adj: Record<string, number>;
  /** Raises protein targets; set by weekly check-ins. */
  hungry: boolean;
  /** How the evening sweet portion felt, from check-ins. */
  sweetPortion: SweetPortion | null;
  /** Everything Remy learned after the interview, newest first. */
  learned: LearnedItem[];
  /** Inferences from the interview that the user deleted. */
  hiddenInferences: Record<string, boolean>;
  /** Answers to “Remy noticed” suggestions, by food. */
  noticed: Record<string, Noticed>;
  /** A side to try once in the next week, by recipe id. */
  trial: string | null;
  /** The weekly check-in being filled in. */
  checkin: CheckinDraft;
  /** Body check-ins, newest first. */
  progress: ProgressEntry[];
  /** Recipes created by the AI and kept by the user, by id (ai_…). */
  aiRecipes: Record<string, Recipe>;
  /** The user read what the AI sends where, and turned it on. */
  aiConsent: boolean;
  /** Which reminders to send, and when. */
  reminders: ReminderSettings;
  /** Cook-mode steps ticked off, for the week planned at `week` (a new week starts fresh). */
  prepDone: { week: number; done: Record<string, true> };
  /** Shop weekly for everything, or monthly for what keeps and weekly for fresh food. */
  shopping: ShopMode;
  /** The monthly shop: when it started and the user's edits (check-offs carry across weeks until a new month). */
  month: { startedAt: number; edits: GroceryEdits };
  /** Shopping days: the monthly shop (meat and staples) and the weekly fresh-food shop. */
  shopDays: ShopDays;
  /** Set once saved AI recipes are in metric units; missing on data from earlier versions. */
  units?: 'metric';
}

export const emptyPlanState = (): PlanState => ({
  plan: null,
  ahead: [],
  variety: null,
  day: 0,
  recent: [],
  weekStartedAt: 0,
  groceries: emptyGroceryEdits(),
  nutrition: defaultNutrition(),
  adj: {},
  hungry: false,
  sweetPortion: null,
  learned: [],
  hiddenInferences: {},
  noticed: {},
  trial: null,
  checkin: emptyCheckin(),
  progress: [],
  aiRecipes: {},
  aiConsent: false,
  reminders: defaultReminderSettings(),
  prepDone: { week: 0, done: {} },
  shopping: 'weekly',
  month: { startedAt: 0, edits: emptyGroceryEdits() },
  shopDays: noShopDays(),
});

/**
 * Fill in fields added since a copy was saved (older devices, the cloud, backups),
 * and convert AI recipes saved in US units before Remy went metric.
 */
export function normalizePlanState(p: Partial<PlanState> | null | undefined): PlanState {
  const s: PlanState = { ...emptyPlanState(), ...p };
  if (s.units === 'metric') return s;
  return { ...s, units: 'metric', aiRecipes: Object.fromEntries(Object.entries(s.aiRecipes).map(([id, r]) => [id, migrateRecipe(r)])) };
}
