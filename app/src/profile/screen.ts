import { has } from '../interview/helpers';
import type { Answers } from '../interview/types';
import type { Risk } from '../planning/types';

/**
 * The health and age screen: who should not get a weight-loss plan from Remy, and which foods need extra care.
 * General food-safety guidance, not medical advice; a registered dietitian should review the wording and thresholds.
 */

export const AGE_OPTS = ['Under 18', '18–64', '65 or older', 'Prefer not to say'];

/** Health answers that switch Remy out of weight-loss planning. */
export const PREGNANT = 'Pregnancy';
export const BREASTFEEDING = 'Breastfeeding';
export const EATING_DISORDER = 'An eating disorder, now or in the past';

/**
 * standard: the usual planning.
 * gentle: 65 or older; later phases limit the pace to Gentle.
 * refer: pregnant, breastfeeding, under 18, or an eating disorder now or in the past. No weight-loss planning,
 * no calorie or protein goals, no weight tracking; a doctor or registered dietitian is the right guide.
 */
export type CareMode = 'standard' | 'gentle' | 'refer';

export function careMode(A: Answers): CareMode {
  if (has(A.health, PREGNANT) || has(A.health, BREASTFEEDING) || has(A.health, EATING_DISORDER) || A.age === 'Under 18') return 'refer';
  if (A.age === '65 or older') return 'gentle';
  return 'standard';
}

export const noWeightLoss = (A: Answers) => careMode(A) === 'refer';

/** What each risk means, in plain words. */
export const RISK_LABEL: Record<Risk, string> = {
  'raw-egg': 'Egg sauce that doesn’t fully cook',
  'soft-egg': 'Egg with a runny yolk',
  'fresh-cheese': 'Queso fresco served unheated',
};

/**
 * Food risks to avoid for this person. Pregnancy: eggs cooked until firm, fresh cheese only when heated
 * until steaming (Listeria). 65 or older: no egg sauces that don't fully cook.
 */
export function riskFlags(A: Answers): Risk[] {
  const out = new Set<Risk>();
  if (has(A.health, PREGNANT)) for (const r of ['raw-egg', 'soft-egg', 'fresh-cheese'] as Risk[]) out.add(r);
  if (A.age === '65 or older') out.add('raw-egg');
  return [...out];
}

/** Remy's reply when the answers mean no weight-loss planning. */
export const REFER_NOTE =
  'Because of what you shared, I won’t plan for weight loss or show calorie targets. I’ll keep your meals regular and balanced, and a doctor or registered dietitian is the right guide for anything more.';
