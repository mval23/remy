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

/* ---------- a month ahead: weeks, shopping days and thawing ---------- */

/**
 * The person's shopping days. `month`: the monthly shop (meat to freeze and staples) before the first prep day of
 * the month; `fresh`: the weekly shop for fresh food (produce, dairy, bread) before each prep day. Null = not set.
 */
export interface ShopDays {
  month: Day | null;
  fresh: Day | null;
}
export const noShopDays = (): ShopDays => ({ month: null, fresh: null });

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const daysBetween = (a: Date, b: Date) => Math.round((midnight(b).getTime() - midnight(a).getTime()) / DAY_MS);

/** The last `day` on or before `date` (the same day counts). */
export function lastOn(day: Day, date: Date): Date {
  const d = midnight(date);
  return addDays(d, -((mondayFirst(d) - DAYS.indexOf(day) + 7) % 7));
}

/** Raw meat keeps 1–2 days in the fridge: bought earlier than this before prep day, it's frozen and thawed. */
export const FRIDGE_DAYS_RAW_MEAT = 2;

export interface WeekDates {
  /** 0 = this week, 1 = next week… */
  w: number;
  /** Prep day, and the first and last day the food is eaten. */
  prep: Date;
  start: Date;
  end: Date;
  /** Weekly fresh-food shop (null when no day is set). */
  fresh: Date | null;
  /** Where this week's meat comes from: the monthly shop, the weekly shop, or not planned (no days set). */
  meatFrom: 'month' | 'fresh' | null;
  /** When the meat was bought, if known. */
  meatBought: Date | null;
  /** Evening to move the frozen meat to the fridge (null when it's bought close enough to prep day). */
  thaw: Date | null;
}

/**
 * Dates for week `w`: prep day, the days it's eaten, the shopping days and, when the meat was bought more than
 * 2 days before prep day, the evening two days before prep to move it from the freezer to the fridge
 * (about 24 hours thaws 2 kg). Monthly shoppers buy all the month's meat on the monthly shop before week 0's prep day.
 */
export function weekDates(A: Answers, weekStartedAt: number, w: number, shop: ShopDays, monthly: boolean, now = new Date()): WeekDates {
  const start = addDays(weekStart(A, weekStartedAt, now), 7 * w);
  const prep = addDays(start, -1);
  const fresh = shop.fresh ? lastOn(shop.fresh, prep) : null;
  const monthRun = monthly && shop.month ? lastOn(shop.month, addDays(weekStart(A, weekStartedAt, now), -1)) : null;
  const meatBought = monthly ? monthRun : fresh;
  const meatFrom = monthly ? (shop.month ? 'month' : null) : fresh ? 'fresh' : null;
  const thaw = meatBought && daysBetween(meatBought, prep) > FRIDGE_DAYS_RAW_MEAT ? addDays(prep, -2) : null;
  return { w, prep, start, end: addDays(start, 6), fresh, meatFrom, meatBought, thaw };
}

/** The monthly shop's date: the monthly shopping day before this week's prep day (null when not set). */
export function monthRunDate(A: Answers, weekStartedAt: number, shop: ShopDays, now = new Date()): Date | null {
  return shop.month ? lastOn(shop.month, addDays(weekStart(A, weekStartedAt, now), -1)) : null;
}

export type DayMark = 'month' | 'fresh' | 'thaw' | 'prep' | 'out';

export interface CalendarDay {
  date: Date;
  /** Planned week it belongs to (−1 = outside the planned weeks), and its plan day (0–6). */
  w: number;
  i: number;
  marks: DayMark[];
  today: boolean;
}

/**
 * The planned weeks as calendar rows, Monday first: every day from the Monday on or before the first prep day to
 * the Sunday on or after the last planned day, with what happens that day. `outs[w][i]` is true for a meal out.
 */
export function monthCalendar(A: Answers, weekStartedAt: number, weeks: number, shop: ShopDays, monthly: boolean, outs: boolean[][], now = new Date()): CalendarDay[] {
  const dates = Array.from({ length: weeks }, (_, w) => weekDates(A, weekStartedAt, w, shop, monthly, now));
  const first = midnight(dates[0].prep);
  const from = addDays(first, -mondayFirst(first));
  const last = dates[weeks - 1].end;
  const to = addDays(last, 6 - mondayFirst(last));
  const run = monthly ? monthRunDate(A, weekStartedAt, shop, now) : null;
  const same = (a: Date | null, b: Date) => !!a && daysBetween(a, b) === 0;
  const out: CalendarDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wk = dates.findIndex((x) => d >= x.start && d <= x.end);
    const i = wk >= 0 ? daysBetween(dates[wk].start, d) : -1;
    const marks: DayMark[] = [];
    if (same(run, d)) marks.push('month');
    if (dates.some((x) => same(x.fresh, d))) marks.push('fresh');
    if (dates.some((x) => same(x.thaw, d))) marks.push('thaw');
    if (dates.some((x) => same(x.prep, d))) marks.push('prep');
    if (wk >= 0 && outs[wk]?.[i]) marks.push('out');
    out.push({ date: d, w: wk, i, marks, today: same(now, d) });
  }
  return out;
}

/** A date at a time of day given as "HH:MM". */
export function at(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export type Job = 'month' | 'fresh' | 'thaw' | 'prep';

/**
 * What's left to do before this week's food is ready, in order, from today: the monthly shop, the fresh-food shop,
 * moving the meat to the fridge, and prep day. Jobs earlier than today are left out.
 */
export function nextJobs(A: Answers, weekStartedAt: number, shop: ShopDays, monthly: boolean, now = new Date()): { job: Job; date: Date }[] {
  const d = weekDates(A, weekStartedAt, 0, shop, monthly, now);
  const run = monthly ? monthRunDate(A, weekStartedAt, shop, now) : null;
  const all: { job: Job; date: Date | null }[] = [
    { job: 'month', date: run },
    { job: 'fresh', date: d.fresh },
    { job: 'thaw', date: d.thaw },
    { job: 'prep', date: d.prep },
  ];
  const today = midnight(now);
  return all
    .filter((x): x is { job: Job; date: Date } => !!x.date && x.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || ['month', 'fresh', 'thaw', 'prep'].indexOf(a.job) - ['month', 'fresh', 'thaw', 'prep'].indexOf(b.job));
}

/* ---------- dates in words (English, day before month: "5 Oct"), the same on every device ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const mon = (d: Date) => MONTHS[d.getMonth()].slice(0, 3);
/** "5 Oct" */
export const shortDate = (d: Date) => `${d.getDate()} ${mon(d)}`;
/** "Wed 30 Sep" */
export const dayDate = (d: Date) => `${WEEKDAYS[d.getDay()].slice(0, 3)} ${shortDate(d)}`;
/** "Monday 5 October" */
export const longDate = (d: Date) => `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
/** "5–11 Oct", or "26 Oct – 1 Nov" across months. */
export function rangeText(a: Date, b: Date): string {
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${shortDate(b)}` : `${shortDate(a)} – ${shortDate(b)}`;
}
/** "October", or "October – November" when the weeks cross into the next month. */
export function monthsText(a: Date, b: Date): string {
  return a.getMonth() === b.getMonth() ? MONTHS[a.getMonth()] : `${MONTHS[a.getMonth()]} – ${MONTHS[b.getMonth()]}`;
}
