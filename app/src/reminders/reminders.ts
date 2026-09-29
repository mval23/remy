import type { Answers } from '../interview/types';
import { listText } from '../interview/helpers';
import { at, dateOfDay, monthRunDate, weekDates, type ShopDays } from '../planning/calendar';
import { meatOf } from '../planning/month';
import { R } from '../planning/data/recipes';
import { storage } from '../planning/rules';
import { duration, schedule } from '../planning/schedule';
import { DAY_FULL, DAYS, SLOTS, type WeekPlan } from '../planning/types';

/**
 * Reminders for the planned week. Pure: the same list feeds phone notifications and the calendar file.
 * - Prep day: the morning the week's food is cooked (the day before plan day 0).
 * - Thaw: the evening before a day with frozen meals that thaw overnight.
 * - Check-in: the morning of the day before the next prep day, so the new grocery list is ready to shop.
 * - Shopping (with shopping days set): the morning of the monthly shop and of this week's fresh-food shop.
 * - Meat: two evenings before a prep day whose meat was bought days earlier and frozen, to thaw it in the fridge.
 */

export interface ReminderSettings {
  prep: boolean;
  thaw: boolean;
  checkin: boolean;
  /** Shopping-day mornings (missing on older copies = on). */
  shop?: boolean;
  /** "HH:MM" for prep-day and check-in reminders. */
  morning: string;
  /** "HH:MM" for thaw reminders. */
  evening: string;
  /** Send them as phone notifications to devices that allowed it (needs sign-in). */
  push: boolean;
}

export const defaultReminderSettings = (): ReminderSettings => ({ prep: true, thaw: true, checkin: true, morning: '09:00', evening: '20:00', push: false });

export type ReminderKind = 'prep' | 'thaw' | 'checkin' | 'shop' | 'meat';

export interface Reminder {
  kind: ReminderKind;
  /** When to remind, in ms since 1970. */
  at: number;
  title: string;
  body: string;
  /** Opens this screen when tapped (see `openParam`). */
  url: string;
  /** One per kind and day, so a newer version replaces an older notification. */
  tag: string;
}

/** Frozen meals on plan day `i` that should move to the fridge the night before. */
export function thawFor(plan: WeekPlan, i: number): string[] {
  const day = plan[i];
  if (!day) return [];
  const out: string[] = [];
  for (const slot of SLOTS) {
    const r = day.meals[slot]?.r ? R[day.meals[slot]!.r!] : null;
    if (r && storage(r, i + 1).k === 'freezer' && r.thaw?.includes('night before') && !out.includes(r.short.toLowerCase())) out.push(r.short.toLowerCase());
  }
  return out;
}

const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Reminders still ahead of `now`, in time order. */
export interface MonthOptions {
  /** The weeks planned after this one. */
  ahead?: WeekPlan[];
  shopDays?: ShopDays;
  /** Shopping monthly for meat and staples. */
  monthly?: boolean;
}

export function upcomingReminders(plan: WeekPlan, A: Answers, weekStartedAt: number, s: ReminderSettings, now = new Date(), month: MonthOptions = {}): Reminder[] {
  const out: Reminder[] = [];
  const add = (kind: ReminderKind, when: Date, title: string, body: string, url: string) => {
    if (when.getTime() > now.getTime()) out.push({ kind, at: when.getTime(), title, body, url, tag: `${kind}-${dateKey(when)}` });
  };

  if (s.prep) {
    const total = schedule(plan, A).total;
    add('prep', at(dateOfDay(A, weekStartedAt, -1, now), s.morning), 'Prep day', `About ${duration(total)} of cooking planned. Your timeline and grocery list are ready.`, 'prep');
  }
  if (s.thaw)
    for (let i = 1; i < plan.length; i++) {
      const items = thawFor(plan, i);
      if (items.length) add('thaw', at(dateOfDay(A, weekStartedAt, i - 1, now), s.evening), 'Tonight: thaw for tomorrow', `Move ${listText(items)} from the freezer to the fridge.`, 'home');
    }
  if (s.checkin)
    add('checkin', at(dateOfDay(A, weekStartedAt, 5, now), s.morning), 'Weekly check-in', 'Rate this week’s meals, then Remy plans next week and your grocery list. About 2 minutes.', 'checkin');

  const shop = month.shopDays;
  if (shop) {
    const monthly = !!month.monthly;
    const weeks = [plan, ...(month.ahead ?? [])];
    const prepName = DAY_FULL[DAYS[(dateOfDay(A, weekStartedAt, -1, now).getDay() + 6) % 7]];
    if (s.shop !== false) {
      const run = monthly ? monthRunDate(A, weekStartedAt, shop, now) : null;
      if (run) add('shop', at(run, s.morning), 'Monthly shop', `Meat for ${weeks.length} weeks and staples. Freeze the meat when you get home, in bags labeled by prep day.`, 'grocery');
      const fresh = weekDates(A, weekStartedAt, 0, shop, monthly, now).fresh;
      if (fresh) add('shop', at(fresh, s.morning), 'Shopping day', `Fresh food for ${prepName}’s prep. Your list is ready.`, 'grocery');
    }
    if (s.thaw)
      weeks.forEach((wk, w) => {
        const d = weekDates(A, weekStartedAt, w, shop, monthly, now);
        const items = meatOf(wk, A);
        if (d.thaw && items.length)
          add('meat', at(d.thaw, s.evening), 'Tonight: thaw the meat', `For ${prepName}’s prep, move ${listText(items.map((x) => `${x.qtyText} ${x.n.toLowerCase()}`))} from the freezer to the fridge.`, 'home');
      });
  }

  return out.sort((a, b) => a.at - b.at);
}

/** Screens a reminder can open, passed as ?open=… */
export const OPENABLE = ['home', 'prep', 'checkin', 'grocery', 'planner'];
