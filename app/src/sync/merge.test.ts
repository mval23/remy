import { describe, expect, it } from 'vitest';
import { fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { emptyPlanState, type PlanState } from '../storage/db';
import { normalizePlanState } from '../storage/planState';
import { emptyBody } from '../planning/energy';
import type { Meal } from '../planning/types';
import { mergeChecked, mergeInterview, mergeProgress, reconcile, reconcileHealth, stampAnswers, stampMeals, weightsFrom, withoutWeights, type RemoteRow } from './merge';

const interview = fillWithSamples(emptyInterview());
const planWith = (checked: Record<string, boolean>): PlanState => ({ ...emptyPlanState(), groceries: { ...emptyPlanState().groceries, checked } });
const local = (interviewAt: number, planAt: number, checked: Record<string, boolean> = {}) => ({
  interview,
  plan: planWith(checked),
  stamps: { interviewAt, planAt },
});
const remote = (interview_at: number, plan_at: number, checked: Record<string, boolean> = {}): RemoteRow => ({
  interview: { ...interview, current: 'remote-marker' },
  plan: planWith(checked),
  interview_at,
  plan_at,
});

describe('sync decisions', () => {
  it('uploads everything the first time, when the cloud is empty', () => {
    expect(reconcile(local(100, 200), null)).toMatchObject({ pushInterview: true, pushPlan: true });
  });

  it('uploads nothing from a brand-new device with no data', () => {
    expect(reconcile(local(0, 0), null)).toEqual({ pushInterview: false, pushPlan: false });
  });

  it('downloads onto a new device', () => {
    const d = reconcile(local(0, 0), remote(100, 200));
    expect(d.pullInterview?.value.current).toBe('remote-marker');
    expect(d.pullInterview?.at).toBe(100);
    expect(d.pullPlan?.at).toBe(200);
    expect(d.pushInterview || d.pushPlan).toBe(false);
  });

  it('newest change wins for each document separately', () => {
    const d = reconcile(local(300, 100), remote(200, 150));
    expect(d.pushInterview).toBe(true);
    expect(d.pullInterview).toBeUndefined();
    expect(d.pullPlan?.at).toBe(150);
  });

  it('does nothing when both sides match', () => {
    expect(reconcile(local(100, 200), remote(100, 200))).toEqual({ pushInterview: false, pushPlan: false });
  });

  it('keeps grocery items checked on this device when the cloud plan is newer', () => {
    const d = reconcile(local(100, 100, { rice: true, eggs: true }), remote(100, 200, { eggs: true, milk: true }));
    expect(d.pullPlan?.value.groceries.checked).toEqual({ rice: true, eggs: true, milk: true });
    // The combined list is uploaded so the other device gets “rice” too.
    expect(d.pushPlan).toBe(true);
    expect(d.pullPlan!.at).toBeGreaterThan(200);
  });

  it('doesn’t carry old check-offs into a new week planned on another device', () => {
    const newWeek = remote(100, 200, { milk: true });
    newWeek.plan = { ...newWeek.plan!, weekStartedAt: 200 };
    const d = reconcile(local(100, 100, { rice: true }), newWeek);
    expect(d.pullPlan?.value.groceries.checked).toEqual({ milk: true });
    expect(d.pushPlan).toBe(false);
  });

  it('fills in fields missing from a cloud copy saved by an older version', () => {
    const old = remote(100, 200);
    const { learned: _l, checkin: _c, ...rest } = old.plan!;
    old.plan = rest as PlanState;
    const d = reconcile(local(100, 100), old);
    expect(d.pullPlan?.value.learned).toEqual([]);
    expect(d.pullPlan?.value.checkin.rated).toEqual({});
  });

  it('merges check-offs, ignoring unchecked items', () => {
    expect(mergeChecked({ a: true, b: false }, { b: false, c: true })).toEqual({ a: true, c: true });
  });
});

/* ---------- finer merging ---------- */

const week = (meals: Record<string, Meal>[]) =>
  meals.map((m, i) => ({ d: (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const)[i], meals: m })) as unknown as PlanState['plan'];
const withWeek = (plan: PlanState['plan'], extra: Partial<PlanState> = {}): PlanState => normalizePlanState({ ...emptyPlanState(), weekStartedAt: 5, plan, ...extra });

describe('change times', () => {
  it('stamps only the meals that changed', () => {
    const before = withWeek(week([{ Dinner: { r: 'chili', ok: false, t: 1 } }, { Dinner: { r: 'tacos', ok: false, t: 1 } }]));
    const after = withWeek(week([{ Dinner: { r: 'chili', ok: true, t: 1 } }, { Dinner: { r: 'tacos', ok: false, t: 1 } }]));
    const s = stampMeals(before, after, 50);
    expect(s.plan![0].meals.Dinner).toEqual({ r: 'chili', ok: true, t: 50 });
    expect(s.plan![1].meals.Dinner?.t).toBe(1);
    // Nothing changed: the same object comes back.
    expect(stampMeals(after, after, 60)).toBe(after);
  });

  it('stamps changed and removed answers', () => {
    const a = { ...interview, answers: { ...interview.answers, spice: 'Mild' }, answeredAt: {} };
    const answers: Record<string, unknown> = { ...a.answers, spice: 'Medium' };
    delete answers.cuisines;
    const s = stampAnswers(a, { ...a, answers: answers as typeof a.answers }, 70);
    expect(s.answeredAt).toEqual({ spice: 70, cuisines: 70 });
  });
});

describe('merging edits from two devices', () => {
  it('keeps meals changed on each device while the other was offline', () => {
    const base = week([{ Dinner: { r: 'chili', ok: false, t: 1 } }, { Dinner: { r: 'tacos', ok: false, t: 1 } }]);
    // The phone approved Monday; the computer changed Tuesday later.
    const phone = withWeek(week([{ Dinner: { r: 'chili', ok: true, t: 10 } }, base![1].meals as Record<string, Meal>]));
    const computer = withWeek(week([base![0].meals as Record<string, Meal>, { Dinner: { r: 'burritos', ok: false, t: 20 } }]));
    const d = reconcile({ interview, plan: phone, stamps: { interviewAt: 1, planAt: 10 } }, { interview, plan: computer, interview_at: 1, plan_at: 20 }, 99);
    expect(d.pullPlan!.value.plan![0].meals.Dinner).toMatchObject({ r: 'chili', ok: true });
    expect(d.pullPlan!.value.plan![1].meals.Dinner).toMatchObject({ r: 'burritos' });
    // A merge of both is new to both sides: saved with a new time and uploaded.
    expect(d.pullPlan!.at).toBe(99);
    expect(d.pushPlan).toBe(true);
  });

  it('a week planned anew on one device replaces the old week', () => {
    const old = withWeek(week([{ Dinner: { r: 'chili', ok: true, t: 50 } }]));
    const fresh = withWeek(week([{ Dinner: { r: 'tacos', ok: false, t: 10 } }]), { weekStartedAt: 9 });
    const d = reconcile({ interview, plan: old, stamps: { interviewAt: 1, planAt: 50 } }, { interview, plan: fresh, interview_at: 1, plan_at: 60 });
    expect(d.pullPlan!.value.plan![0].meals.Dinner?.r).toBe('tacos');
  });

  it('merges interview answers one by one', () => {
    const a = { ...interview, answers: { ...interview.answers, spice: 'Mild', skill: 'Beginner' }, answeredAt: { spice: 10, skill: 30 } };
    const b = { ...interview, answers: { ...interview.answers, spice: 'Hot', skill: 'Confident' }, answeredAt: { spice: 20, skill: 5 } };
    const m = mergeInterview(a, b);
    expect(m.answers.spice).toBe('Hot');
    expect(m.answers.skill).toBe('Beginner');
  });

  it('adds check-ins from both devices together, keeping a weigh-in from either', () => {
    const p = mergeProgress([{ at: 2, hunger: 'Fine', weight: 70, unit: 'kg' }, { at: 1, hunger: 'Often' }], [{ at: 3, energy: 'Good' }, { at: 2, hunger: 'Fine' }]);
    expect(p.map((x) => x.at)).toEqual([3, 2, 1]);
    expect(p[1].weight).toBe(70);
  });
});

describe('body details and weigh-ins', () => {
  const weighed = withWeek(null, { progress: [{ at: 2, weight: 70, unit: 'kg', hunger: 'Fine' }, { at: 1, hunger: 'Often' }] });

  it('leaves weigh-ins out of the upload when body details aren’t synced', () => {
    const d = reconcile({ interview, plan: weighed, stamps: { interviewAt: 1, planAt: 5 } }, null, 0, false);
    expect(d.uploadPlan!.progress).toEqual([{ at: 2, hunger: 'Fine' }, { at: 1, hunger: 'Often' }]);
    expect(reconcile({ interview, plan: weighed, stamps: { interviewAt: 1, planAt: 5 } }, null, 0, true).uploadPlan).toBe(weighed);
  });

  it('doesn’t upload again just because the cloud has no weigh-ins', () => {
    const cloud = withoutWeights(weighed);
    const d = reconcile({ interview, plan: weighed, stamps: { interviewAt: 1, planAt: 6 } }, { interview, plan: cloud, interview_at: 1, plan_at: 5 }, 0, false);
    expect(d.pushPlan).toBe(false);
    expect(d.pullPlan).toBeUndefined();
  });

  it('leaves weigh-ins shared by another device in the cloud', () => {
    const cloud = withWeek(null, { progress: [{ at: 2, weight: 69, unit: 'kg', hunger: 'Fine' }] });
    expect(weightsFrom(weighed, cloud).progress).toEqual([{ at: 2, hunger: 'Fine', weight: 69, unit: 'kg' }, { at: 1, hunger: 'Often' }]);
  });

  it('newest body details win, and a device without any takes the cloud copy', () => {
    const mine = { ...emptyBody(), weightKg: 70, updatedAt: 10, sync: true };
    expect(reconcileHealth(mine, null)).toEqual({ push: true });
    expect(reconcileHealth({ ...emptyBody(), sync: true }, null)).toEqual({ push: false });
    expect(reconcileHealth(mine, { health: { ...mine, weightKg: 68, updatedAt: 20 }, health_at: 20 }).pull?.weightKg).toBe(68);
    expect(reconcileHealth(mine, { health: { ...mine, weightKg: 72 }, health_at: 5 })).toEqual({ push: true });
    expect(reconcileHealth(mine, { health: mine, health_at: 10 })).toEqual({ push: false });
  });
});
