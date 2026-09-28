import type { InterviewState } from '../interview/types';
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
  /** Upload the local copy. */
  pushInterview: boolean;
  pushPlan: boolean;
}

/**
 * Decide what to download and upload. Each document (interview, plan) follows “newest change wins”,
 * compared by the time it last changed on any device.
 * Grocery check-offs are the exception: within the same week, an item checked on either device stays checked,
 * so ticking things off in the store while offline is never lost.
 */
export function reconcile(local: LocalDocs, remote: RemoteRow | null): SyncDecision {
  const hasLocal = local.stamps.interviewAt > 0 || local.stamps.planAt > 0;
  if (!remote) return { pushInterview: hasLocal, pushPlan: hasLocal && local.stamps.planAt > 0 };

  const out: SyncDecision = { pushInterview: false, pushPlan: false };

  if (remote.interview && remote.interview_at > local.stamps.interviewAt) out.pullInterview = { value: remote.interview, at: remote.interview_at };
  else if (local.stamps.interviewAt > remote.interview_at) out.pushInterview = true;

  if (remote.plan && remote.plan_at > local.stamps.planAt) {
    const cloud = normalizePlanState(remote.plan);
    // Check-offs only carry over within the same week; a new week starts with a fresh list.
    const sameWeek = cloud.weekStartedAt === local.plan.weekStartedAt;
    const checked = sameWeek ? mergeChecked(local.plan.groceries.checked, cloud.groceries.checked) : cloud.groceries.checked;
    const added = sameWeek && Object.keys(checked).length > Object.keys(cloud.groceries.checked).filter((k) => cloud.groceries.checked[k]).length;
    const value: PlanState = { ...cloud, groceries: { ...cloud.groceries, checked } };
    // If this device ticked items the cloud doesn't have, keep them and upload the combined list.
    out.pullPlan = { value, at: added ? Date.now() : remote.plan_at };
    out.pushPlan = added;
  } else if (local.stamps.planAt > remote.plan_at) {
    out.pushPlan = true;
  }
  return out;
}

/** Items checked on either side, keeping only the ones that are checked. */
export function mergeChecked(a: Record<string, boolean>, b: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(a)) if (v) out[k] = true;
  for (const [k, v] of Object.entries(b)) if (v) out[k] = true;
  return out;
}
