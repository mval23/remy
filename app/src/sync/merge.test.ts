import { describe, expect, it } from 'vitest';
import { fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { emptyPlanState, type PlanState } from '../storage/db';
import { mergeChecked, reconcile, type RemoteRow } from './merge';

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
    expect(reconcile(local(100, 200), null)).toEqual({ pushInterview: true, pushPlan: true });
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
