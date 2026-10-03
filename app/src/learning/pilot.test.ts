import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview, type Answers } from '../interview/types';
import { buildPlan } from '../planning/planner';
import { context } from '../planning/rules';
import { schedule } from '../planning/schedule';
import { emptyPlanState, type PlanState } from '../storage/planState';
import { applyCheckin, ATE, WASTE, weekQuestions } from './learning';
import { pilotChecks, pilotFile, pilotSummary, pilotWeeks, weightDirection } from './pilot';
import { emptyCheckin, type ProgressEntry } from './types';

const SAMPLE: Answers = activeAnswers(fillWithSamples(emptyInterview()));
const WEEK = 7 * 24 * 60 * 60 * 1000;

function week(): PlanState {
  const base = { ...emptyPlanState(), variety: 'balanced' as const, weekStartedAt: 1 };
  return { ...base, plan: buildPlan('balanced', context(SAMPLE)).plan };
}

/** Check-ins one week apart, oldest first in the list given (saved newest first, as the app does). */
const checkins = (xs: Omit<ProgressEntry, 'at'>[]): ProgressEntry[] => xs.map((x, i) => ({ at: 1_000 + i * WEEK, ...x })).reverse();

describe('the check-in records the pilot measures', () => {
  it('asks about waste after how much was eaten', () => {
    const ids = weekQuestions(week().plan!, SAMPLE, week()).map((q) => q.id);
    expect(ids.indexOf('waste')).toBe(ids.indexOf('ate') + 1);
  });

  it('saves eaten, waste, prep (felt and planned minutes) and “Not again” count with the week', () => {
    const s = week();
    const target = Object.keys(Object.fromEntries(s.plan!.flatMap((d) => Object.values(d.meals).map((m) => [m!.r, 1]))))[0];
    const checkin = { ...emptyCheckin(), rated: { [target]: 'no' as const }, q: { ate: ATE[1], waste: WASTE[1], prep: 'About right' } };
    const { next } = applyCheckin({ ...s, checkin }, SAMPLE, 5_000);
    expect(next.progress[0]).toMatchObject({ at: 5_000, ate: ATE[1], waste: WASTE[1], prep: 'About right', prepMin: schedule(s.plan!, SAMPLE).total, notAgain: 1 });
  });
});

describe('pilot measures', () => {
  const p = checkins([
    { ate: ATE[2], waste: WASTE[2], hunger: 'Often hungry', prep: 'Too long', prepMin: 220, notAgain: 3 },
    { ate: ATE[1], waste: WASTE[2], hunger: 'Mostly fine', prep: 'About right', prepMin: 200, notAgain: 2 },
    { ate: ATE[1], waste: WASTE[1], hunger: 'Mostly fine', prep: 'About right', prepMin: 190, notAgain: 1 },
    { ate: ATE[0], waste: WASTE[0], hunger: 'Mostly fine', energy: 'Low', prep: 'About right', prepMin: 190, notAgain: 0 },
  ]);

  it('works out the trends from the answers', () => {
    const s = pilotSummary(p);
    expect(s.checkins).toBe(4);
    expect(s.spanWeeks).toBe(4);
    // (0.5 + 0.75 + 0.75 + 0.95) / 4
    expect(s.eaten).toBe(0.74);
    expect(s.oftenHungry).toBe(0.25);
    // One energy answer isn't a rate yet.
    expect(s.lowEnergy).toBeNull();
    expect(s.waste).toBe('falling');
    expect(s.notAgain).toBe(1.5);
    expect(s.notAgainTrend).toBe('falling');
    expect(s.prepRight).toEqual({ yes: 3, of: 4 });
    expect(s.prepMinutes).toBe(200);
    expect(pilotWeeks(p).map((w) => w.week)).toEqual([1, 2, 3, 4]);
    expect(pilotWeeks(p)[0].ate).toBe(ATE[2]);
  });

  it('checks the Gate 4 targets, and says when it’s too early', () => {
    expect(pilotChecks(pilotSummary(p)).map((c) => c.status)).toEqual(['met', 'not yet', 'met']);
    expect(pilotChecks(pilotSummary(p.slice(0, 1))).map((c) => c.status)).toEqual(['too early', 'too early', 'met']);
    expect(pilotChecks(pilotSummary([])).map((c) => c.status)).toEqual(['too early', 'too early', 'too early']);
  });

  it('counts a skipped week in the span', () => {
    const gap = [{ at: 1_000 + 3 * WEEK, ate: ATE[0] }, { at: 1_000, ate: ATE[0] }];
    expect(pilotSummary(gap)).toMatchObject({ checkins: 2, spanWeeks: 4 });
  });
});

describe('the summary file', () => {
  const p = checkins([
    { ate: ATE[1], waste: WASTE[1], hunger: 'Often hungry', fit: 'Looser', weight: 81.4, unit: 'kg' },
    { ate: ATE[1], waste: WASTE[1], weight: 81.0, unit: 'kg' },
    { ate: ATE[0], waste: WASTE[0], weight: 80.2, unit: 'kg' },
  ]);

  it('has no dates, weights or clothes-fit answers', () => {
    const text = JSON.stringify(pilotFile(p));
    expect(text).not.toMatch(/"at"|weight|81|80\.2|Looser|fit/i);
    expect(pilotFile(p).weeks).toHaveLength(3);
  });

  it('adds only the weight direction, and only when asked', () => {
    expect(weightDirection(p)).toBe('down');
    expect(pilotFile(p, true).weightDirection).toBe('down');
    expect(JSON.stringify(pilotFile(p, true))).not.toMatch(/81|80\.2/);
  });
});
