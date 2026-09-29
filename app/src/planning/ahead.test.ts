import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { applyCheckin } from '../learning/learning';
import { upcomingReminders } from '../reminders/reminders';
import { defaultReminderSettings } from '../reminders/reminders';
import { emptyPlanState } from '../storage/planState';
import { AHEAD_WEEKS, approvedCount, planAhead, weekStatus } from './ahead';
import { dayDate, lastOn, longDate, monthCalendar, monthRunDate, monthsText, nextJobs, rangeText, shortDate, weekDates, type ShopDays } from './calendar';
import { meatOf } from './month';
import { approveAll, buildPlan, eachMeal, setApproved } from './planner';
import { context } from './rules';
import type { WeekPlan } from './types';

const A = activeAnswers(fillWithSamples(emptyInterview())); // prep day Sunday
const ctx = context(A);
const plan = buildPlan('balanced', ctx).plan;
const noGoals = { kcal: null, pro: null };
// Tuesday 29 September 2026; the week was planned that day, so it's cooked Sunday 4 October.
const now = new Date(2026, 8, 29, 12);
const planned = now.getTime();
const shop: ShopDays = { month: 'Wed', fresh: 'Fri' };
const ymd = (d: Date | null) => (d ? `${d.getMonth() + 1}/${d.getDate()}` : null);

describe('planning a month ahead', () => {
  it('drafts the next weeks, each rotating from the one before', () => {
    const ahead = planAhead(plan, [], 'balanced', ctx, noGoals);
    expect(ahead).toHaveLength(AHEAD_WEEKS);
    for (const w of ahead) expect(weekStatus(w)).toBe('draft');
    expect(ahead).toEqual(planAhead(plan, [], 'balanced', ctx, noGoals));
  });

  it('keeps meals approved ahead of time when the drafts are rebuilt', () => {
    const ahead = planAhead(plan, [], 'balanced', ctx, noGoals);
    const second = approveAll(ahead[1]);
    const rebuilt = planAhead(plan, [ahead[0], second, ahead[2]], 'balanced', ctx, noGoals);
    expect(rebuilt[1]).toEqual(second);
    expect(weekStatus(rebuilt[1])).toBe('approved');
    expect(weekStatus(setApproved(ahead[0], 0, 'Lunch', true))).toBe('some');
  });

  it('a check-in makes next week the current one, keeping what was approved ahead, and drafts a new last week', () => {
    const ahead = planAhead(plan, [], 'balanced', ctx, noGoals);
    const early = setApproved(ahead[0], 2, 'Dinner', true);
    const state = { ...emptyPlanState(), plan, ahead: [early, ahead[1], ahead[2]], variety: 'balanced' as const };
    const { next, changes } = applyCheckin(state, A, planned);
    expect(next.plan![2].meals.Dinner).toEqual(early[2].meals.Dinner);
    expect(next.ahead).toHaveLength(AHEAD_WEEKS);
    expect(changes.join(' ')).toContain('Keep the 1 meal you approved ahead');
    expect(approvedCount(next.plan!)).toBe(1);
  });

  it('still works for a week without weeks ahead (older saved data)', () => {
    const { next } = applyCheckin({ ...emptyPlanState(), plan, variety: 'balanced' }, A, planned);
    expect(next.plan).toHaveLength(7);
    expect(next.ahead).toEqual([]);
  });
});

