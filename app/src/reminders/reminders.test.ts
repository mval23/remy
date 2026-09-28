import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview, type Answers } from '../interview/types';
import { checkinDue } from '../learning/learning';
import { dateOfDay, dayIndexOn, weekStart } from '../planning/calendar';
import { buildPlan } from '../planning/planner';
import { context } from '../planning/rules';
import { toIcs } from './ics';
import { defaultReminderSettings, thawFor, upcomingReminders } from './reminders';

/** The sample preps on Sunday. September 27, 2026 is a Sunday. */
const A: Answers = activeAnswers(fillWithSamples(emptyInterview()));
const d = (day: number, h = 12, m = 0) => new Date(2026, 8, day, h, m);
const ymd = (x: Date) => `${x.getMonth() + 1}/${x.getDate()}`;
const plan = buildPlan('balanced', context(A)).plan;

describe('week dates', () => {
  it('anchors a week planned on Saturday to the next day’s prep day', () => {
    const saved = d(26, 18).getTime();
    expect(ymd(weekStart(A, saved))).toBe('9/28');
    expect(dayIndexOn(A, saved, d(26))).toBe(-2);
    expect(dayIndexOn(A, saved, d(27))).toBe(-1);
    expect(dayIndexOn(A, saved, d(28))).toBe(0);
    expect(dayIndexOn(A, saved, new Date(2026, 9, 4))).toBe(6);
  });

  it('a week planned on prep day starts the next day; one planned on Monday waits for Sunday', () => {
    expect(ymd(weekStart(A, d(27, 10).getTime()))).toBe('9/28');
    expect(ymd(weekStart(A, d(28, 10).getTime()))).toBe('10/5');
  });

  it('weeks from before dates were tracked follow today’s weekday', () => {
    expect(ymd(weekStart(A, 0, d(23)))).toBe('9/21');
    expect(dayIndexOn(A, 0, d(23))).toBe(2);
  });

  it('the check-in is due at the end of the week, not right after the last one', () => {
    const saved = d(26, 18).getTime();
    expect(checkinDue(A, saved, d(27))).toBe(false);
    expect(checkinDue(A, saved, new Date(2026, 9, 2))).toBe(false);
    expect(checkinDue(A, saved, new Date(2026, 9, 3))).toBe(true);
    expect(checkinDue(A, saved, new Date(2026, 9, 10))).toBe(true);
  });
});

describe('reminders', () => {
  const saved = d(26, 18).getTime();

  it('reminds on prep day morning, the evening before thawing, and before the next prep day', () => {
    const list = upcomingReminders(plan, A, saved, defaultReminderSettings(), d(26, 19));
    const prep = list.find((r) => r.kind === 'prep')!;
    expect(new Date(prep.at)).toEqual(d(27, 9));
    const checkin = list.find((r) => r.kind === 'checkin')!;
    expect(new Date(checkin.at)).toEqual(new Date(2026, 9, 3, 9));
    for (const r of list.filter((x) => x.kind === 'thaw')) {
      expect(new Date(r.at).getHours()).toBe(20);
      expect(r.body).toMatch(/^Move .+ from the freezer to the fridge\.$/);
    }
    expect(list.map((r) => r.at)).toEqual([...list.map((r) => r.at)].sort((a, b) => a - b));
    expect(new Set(list.map((r) => r.tag)).size).toBe(list.length);
  });

  it('matches the thaw list the app shows', () => {
    const thawDays = plan.map((_, i) => thawFor(plan, i)).filter((x) => x.length).length;
    const list = upcomingReminders(plan, A, saved, defaultReminderSettings(), d(26, 19));
    expect(list.filter((r) => r.kind === 'thaw').length).toBe(thawDays - (thawFor(plan, 0).length ? 1 : 0));
  });

  it('leaves out past reminders and kinds that are turned off', () => {
    const later = upcomingReminders(plan, A, saved, defaultReminderSettings(), new Date(2026, 9, 1, 12));
    expect(later.some((r) => r.kind === 'prep')).toBe(false);
    const off = upcomingReminders(plan, A, saved, { ...defaultReminderSettings(), prep: false, thaw: false, checkin: false }, d(26, 19));
    expect(off).toEqual([]);
  });

  it('uses the chosen times', () => {
    const list = upcomingReminders(plan, A, saved, { ...defaultReminderSettings(), morning: '07:30' }, d(26, 19));
    expect(new Date(list.find((r) => r.kind === 'prep')!.at)).toEqual(d(27, 7, 30));
    expect(ymd(dateOfDay(A, saved, -1))).toBe('9/27');
  });
});

describe('calendar file', () => {
  it('has one event with an alarm per reminder, in UTC, with text escaped', () => {
    const list = upcomingReminders(plan, A, d(26, 18).getTime(), defaultReminderSettings(), d(26, 19));
    const ics = toIcs([...list, { ...list[0], tag: 'x', body: 'Salt, pepper; done' }], 'https://example.com/remy/', 0);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(list.length + 1);
    expect(ics.match(/BEGIN:VALARM/g)?.length).toBe(list.length + 1);
    expect(ics).toContain('DESCRIPTION:Salt\\, pepper\\; done');
    expect(ics).toMatch(/DTSTART:\d{8}T\d{4}00Z/);
    expect(ics).toContain('URL:https://example.com/remy/?open=prep');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
