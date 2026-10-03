import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview, type Answers } from '../interview/types';
import { freshAges, freshProblems, mainProtein, prepProblems, PROTEIN_SHARE, proteinProblems, repairWeek, spaceProblems, weekProblems } from './check';
import { R } from './data/recipes';
import { fitToGoals } from './goals';
import { emptyGroceryEdits, groceryList } from './grocery';
import { buildPlan, eachMeal } from './planner';
import { check, context, householdSize, ovenPans } from './rules';
import { packingCounts, schedule } from './schedule';
import type { WeekPlan } from './types';

const SAMPLE: Answers = activeAnswers(fillWithSamples(emptyInterview()));
const FRI = { month: null, fresh: 'Fri' as const };

describe('fresh food', () => {
  it('counts days from the fresh shop to each eating day', () => {
    expect(freshAges(SAMPLE)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // Shopping Friday, prepping Sunday: Monday is 3 days after the shop.
    expect(freshAges(SAMPLE, FRI)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it('flags a dish whose fresh items won’t keep, and swaps it on that day unless it’s approved', () => {
    const plan = buildPlan('balanced', context(SAMPLE)).plan;
    plan[6].meals['Afternoon snack'] = { r: 'guacamole', ok: false };
    plan[5].meals['Afternoon snack'] = { r: 'guacamole', ok: true };
    const ctx = context(SAMPLE, {}, false, [], FRI);
    const problems = freshProblems(plan, ctx).filter((p) => p.recipe === 'guacamole');
    expect(problems.map((p) => p.day)).toEqual([5, 6]);
    expect(problems[0].text).toContain('avocados');
    const { plan: fixed, fixes } = repairWeek(plan, ctx, 'balanced');
    expect(fixed[6].meals['Afternoon snack']?.r).not.toBe('guacamole');
    expect(fixed[5].meals['Afternoon snack']?.r).toBe('guacamole');
    expect(fixes.join(' ')).toContain('fresh ingredients');
  });
});

describe('fresh food after fitting', () => {
  it('never brings back a dish whose fresh items won’t keep, when fitting to goals or adding sides', () => {
    const ctx = context(SAMPLE, {}, false, [], FRI);
    for (const v of ['favorites', 'balanced', 'variety'] as const)
      for (const kcal of [1400, 1700, 2600]) {
        const fit = fitToGoals(buildPlan(v, ctx).plan, ctx, { kcal, pro: null });
        expect(freshProblems(fit.plan, ctx), `${v} ${kcal}`).toEqual([]);
      }
  });
});

describe('space and prep time', () => {
  it('reports freezer and container space against the answers', () => {
    const plan = buildPlan('balanced', context(SAMPLE)).plan;
    const tiny = { ...SAMPLE, freezer: 'Tiny', containers: 'Under 10' };
    const p = spaceProblems(plan, tiny);
    expect(p.map((x) => x.rule)).toContain('containers');
    // A tiny freezer: the repair moves late-week meals out of the freezer where it can.
    const before = packingCounts(plan, tiny).freezer;
    const after = packingCounts(repairWeek(plan, context(tiny), 'balanced').plan, tiny).freezer;
    expect(after).toBeLessThan(before);
  });

  it('trims prep day toward the person’s window with quicker dishes', () => {
    const short = { ...SAMPLE, preptime: '2–3 hours' };
    const raw = buildPlan('variety', context({ ...SAMPLE, preptime: '4+ hours' })).plan;
    expect(prepProblems(raw, short).length).toBe(1);
    const fixed = repairWeek(raw, context(short), 'variety');
    expect(schedule(fixed.plan, short).total).toBeLessThan(schedule(raw, short).total);
    expect(fixed.fixes.some((f) => f.includes('prep day'))).toBe(true);
  });
});

describe('a mix of proteins', () => {
  it('knows what a dish is built on', () => {
    expect(mainProtein(R.burritos)).toBe('chicken');
    expect(mainProtein(R.chili)).toBe('beef');
    expect(mainProtein(R.oatsquares)).toBe('eggs');
  });

  it('keeps Repeat favorites as they are, and brings Balanced and More variety under their limits with dishes liked as much', () => {
    expect(PROTEIN_SHARE.favorites).toBe(1);
    const ctx = context(SAMPLE);
    for (const v of ['balanced', 'variety'] as const) {
      const plan = buildPlan(v, context({ ...SAMPLE, preptime: '4+ hours' })).plan;
      expect(proteinProblems(plan, v), v).toEqual([]);
      eachMeal(plan, (m) => m.r && expect(check(R[m.r], ctx.A).ok).toBe(true));
    }
  });
});

describe('household and equipment', () => {
  it('cooks and shops for everyone in the household', () => {
    const plan = buildPlan('balanced', context(SAMPLE)).plan;
    const two = { ...SAMPLE, household: 'Me + 1' };
    expect(householdSize(two)).toBe(2);
    const q = (A: Answers) => groceryList(plan, A, emptyGroceryEdits()).find((x) => x.k === 'chickenbreast')!.q!;
    // Whole batches: a 4-portion batch for 3 meals already has a spare portion, so it’s more, but not always double.
    expect(q(two)).toBeGreaterThan(q(SAMPLE) * 1.3);
    expect(schedule(plan, two).people).toBe(2);
  });

  it('uses one sheet pan at a time without 2+ sheet pans, and leaves out oven dishes without an oven', () => {
    const onePan = { ...SAMPLE, equipment: ['Oven', 'Stovetop'] };
    expect(ovenPans(onePan)).toBe(1);
    expect(ovenPans(SAMPLE)).toBe(2);
    const plan = buildPlan('balanced', context(SAMPLE)).plan;
    const oven = schedule(plan, onePan).tasks.filter((t) => t.l === 'oven');
    for (const a of oven) for (const b of oven) if (a !== b) expect(a.e <= b.s || b.e <= a.s, `${a.t} / ${b.t}`).toBe(true);
    const noOven = { ...SAMPLE, equipment: ['Stovetop', 'Microwave'] };
    expect(check(R.brownies, noOven).ok).toBe(false);
    expect(check(R.oats, noOven).ok).toBe(true);
  });
});

describe('the sample weeks', () => {
  it('keep every week rule they can, and explain what’s left', () => {
    const weeks: [WeekPlan, 'favorites' | 'balanced' | 'variety'][] = (['favorites', 'balanced', 'variety'] as const).map((v) => [buildPlan(v, context(SAMPLE)).plan, v]);
    for (const [plan, v] of weeks) {
      const left = weekProblems(plan, context(SAMPLE), v).filter((p) => p.rule !== 'containers');
      expect(left, v).toEqual([]);
    }
  });
});
