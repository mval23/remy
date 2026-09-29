import { fitToGoals, hasGoals, type Goals } from './goals';
import { buildPlan, eachMeal } from './planner';
import type { PlanContext } from './rules';
import type { Variety, WeekPlan } from './types';

/**
 * Planning a month ahead: the current week plus the next `AHEAD_WEEKS`, saved so they stay put and can be
 * changed or approved early. Meals approved ahead of time are kept; the rest are drafts that follow the rules and
 * what Remy learns (a check-in or a profile change rebuilds them). Pure.
 */
export const AHEAD_WEEKS = 3;

const mealIds = (plan: WeekPlan) => {
  const ids: string[] = [];
  eachMeal(plan, (m) => m.r && !ids.includes(m.r) && ids.push(m.r));
  return ids;
};

/**
 * The weeks after `plan`, as Remy would plan them now. Each keeps the meals approved in the saved copy
 * (`ahead[i]`), rotates some recipes out of the week before it (the way a check-in does) and is fitted to goals.
 */
export function planAhead(plan: WeekPlan, ahead: WeekPlan[], variety: Variety, ctx: PlanContext, goals: Goals, weeks = AHEAD_WEEKS): WeekPlan[] {
  const out: WeekPlan[] = [];
  let prev = plan;
  for (let i = 0; i < weeks; i++) {
    let next = buildPlan(variety, { ...ctx, recent: mealIds(prev) }, ahead[i]).plan;
    if (hasGoals(goals)) next = fitToGoals(next, ctx, goals).plan;
    out.push(next);
    prev = next;
  }
  return out;
}

export type WeekStatus = 'approved' | 'some' | 'draft';

/** Every planned meal approved, some of them, or none yet. */
export function weekStatus(plan: WeekPlan): WeekStatus {
  let total = 0;
  let ok = 0;
  eachMeal(plan, (m) => {
    if (m.r || m.need) {
      total++;
      if (m.ok) ok++;
    }
  });
  return total > 0 && ok === total ? 'approved' : ok > 0 ? 'some' : 'draft';
}

/** How many meals of a week are approved. */
export function approvedCount(plan: WeekPlan): number {
  let ok = 0;
  eachMeal(plan, (m) => m.ok && m.r && ok++);
  return ok;
}
