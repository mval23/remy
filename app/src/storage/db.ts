import Dexie, { type Table } from 'dexie';
import { emptyInterview, type InterviewState } from '../interview/types';
import { emptyGroceryEdits, type GroceryEdits } from '../planning/grocery';
import { defaultNutrition, type NutritionSettings } from '../planning/nutrition';
import type { Variety, WeekPlan } from '../planning/types';

/**
 * On-device storage (IndexedDB, through Dexie).
 * Data stays in this browser. Cloud sync comes in a later phase.
 */
interface Row {
  id: string;
  value: unknown;
}

class RemyDB extends Dexie {
  kv!: Table<Row, string>;
  constructor() {
    super('remy');
    this.version(1).stores({ kv: 'id' });
  }
}

export const db = new RemyDB();

/** Everything about the current week, apart from the interview. */
export interface PlanState {
  plan: WeekPlan | null;
  variety: Variety | null;
  /** Day selected in the planner (0–6). */
  day: number;
  groceries: GroceryEdits;
  nutrition: NutritionSettings;
  /** Score adjustments from rejected meals, by recipe id. */
  adj: Record<string, number>;
  /** Raises protein targets; set later by weekly check-ins. */
  hungry: boolean;
}

export const emptyPlanState = (): PlanState => ({
  plan: null,
  variety: null,
  day: 0,
  groceries: emptyGroceryEdits(),
  nutrition: defaultNutrition(),
  adj: {},
  hungry: false,
});

const INTERVIEW = 'interview';
const PLAN = 'plan';

async function load<T>(id: string, empty: () => T): Promise<T> {
  try {
    const row = await db.kv.get(id);
    return row ? { ...empty(), ...(row.value as T) } : empty();
  } catch {
    // Storage can be blocked (private windows, strict settings). The app still works for this visit.
    return empty();
  }
}

async function save(id: string, value: unknown): Promise<void> {
  try {
    await db.kv.put({ id, value });
  } catch {
    /* see load */
  }
}

export const loadInterview = () => load<InterviewState>(INTERVIEW, emptyInterview);
export const saveInterview = (s: InterviewState) => save(INTERVIEW, s);
export const loadPlanState = () => load<PlanState>(PLAN, emptyPlanState);
export const savePlanState = (s: PlanState) => save(PLAN, s);

export async function deleteEverything(): Promise<void> {
  try {
    await db.kv.clear();
  } catch {
    /* see load */
  }
}
