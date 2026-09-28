import { emptyCheckin, type CheckinDraft, type LearnedItem, type Noticed, type ProgressEntry, type SweetPortion } from '../learning/types';
import { emptyGroceryEdits, type GroceryEdits } from '../planning/grocery';
import { defaultNutrition, type NutritionSettings } from '../planning/nutrition';
import type { Recipe, Variety, WeekPlan } from '../planning/types';

/** Everything about the current week and what Remy has learned, apart from the interview. */
export interface PlanState {
  plan: WeekPlan | null;
  variety: Variety | null;
  /** Day selected in the planner (0–6). */
  day: number;
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
}

export const emptyPlanState = (): PlanState => ({
  plan: null,
  variety: null,
  day: 0,
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
});

/** Fill in fields added since a copy was saved (older devices, the cloud, backups). */
export const normalizePlanState = (p: Partial<PlanState> | null | undefined): PlanState => ({ ...emptyPlanState(), ...p });
