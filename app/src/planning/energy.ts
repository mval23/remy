import { has } from '../interview/helpers';
import type { Answers } from '../interview/types';
import { careMode } from '../profile/screen';

/**
 * The optional daily estimate: a starting calorie and protein target from age, height, weight and activity.
 * Mifflin-St Jeor resting energy × a cautious activity factor, a modest deficit with floors, protein from a reference
 * weight. A rough starting point (about ±10%), not medical advice; see the nutrition audit, section 5.
 * Pure: the body details live in a device-only storage row (`storage/db.ts`), never in synced data.
 */

export type Sex = 'female' | 'male' | 'average';
export type Pace = 'gentle' | 'steady';

/** Usual activity, as worded to the person, and its activity factor (deliberately cautious at the top end). */
export const ACTIVITY: { pal: number; label: string; d: string }[] = [
  { pal: 1.35, label: 'Mostly sitting', d: 'Little planned exercise' },
  { pal: 1.5, label: 'Lightly active', d: 'On my feet some of the day, or light exercise 1–3 times a week' },
  { pal: 1.65, label: 'Active', d: 'An active job, or exercise most days' },
  { pal: 1.8, label: 'Very active', d: 'Hard physical work or training most days' },
];

/** What the person typed. Kept on this device only. */
export interface BodyProfile {
  /** They read what Remy does with these details and chose to go on. */
  consent: boolean;
  ageYears: number | null;
  sex: Sex | null;
  heightCm: number | null;
  weightKg: number | null;
  /** Activity factor from `ACTIVITY`. */
  pal: number | null;
  pace: Pace;
  updatedAt: number;
  /** Sync these details and weigh-ins with the account (the 'user_health' table). Off by default, per device. */
  sync: boolean;
}
export const emptyBody = (): BodyProfile => ({ consent: false, ageYears: null, sex: null, heightCm: null, weightKg: null, pal: null, pace: 'gentle', updatedAt: 0, sync: false });

export interface EnergyPlan {
  /** Resting energy (kcal/day), to the nearest 5. */
  ree: number;
  /** Total daily energy (kcal/day), to the nearest 5. */
  tdee: number;
  /** Share taken off total energy, before the 500 kcal cap. */
  deficit: number;
  /** Daily target (kcal), to the nearest 50; never under `floor`. */
  target: number;
  /** The lowest Remy plans: 1,200 (female equation), 1,500 (male), 1,350 (average), or resting energy if higher. */
  floor: number;
  /** Target ± 10%, to the nearest 50, never under the floor. */
  range: [number, number];
  /** Daily protein (g, nearest 5), or null when a professional should set it (kidney disease). */
  proteinG: number | null;
  /** Fat floor (g): 20% of the target, at least 40 g. */
  fatMinG: number;
  /** Fiber (g): 14 per 1,000 kcal, at least 25. */
  fiberG: number;
  /** About 8% of the target for the evening sweet (kcal, nearest 10). */
  sweetKcal: number;
  bmi: number;
  /** The reference weight protein is based on (kg): actual weight, capped at a BMI of 25. */
  refKg: number;
  /** Plain-language notes, e.g. why the pace is gentle. */
  notes: string[];
}

export type EnergyResult =
  | { ok: true; plan: EnergyPlan }
  | { ok: false; why: 'incomplete' | 'refer' | 'age' | 'underweight' | 'clinician'; reason: string };

const round = (x: number, step: number) => Math.round(x / step) * step;

/** Typed values Remy accepts; anything else asks the person to check. */
export const LIMITS = { age: [18, 100], height: [130, 220], weight: [35, 250] } as const;
const within = (x: number | null, [lo, hi]: readonly [number, number]) => x !== null && x >= lo && x <= hi;

export function energyTargets(b: BodyProfile, A: Answers): EnergyResult {
  if (careMode(A) === 'refer')
    return { ok: false, why: 'refer', reason: 'From your health answers, Remy doesn’t work out a calorie target for you. A doctor or registered dietitian is the right guide.' };
  if (has(A.health, 'Blood sugar or diabetes'))
    return { ok: false, why: 'clinician', reason: 'With blood sugar or diabetes in the picture, a calorie target should come from your doctor or dietitian, since eating less can change how medicines work. You can type their numbers instead.' };
  if (b.ageYears !== null && b.ageYears < 18) return { ok: false, why: 'age', reason: 'Remy only works out estimates for adults. A doctor can help with targets while you’re still growing.' };
  if (!within(b.ageYears, LIMITS.age) || !within(b.heightCm, LIMITS.height) || !within(b.weightKg, LIMITS.weight) || !b.sex || !b.pal)
    return { ok: false, why: 'incomplete', reason: 'Fill in all the details to see your estimate.' };

  const w = b.weightKg!, h = b.heightCm!, a = b.ageYears!;
  const base = 10 * w + 6.25 * h - 5 * a;
  const ree = b.sex === 'male' ? base + 5 : b.sex === 'female' ? base - 161 : base - 78;
  const tdee = ree * b.pal;
  const bmi = w / (h / 100) ** 2;
  if (bmi < 18.5) return { ok: false, why: 'underweight', reason: 'At your height and weight, losing weight isn’t something Remy will plan for. A doctor or dietitian can help if you have concerns.' };

  const notes: string[] = [];
  const gentleOnly = careMode(A) === 'gentle' || a >= 65 || bmi < 23;
  if (b.pace === 'steady' && gentleOnly) notes.push(a >= 65 ? 'Gentle pace, since keeping muscle matters more than the scale after 65.' : 'Gentle pace, since you’re already close to a typical weight for your height.');
  const deficit = b.pace === 'steady' && !gentleOnly ? 0.15 : 0.1;
  const sexFloor = b.sex === 'male' ? 1500 : b.sex === 'female' ? 1200 : 1350;
  const floor = Math.max(sexFloor, round(ree, 50));
  const target = Math.max(floor, round(tdee - Math.min(deficit * tdee, 500), 50));
  const refKg = Math.min(w, 25 * (h / 100) ** 2);
  const kidney = has(A.health, 'Kidney disease');
  if (kidney) notes.push('No protein target: with kidney disease, protein should come from your doctor or dietitian.');
  if (has(A.health, 'Appetite medicine, like GLP-1')) notes.push('With appetite medicine, protein at every meal matters most; never go under the floor even if you’re not hungry.');
  return {
    ok: true,
    plan: {
      ree: round(ree, 5),
      tdee: round(tdee, 5),
      deficit,
      target,
      floor,
      range: [Math.max(floor, round(target * 0.9, 50)), round(target * 1.1, 50)],
      proteinG: kidney ? null : Math.min(160, round(1.4 * refKg, 5)),
      fatMinG: Math.max(40, Math.round((0.2 * target) / 9)),
      fiberG: Math.max(25, Math.round((14 * target) / 1000)),
      sweetKcal: round(0.08 * target, 10),
      bmi: Math.round(bmi * 10) / 10,
      refKg: Math.round(refKg),
      notes,
    },
  };
}
