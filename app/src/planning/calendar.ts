import { str } from '../interview/helpers';
import type { Answers } from '../interview/types';
import { weekDays } from './rules';
import { DAYS, type Day } from './types';

/**
 * Real calendar dates for a planned week.
 * A week is cooked on prep day and eaten on the 7 days after it (plan day 0 = the day after prep day).
 * A week planned at `weekStartedAt` (profile confirmed or check-in saved) is cooked on the first prep day
 * on or after that date. Weeks from before this existed (`weekStartedAt` 0) follow today's weekday.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const mondayFirst = (d: Date) => (d.getDay() + 6) % 7;

/** Local midnight of plan day 0. */
export function weekStart(A: Answers, weekStartedAt: number, now = new Date()): Date {
  const prep = DAYS.indexOf((str(A.prepday) || 'Sun') as Day);
  if (weekStartedAt > 0) {
    const d = midnight(new Date(weekStartedAt));
    d.setDate(d.getDate() + ((prep - mondayFirst(d) + 7) % 7) + 1);
    return d;
  }
  const today = midnight(now);
  today.setDate(today.getDate() - Math.max(0, weekDays(A).indexOf(DAYS[mondayFirst(now)])));
  return today;
}

/** Which plan day a date falls on: below 0 before the week starts (−1 is its prep day), above 6 after it ends. */
export function dayIndexOn(A: Answers, weekStartedAt: number, date = new Date()): number {
  return Math.round((midnight(date).getTime() - weekStart(A, weekStartedAt, date).getTime()) / DAY_MS);
}

/** Local midnight of plan day `i` (−1 = the prep day that cooks this week). */
export function dateOfDay(A: Answers, weekStartedAt: number, i: number, now = new Date()): Date {
  const d = weekStart(A, weekStartedAt, now);
  d.setDate(d.getDate() + i);
  return d;
}

/** A date at a time of day given as "HH:MM". */
export function at(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}
