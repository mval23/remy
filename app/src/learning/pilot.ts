import { ATE, WASTE, weightTrend } from './learning';
import type { ProgressEntry } from './types';

/**
 * Measures for a pilot, worked out on the device from the weekly check-ins. Nothing here is sent anywhere:
 * Nutrition shows the trends, and the person can download a summary file and choose who gets it.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Rough share of the planned food eaten for each answer to “How much of the planned food did you eat?”. */
export const ATE_SHARE: Record<string, number> = { [ATE[0]]: 0.95, [ATE[1]]: 0.75, [ATE[2]]: 0.5, [ATE[3]]: 0.2 };

/** Targets from the plan's Gate 4, used only in the summary file. */
export const PILOT_TARGETS = { eaten: 0.7, oftenHungry: 0.25 };

/** One week of check-in answers, without dates, foods or weights. */
export interface PilotWeek {
  /** 1 = the first check-in. */
  week: number;
  ate?: string;
  waste?: string;
  hunger?: string;
  energy?: string;
  prep?: string;
  prepMinutes?: number;
  notAgain?: number;
}

export type Direction = 'falling' | 'steady' | 'rising';

export interface PilotSummary {
  /** Check-ins saved, and the weeks from the first to the last (so 4 of 5 means one week was skipped). */
  checkins: number;
  spanWeeks: number;
  /** Average rough share of planned food eaten over the last 4 answers; null without 2 answers. */
  eaten: number | null;
  /** Share of check-ins with “Often hungry” / low energy; null without 2 answers. */
  oftenHungry: number | null;
  lowEnergy: number | null;
  /** Food waste, recent answers against earlier ones; null without 3 answers. */
  waste: Direction | null;
  /** Usual waste over the last 2 answers, as an answer from `WASTE`. */
  wasteNow: string | null;
  /** Average meals rated “Not again” a week, and its direction; null without 2 check-ins that rated meals. */
  notAgain: number | null;
  notAgainTrend: Direction | null;
  /** Weeks prep day felt “About right”, of the weeks that answered; planned prep minutes on average. */
  prepRight: { yes: number; of: number } | null;
  prepMinutes: number | null;
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const rate = (xs: (string | undefined)[], hit: string) => {
  const answered = xs.filter((x): x is string => !!x);
  return answered.length >= 2 ? round2(answered.filter((x) => x === hit).length / answered.length) : null;
};

/** Recent values (the last 2) against the earlier ones, with a small dead band. */
function direction(oldestFirst: number[], band: number): Direction | null {
  if (oldestFirst.length < 3) return null;
  const earlier = avg(oldestFirst.slice(0, -2));
  const recent = avg(oldestFirst.slice(-2));
  return recent < earlier - band ? 'falling' : recent > earlier + band ? 'rising' : 'steady';
}

/** The check-ins as numbered weeks, oldest first. */
export function pilotWeeks(progress: ProgressEntry[]): PilotWeek[] {
  return [...progress]
    .sort((a, b) => a.at - b.at)
    .map((p, i) => {
      const w: PilotWeek = { week: i + 1 };
      if (p.ate) w.ate = p.ate;
      if (p.waste) w.waste = p.waste;
      if (p.hunger) w.hunger = p.hunger;
      if (p.energy) w.energy = p.energy;
      if (p.prep) w.prep = p.prep;
      if (p.prepMin !== undefined) w.prepMinutes = p.prepMin;
      if (p.notAgain !== undefined) w.notAgain = p.notAgain;
      return w;
    });
}

export function pilotSummary(progress: ProgressEntry[]): PilotSummary {
  const old = [...progress].sort((a, b) => a.at - b.at);
  const span = old.length ? Math.round((old[old.length - 1].at - old[0].at) / WEEK_MS) + 1 : 0;
  const ate = old.map((p) => ATE_SHARE[p.ate ?? '']).filter((x): x is number => x !== undefined);
  const waste = old.map((p) => WASTE.indexOf(p.waste ?? '')).filter((x) => x >= 0);
  const notAgain = old.map((p) => p.notAgain).filter((x): x is number => x !== undefined);
  const prep = old.map((p) => p.prep).filter((x): x is string => !!x);
  const mins = old.map((p) => p.prepMin).filter((x): x is number => !!x);
  return {
    checkins: old.length,
    spanWeeks: span,
    eaten: ate.length >= 2 ? round2(avg(ate.slice(-4))) : null,
    oftenHungry: rate(old.map((p) => p.hunger), 'Often hungry'),
    lowEnergy: rate(old.map((p) => p.energy), 'Low'),
    waste: direction(waste, 0.25),
    wasteNow: waste.length ? WASTE[Math.round(avg(waste.slice(-2)))] : null,
    notAgain: notAgain.length >= 2 ? Math.round(avg(notAgain) * 10) / 10 : null,
    notAgainTrend: direction(notAgain, 0.5),
    prepRight: prep.length ? { yes: prep.filter((x) => x === 'About right').length, of: prep.length } : null,
    prepMinutes: mins.length ? Math.round(avg(mins)) : null,
  };
}

export type CheckStatus = 'met' | 'not yet' | 'too early';

/** Gate 4 from the plan: most planned food eaten, rarely often hungry, waste falling (or none). */
export function pilotChecks(s: PilotSummary): { measure: string; target: string; status: CheckStatus }[] {
  const wasteOk = s.waste === 'falling' || s.wasteNow === WASTE[0];
  return [
    { measure: 'Planned food eaten', target: 'at least 70%', status: s.eaten === null ? 'too early' : s.eaten >= PILOT_TARGETS.eaten ? 'met' : 'not yet' },
    { measure: 'Check-ins “often hungry”', target: 'under 25%', status: s.oftenHungry === null ? 'too early' : s.oftenHungry < PILOT_TARGETS.oftenHungry ? 'met' : 'not yet' },
    { measure: 'Food waste', target: 'falling, or none', status: wasteOk ? 'met' : s.waste === null ? 'too early' : 'not yet' },
  ];
}

/** Weight direction from the weigh-ins (never the weights themselves); null without a trend. */
export function weightDirection(progress: ProgressEntry[]): 'down' | 'steady' | 'up' | null {
  const t = weightTrend(progress);
  if (!t) return null;
  return t.change <= -0.3 ? 'down' : t.change >= 0.3 ? 'up' : 'steady';
}

/**
 * The file a person can download and choose to share with whoever runs a pilot. It holds the weekly answers above,
 * numbered by week: no name, email, dates, foods, recipes, health answers or weights. The weight direction is
 * included only when the person ticks it.
 */
export function pilotFile(progress: ProgressEntry[], includeWeight = false) {
  const summary = pilotSummary(progress);
  const weight = includeWeight ? weightDirection(progress) : null;
  return {
    app: 'remy',
    kind: 'pilot-summary',
    version: 1,
    summary,
    checks: pilotChecks(summary),
    ...(weight ? { weightDirection: weight } : {}),
    weeks: pilotWeeks(progress),
  };
}

export const PILOT_FILE_NAME = 'remy-pilot-summary.json';
