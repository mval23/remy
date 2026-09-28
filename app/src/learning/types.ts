import type { Confidence } from '../profile/profile';

export type MealRating = 'loved' | 'fine' | 'no';
export type SweetPortion = 'more' | 'less';
/** yes = try it once, no = not this time, stop = never ask about this food again. */
export type Noticed = 'yes' | 'no' | 'stop';

/** Something Remy learned after the interview. Deleting it reverses its effect. */
export interface LearnedItem {
  id: string;
  text: string;
  src: string;
  conf: Confidence;
  at: number;
  /** Score change applied to a recipe, reversed on delete. */
  recipe?: string;
  adj?: number;
  /** Other effects to reverse on delete. */
  effect?: 'hungry' | 'sweetPortion' | 'trial' | 'noticed';
  /** The food a trial or “stop asking” item is about. */
  food?: string;
}

/** The weekly check-in while it's being filled in. */
export interface CheckinDraft {
  /** Rating per recipe id. */
  rated: Record<string, MealRating>;
  /** Optional reasons for “Not again”, per recipe id. */
  why: Record<string, string[]>;
  /** Short questions (sweet, prep, try, hunger, energy, fit), by id. */
  q: Record<string, string>;
  /** Optional weekly weight, as typed. */
  weight: string;
  unit: 'lb' | 'kg';
  /** The later interview question answered during this check-in (one per week). */
  later?: string;
}

export const emptyCheckin = (): CheckinDraft => ({ rated: {}, why: {}, q: {}, weight: '', unit: 'lb' });

/** One body check-in. Weight is optional and shown only as a trend. */
export interface ProgressEntry {
  at: number;
  hunger?: string;
  energy?: string;
  fit?: string;
  weight?: number;
  unit?: 'lb' | 'kg';
}
