import type { InterviewState } from '../interview/types';
import type { ProgressEntry } from '../learning/types';
import type { BodyProfile } from '../planning/energy';
import type { Meal, PlanDay, WeekPlan } from '../planning/types';
import { SLOTS } from '../planning/types';
import type { Stamps } from '../storage/db';
import { normalizePlanState, type PlanState } from '../storage/planState';

/** The cloud copy of one person's data (one row per account). */
export interface RemoteRow {
  interview: InterviewState | null;
  plan: PlanState | null;
  interview_at: number;
  plan_at: number;
}

export interface LocalDocs {
  interview: InterviewState;
  plan: PlanState;
  stamps: Stamps;
}

export interface SyncDecision {
  /** Replace the local copy with this value, saved with this change time. */
  pullInterview?: { value: InterviewState; at: number };
  pullPlan?: { value: PlanState; at: number };
  /** Upload the local copy (or, when there's a pull, the merged value). */
  pushInterview: boolean;
  pushPlan: boolean;
  /** The plan to upload when `pushPlan` is set (weigh-ins left out unless they're shared). */
  uploadPlan?: PlanState;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Decide what to download and upload. Each document (interview, plan) starts from the newer copy, then takes
 * every answer, meal, check-off and check-in the other copy changed more recently, so edits made on two devices
 * while one was offline are both kept. When the merge differs from both copies, it's saved locally and uploaded
 * with a new change time. Copies saved before change times existed fall back to “newest change wins”.
 */
export function reconcile(local: LocalDocs, remote: RemoteRow | null, now = Date.now(), shareWeights = true): SyncDecision {
  const hasLocal = local.stamps.interviewAt > 0 || local.stamps.planAt > 0;
  const upload = (p: PlanState, cloud: PlanState | null) => (shareWeights ? p : weightsFrom(p, cloud));
  if (!remote) {
    const pushPlan = hasLocal && local.stamps.planAt > 0;
    return { pushInterview: hasLocal, pushPlan, ...(pushPlan ? { uploadPlan: upload(local.plan, null) } : {}) };
  }

  const out: SyncDecision = { pushInterview: false, pushPlan: false };

  if (remote.interview && remote.interview_at !== local.stamps.interviewAt) {
    const remoteNewer = remote.interview_at > local.stamps.interviewAt;
    const merged = remoteNewer ? mergeInterview(remote.interview, local.interview) : mergeInterview(local.interview, remote.interview);
    const fromBoth = !same(merged, local.interview) && !same(merged, remote.interview);
    if (!same(merged, local.interview)) out.pullInterview = { value: merged, at: fromBoth ? now : remote.interview_at };
    out.pushInterview = !same(merged, remote.interview);
  } else if (!remote.interview && local.stamps.interviewAt > 0) out.pushInterview = true;

  if (remote.plan && remote.plan_at !== local.stamps.planAt) {
    const cloud = normalizePlanState(remote.plan);
    const remoteNewer = remote.plan_at > local.stamps.planAt;
    const merged = remoteNewer ? mergePlan(cloud, local.plan) : mergePlan(local.plan, cloud);
    const fromBoth = !same(merged, local.plan) && !same(merged, cloud);
    if (!same(merged, local.plan)) out.pullPlan = { value: merged, at: fromBoth ? now : remote.plan_at };
    // Compared as it would be uploaded: weigh-ins kept off the cloud aren't a reason to upload again.
    const up = upload(merged, cloud);
    out.pushPlan = !same(up, cloud);
    if (out.pushPlan) out.uploadPlan = up;
  } else if (!remote.plan && local.stamps.planAt > 0) {
    out.pushPlan = true;
    out.uploadPlan = upload(local.plan, null);
  }
  return out;
}

/** The newer interview, with any answer the other copy changed more recently. */
export function mergeInterview(base: InterviewState, other: InterviewState): InterviewState {
  const at = { ...base.answeredAt };
  const answers = { ...base.answers };
  for (const [k, t] of Object.entries(other.answeredAt ?? {})) {
    if (t <= (at[k] ?? 0)) continue;
    at[k] = t;
    if (other.answers[k] === undefined) delete answers[k];
    else answers[k] = other.answers[k];
  }
  return Object.keys(other.answeredAt ?? {}).length ? { ...base, answers, answeredAt: at } : base;
}

/** The meal changed most recently of the two (ties keep `a`). */
const newerMeal = (a: Meal | undefined, b: Meal | undefined) => ((b?.t ?? 0) > (a?.t ?? 0) ? b : a);

function mergeWeek(base: WeekPlan | null, other: WeekPlan | null | undefined): WeekPlan | null {
  if (!base || !other || base.length !== other.length) return base;
  return base.map((day, i): PlanDay => {
    const o = other[i];
    if (!o || o.d !== day.d) return day;
    const meals: PlanDay['meals'] = {};
    for (const slot of SLOTS) {
      const m = newerMeal(day.meals[slot], o.meals[slot]);
      if (m) meals[slot] = m;
    }
    return { ...day, meals };
  });
}

/** Check-ins from both copies, one per time, newest first; a weigh-in on either copy is kept. */
export function mergeProgress(a: ProgressEntry[], b: ProgressEntry[]): ProgressEntry[] {
  const by = new Map<number, ProgressEntry>();
  // `a` wins and keeps its field order (so an unchanged copy compares equal); fields only `b` has are added.
  for (const p of [...b, ...a]) by.set(p.at, { ...p, ...by.get(p.at), ...p });
  return [...by.values()].sort((x, y) => y.at - x.at);
}

/**
 * The newer plan, with the other copy's more recent meals (this week and the weeks ahead), grocery check-offs and
 * check-ins. Meals only merge within the same week: a week planned anew on one device replaces the old one.
 */
export function mergePlan(base: PlanState, other: PlanState): PlanState {
  const sameWeek = base.weekStartedAt === other.weekStartedAt;
  const progress = mergeProgress(base.progress, other.progress);
  if (!sameWeek) return { ...base, progress };
  return {
    ...base,
    plan: mergeWeek(base.plan, other.plan),
    ahead: base.ahead.map((w, i) => mergeWeek(w, other.ahead[i]) ?? w),
    groceries: { ...base.groceries, checked: mergeChecked(base.groceries.checked, other.groceries.checked) },
    progress,
  };
}

/** The plan without weigh-ins. Check-ins keep hunger, energy and fit. */
export function withoutWeights(p: PlanState): PlanState {
  if (!p.progress.some((x) => x.weight !== undefined)) return p;
  return { ...p, progress: p.progress.map(({ weight: _w, unit: _u, ...rest }) => rest) };
}

/**
 * The plan to upload from a device that doesn't share body details: its own weigh-ins stay on it, and weigh-ins
 * already in the cloud (from a device that shares them) are left as they are.
 */
export function weightsFrom(p: PlanState, cloud: PlanState | null): PlanState {
  const theirs = new Map((cloud?.progress ?? []).filter((x) => x.weight !== undefined).map((x) => [x.at, x]));
  const progress = withoutWeights(p).progress.map((x) => {
    const c = theirs.get(x.at);
    return c ? { ...x, weight: c.weight, unit: c.unit } : x;
  });
  return same(progress, p.progress) ? p : { ...p, progress };
}

/* ---------- body details (optional, their own table) ---------- */

export interface RemoteHealth {
  health: BodyProfile;
  health_at: number;
}

/** Newest details win. A device that has never had details takes the cloud copy. */
export function reconcileHealth(local: BodyProfile, remote: RemoteHealth | null): { pull?: BodyProfile; push: boolean } {
  if (!remote) return { push: local.updatedAt > 0 };
  if (remote.health_at > local.updatedAt) return { pull: { ...remote.health, updatedAt: remote.health_at, sync: true }, push: false };
  return { push: local.updatedAt > remote.health_at };
}

/** Items checked on either side, keeping only the ones that are checked. */
export function mergeChecked(a: Record<string, boolean>, b: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(a)) if (v) out[k] = true;
  for (const [k, v] of Object.entries(b)) if (v) out[k] = true;
  return out;
}