describe('dates, shopping days and thawing', () => {
  it('finds the last given weekday on or before a date', () => {
    expect(ymd(lastOn('Wed', new Date(2026, 9, 4)))).toBe('9/30');
    expect(ymd(lastOn('Sun', new Date(2026, 9, 4)))).toBe('10/4');
  });

  it('dates each week from prep day, with the fresh shop before it', () => {
    const w0 = weekDates(A, planned, 0, shop, true, now);
    expect(ymd(w0.prep)).toBe('10/4');
    expect(ymd(w0.start)).toBe('10/5');
    expect(ymd(w0.end)).toBe('10/11');
    expect(ymd(w0.fresh)).toBe('10/2');
    const w2 = weekDates(A, planned, 2, shop, true, now);
    expect(ymd(w2.prep)).toBe('10/18');
    expect(ymd(w2.fresh)).toBe('10/16');
  });

  it('buys all the month’s meat on the monthly shop before the first prep day, and thaws it two evenings before each prep', () => {
    expect(ymd(monthRunDate(A, planned, shop, now))).toBe('9/30');
    const w0 = weekDates(A, planned, 0, shop, true, now);
    expect(w0.meatFrom).toBe('month');
    expect(ymd(w0.meatBought)).toBe('9/30');
    expect(ymd(w0.thaw)).toBe('10/2');
    expect(ymd(weekDates(A, planned, 3, shop, true, now).thaw)).toBe('10/23');
  });

  it('needs no thawing when the meat is bought within 2 days of prep day', () => {
    const w0 = weekDates(A, planned, 0, { month: null, fresh: 'Sat' }, false, now);
    expect(w0.meatFrom).toBe('fresh');
    expect(w0.thaw).toBeNull();
    expect(weekDates(A, planned, 0, { month: null, fresh: 'Wed' }, false, now).thaw).not.toBeNull();
    expect(weekDates(A, planned, 0, { month: null, fresh: null }, false, now).meatFrom).toBeNull();
  });

  it('lays the weeks out on a Monday-first calendar with every day’s job', () => {
    const outs = [plan, ...planAhead(plan, [], 'balanced', ctx, noGoals)].map((w) => w.map((d) => Object.values(d.meals).some((m) => m?.out)));
    const days = monthCalendar(A, planned, 4, shop, true, outs, now);
    expect(days.length % 7).toBe(0);
    expect(days[0].date.getDay()).toBe(1);
    const on = (m: number, d: number) => days.find((x) => x.date.getMonth() === m && x.date.getDate() === d)!;
    expect(on(8, 29).today).toBe(true);
    expect(on(8, 30).marks).toContain('month');
    expect(on(9, 2).marks).toEqual(expect.arrayContaining(['fresh', 'thaw']));
    expect(on(9, 4).marks).toContain('prep');
    expect(on(9, 5)).toMatchObject({ w: 0, i: 0 });
    expect(on(9, 12)).toMatchObject({ w: 1, i: 0 });
    expect(on(8, 29).w).toBe(-1);
  });
});

describe('reminders for the month', () => {
  const ahead = planAhead(plan, [], 'balanced', ctx, noGoals);
  const list = upcomingReminders(plan, A, planned, defaultReminderSettings(), now, { ahead, shopDays: shop, monthly: true });

  it('reminds on the monthly shop and this week’s fresh shop', () => {
    const shops = list.filter((r) => r.kind === 'shop');
    expect(shops.map((r) => ymd(new Date(r.at)))).toEqual(['9/30', '10/2']);
    expect(shops[0].title).toBe('Monthly shop');
  });

  it('reminds to thaw each week’s meat two evenings before its prep day, naming the meat', () => {
    const meat = list.filter((r) => r.kind === 'meat');
    expect(meat.map((r) => ymd(new Date(r.at)))).toEqual(['10/2', '10/9', '10/16', '10/23']);
    const first = meatOf(plan, A)[0];
    expect(meat[0].body).toContain(first.n.toLowerCase());
    expect(new Date(meat[0].at).getHours()).toBe(20);
  });

  it('adds nothing new without shopping days, as before', () => {
    const plain = upcomingReminders(plan, A, planned, defaultReminderSettings(), now);
    expect(plain.some((r) => r.kind === 'shop' || r.kind === 'meat')).toBe(false);
  });

  it('lists each week’s meat, largest first', () => {
    const meat = meatOf(plan, A);
    expect(meat.length).toBeGreaterThan(0);
    const inPlan = new Set<string>();
    eachMeal(plan as WeekPlan, (m) => m.r && inPlan.add(m.r));
    for (let i = 1; i < meat.length; i++) expect(meat[i].q).toBeLessThanOrEqual(meat[i - 1].q);
  });
});

describe('dates in words', () => {
  it('writes short dates, ranges and month names the same way everywhere', () => {
    expect(shortDate(new Date(2026, 9, 5))).toBe('5 Oct');
    expect(dayDate(new Date(2026, 8, 30))).toBe('Wed 30 Sep');
    expect(longDate(new Date(2026, 9, 5))).toBe('Monday 5 October');
    expect(rangeText(new Date(2026, 9, 5), new Date(2026, 9, 11))).toBe('5–11 Oct');
    expect(rangeText(new Date(2026, 9, 26), new Date(2026, 10, 1))).toBe('26 Oct – 1 Nov');
    expect(monthsText(new Date(2026, 9, 4), new Date(2026, 10, 1))).toBe('October – November');
  });
});

describe('what to do next', () => {
  it('lists the jobs before prep day in order, from today', () => {
    const jobs = nextJobs(A, planned, shop, true, now).map((j) => `${j.job} ${ymd(j.date)}`);
    expect(jobs).toEqual(['month 9/30', 'fresh 10/2', 'thaw 10/2', 'prep 10/4']);
    const later = nextJobs(A, planned, shop, true, new Date(2026, 9, 3, 9)).map((j) => j.job);
    expect(later).toEqual(['prep']);
    expect(nextJobs(A, planned, { month: null, fresh: null }, false, now).map((j) => j.job)).toEqual(['prep']);
  });
});