/* ---------- change times, stamped when the app changes something ---------- */

const withoutTime = (m: Meal | undefined) => {
  if (!m) return m;
  const { t: _t, ...rest } = m;
  return rest;
};

function stampWeek(prev: WeekPlan | null | undefined, next: WeekPlan | null, now: number): WeekPlan | null {
  if (!next || next === prev) return next;
  return next.map((day, i) => {
    const before = prev?.[i]?.d === day.d ? prev[i] : undefined;
    let changed = false;
    const meals: PlanDay['meals'] = {};
    for (const slot of SLOTS) {
      const m = day.meals[slot];
      if (!m) continue;
      if (!same(withoutTime(m), withoutTime(before?.meals[slot]))) {
        meals[slot] = { ...m, t: now };
        changed = true;
      } else meals[slot] = m;
    }
    return changed ? { ...day, meals } : day;
  });
}

/** Mark the meals that differ from the previous state with the time they changed. Pure; used for every local change. */
export function stampMeals(prev: PlanState, next: PlanState, now = Date.now()): PlanState {
  if (next === prev || next.weekStartedAt !== prev.weekStartedAt) return next;
  const plan = stampWeek(prev.plan, next.plan, now);
  const ahead = next.ahead.map((w, i) => stampWeek(prev.ahead[i], w, now) ?? w);
  return plan === next.plan && ahead.every((w, i) => w === next.ahead[i]) ? next : { ...next, plan, ahead };
}

/** Mark the answers that differ from the previous state with the time they changed. Pure; used for every local change. */
export function stampAnswers(prev: InterviewState, next: InterviewState, now = Date.now()): InterviewState {
  if (next === prev || next.answers === prev.answers) return next;
  const at = { ...next.answeredAt };
  let changed = false;
  for (const k of new Set([...Object.keys(prev.answers), ...Object.keys(next.answers)])) {
    if (same(prev.answers[k], next.answers[k])) continue;
    at[k] = now;
    changed = true;
  }
  return changed ? { ...next, answeredAt: at } : next;
}
