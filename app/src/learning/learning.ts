import { allRatings, listText } from '../interview/helpers';
import { approvedCount, planAhead } from '../planning/ahead';
import { FOOD_GROUP_A, FOODS } from '../interview/questions';
import type { Answers } from '../interview/types';
import { R, SIDE_IDS } from '../planning/data/recipes';
import { WEEKS } from '../planning/data/weeks';
import { emptyGroceryEdits } from '../planning/grocery';
import { dayNutrition, sideOptions } from '../planning/nutrition';
import { fitToGoals, goalsOf, hasGoals } from '../planning/goals';
import { buildPlan, eachMeal } from '../planning/planner';
import { duration, schedule } from '../planning/schedule';
import { dayIndexOn } from '../planning/calendar';
import { AVOID_AT, check, context, defaultVariety, kosherClash, storage, type PlanContext } from '../planning/rules';
import type { PlanDay, Slot, Variety, WeekPlan } from '../planning/types';
import { inferences, type Confidence } from '../profile/profile';
import type { PlanState } from '../storage/planState';
import { emptyCheckin, type LearnedItem, type Noticed, type ProgressEntry } from './types';

/**
 * Learning after the interview: weekly check-ins, “Remy noticed” suggestions, and the learned list.
 * Every learned item records its effect so deleting it reverses exactly that effect.
 */

const ADJ_MIN = -8;
const ADJ_MAX = 6;
const clamp = (n: number) => Math.max(ADJ_MIN, Math.min(ADJ_MAX, n));

let seq = 0;
const newId = (at: number) => `L${at}-${++seq}`;

function learnedItem(at: number, text: string, src: string, conf: Confidence, extra: Partial<LearnedItem> = {}): LearnedItem {
  return { id: newId(at), text, src, conf, at, ...extra };
}

const dateText = (at: number) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/* ---------- “Remy noticed”: try a disliked vegetable once, cooked a way that often works ---------- */

/** Disliked foods that have a side worth one low-pressure try. */
const TRIALS: Record<string, string> = {
  zucchini: 'side_zucchini',
  greenbeans: 'side_greenbeans',
  broccoli: 'side_broc',
  carrots: 'side_carrots',
};

export interface Suggestion {
  food: string;
  side: string;
  idea: string;
  text: string;
}

/** Answers with one food's Dislike lifted, to check a trial side against every other rule. */
function withFoodOkay(A: Answers, food: string): Answers {
  const key = FOOD_GROUP_A.includes(food) ? 'rateA' : 'rateB';
  return { ...A, [key]: { ...allRatings(A), [food]: 'okay' } };
}

/**
 * The next suggestion to show, or null.
 * Only for foods rated Dislike (never Never), only if the user is open to retrying foods,
 * and only when the side passes every safety rule and every other preference.
 */
export function noticeSuggestion(A: Answers, noticed: Record<string, Noticed>): Suggestion | null {
  if (A.newfoods === 'Stick to what I know' || A.retry === 'No thanks') return null;
  const rat = allRatings(A);
  const crispy = inferences(A).some((x) => x.id === 'crispy');
  for (const [food, side] of Object.entries(TRIALS)) {
    if (rat[food] !== 'dislike' || noticed[food] || !SIDE_IDS.includes(side)) continue;
    if (!check(R[side], withFoodOkay(A, food)).ok) continue;
    const idea = R[side].name.toLowerCase();
    const lead = crispy ? 'You like crispy food and rated' : 'You rated';
    return { food, side, idea, text: `${lead} ${FOODS[food].n.toLowerCase()} Dislike. Want to try ${idea} once next week, as a side? No pressure either way.` };
  }
  return null;
}

/** Record an answer to a suggestion. “yes” adds the side to next week, once. */
export function answerSuggestion(state: PlanState, s: Suggestion, answer: Noticed, at = Date.now()): PlanState {
  const noticed = { ...state.noticed, [s.food]: answer };
  if (answer === 'yes')
    return {
      ...state,
      noticed,
      trial: s.side,
      learned: [learnedItem(at, `Open to trying ${s.idea} once`, `You said yes on ${dateText(at)}`, 'medium', { effect: 'trial', food: s.food }), ...state.learned],
    };
  if (answer === 'stop')
    return {
      ...state,
      noticed,
      learned: [learnedItem(at, `Don’t suggest retrying ${FOODS[s.food].n.toLowerCase()}`, 'You asked Remy to stop asking', 'high', { effect: 'noticed', food: s.food }), ...state.learned],
    };
  return { ...state, noticed };
}

/* ---------- weekly check-in ---------- */

/**
 * From the last two days of the week (or once it's over), when a check-in can shape the next one.
 * Right after a check-in the new week hasn't started yet, so it isn't due.
 */
export const checkinDue = (A: Answers, weekStartedAt: number, date = new Date()) => dayIndexOn(A, weekStartedAt, date) >= 5;

/** Meals from this week to rate (sides aren't rated), with how often each was planned. */
export function mealsToRate(plan: WeekPlan): { id: string; times: number }[] {
  const times: Record<string, number> = {};
  eachMeal(plan, (m) => {
    if (m.r && !R[m.r].side) times[m.r] = (times[m.r] ?? 0) + 1;
  });
  return Object.entries(times).map(([id, n]) => ({ id, times: n }));
}

export const NOT_AGAIN_REASONS = ['Taste', 'Texture', 'Too much effort', 'Reheated badly', 'Got bored of it'];

export interface CheckinQuestion {
  id: string;
  q: string;
  o: string[];
}

/** A few short questions about the week. */
export function weekQuestions(plan: WeekPlan, A: Answers, state: PlanState): CheckinQuestion[] {
  const out: CheckinQuestion[] = [];
  let sweet = false;
  eachMeal(plan, (m, slot) => {
    if (slot === 'Evening sweet' && m.r) sweet = true;
  });
  if (sweet) out.push({ id: 'sweet', q: 'Did the evening sweet portion feel like enough?', o: ['Yes, satisfied', 'I wanted more', 'It was too much'] });
  out.push({ id: 'prep', q: 'Was prep day the right length?', o: ['Too long', 'About right', 'I could do more'] });
  out.push({ id: 'ate', q: 'How much of the planned food did you eat?', o: ATE });
  const s = noticeSuggestion(A, state.noticed);
  if (s && !state.trial) out.push({ id: 'try', q: `Want to try ${s.idea} next week?`, o: ['Sure, once', 'Not yet'] });
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Answers to “How much of the planned food did you eat?”, most first. */
export const ATE = ['All or nearly all', 'Most of it', 'About half', 'Not much'];
const ateMost = (a: string | undefined) => a === ATE[0] || a === ATE[1];
const ateLittle = (a: string | undefined) => a === ATE[2] || a === ATE[3];

/** Weekly weight change as a share of body weight (% a week, positive = losing), from weigh-ins over the last 5 weeks. Null until there are 3 spanning 2 weeks or more. */
export function weeklyLossPct(progress: ProgressEntry[], at: number): number | null {
  const kg = (p: ProgressEntry) => (p.unit === 'lb' ? p.weight! * KG_PER_LB : p.weight!);
  const w = progress.filter((p) => p.weight && at - p.at <= 35 * DAY_MS).sort((a, b) => a.at - b.at);
  if (w.length < 3) return null;
  const days = (w[w.length - 1].at - w[0].at) / DAY_MS;
  if (days < 14) return null;
  return ((kg(w[0]) - kg(w[w.length - 1])) / kg(w[0])) * 100 / (days / 7);
}

/** At most this often (and by this much) a check-in changes an estimate-based target. */
export const ADJUST_EVERY_DAYS = 14;
export const ADJUST_KCAL = 100;

/**
 * A check-in's proposal for an estimate-based calorie target (audit, section 5): raise it when someone is often
 * hungry or low on energy two check-ins running, or losing more than 1% a week; lower it when weight has held
 * steady for 3 weeks while they ate most of the planned food and weren't often hungry; leave it when they ate
 * half or less, since taste and effort come first. Typed targets (their own or a professional's) are never changed.
 */
export function proposeAdjustment(state: PlanState, q: Record<string, string>, progress: ProgressEntry[], at: number): { delta: number; why: string } | null {
  const n = state.nutrition;
  const target = Number(n.kcal);
  if (n.from !== 'estimate' || !target) return null;
  if (at - (n.adjustedAt ?? 0) < ADJUST_EVERY_DAYS * DAY_MS) return null;
  const prev = progress[1];
  if ((q.hunger === 'Often hungry' && prev?.hunger === 'Often hungry') || (q.energy === 'Low' && prev?.energy === 'Low'))
    return { delta: ADJUST_KCAL, why: q.hunger === 'Often hungry' ? 'you were often hungry two check-ins running' : 'your energy was low two check-ins running' };
  const rate = weeklyLossPct(progress, at);
  if (rate !== null && rate > 1) return { delta: ADJUST_KCAL, why: 'you’re losing more than 1% of your weight a week, faster than Remy aims for' };
  if (ateLittle(q.ate)) return { delta: 0, why: 'you ate about half of the planned food or less, so taste and effort come first' };
  if (rate !== null && rate < 0.2 && ateMost(q.ate) && q.hunger !== 'Often hungry' && target - ADJUST_KCAL >= (n.floor ?? 0))
    return { delta: -ADJUST_KCAL, why: 'your weight has held steady for a few weeks while you ate most of the planned food' };
  return null;
}

/** Body check-in, unless the user chose not to track. Weight is separate and opt-in. */
export const bodyCheckinOn = (A: Answers) => A.progress !== 'I’d rather not track';
export const weightOn = (A: Answers) => A.progress === 'Add an optional weekly weight';
export const BODY_QUESTIONS: CheckinQuestion[] = [
  { id: 'hunger', q: 'How was your hunger between meals?', o: ['Often hungry', 'Mostly fine', 'Too full'] },
  { id: 'energy', q: 'How was your energy?', o: ['Low', 'Okay', 'Good'] },
  { id: 'fit', q: 'How do your clothes fit?', o: ['Looser', 'About the same', 'Tighter', 'Not sure'] },
];

const VARIETY_ORDER: Variety[] = ['favorites', 'balanced', 'variety'];

/** Add sides to a day that looks light, one per meal, until it no longer does. */
export function fillLightDay(day: PlanDay, dayIndex: number, ctx: PlanContext): PlanDay {
  const meals = Object.fromEntries(Object.entries(day.meals).map(([k, m]) => [k, { ...m }])) as PlanDay['meals'];
  const next: PlanDay = { ...day, meals };
  for (const slot of ['Lunch', 'Dinner', 'Afternoon snack', 'Breakfast'] as Slot[]) {
    if (!dayNutrition(next, ctx.hungry).light) break;
    const m = meals[slot];
    if (!m?.r || m.side) continue;
    const used = Object.values(meals).map((x) => x?.side);
    const side = sideOptions(ctx, dayIndex, slot, undefined, m.r).find((x) => !used.includes(x.id));
    if (side) m.side = side.id;
  }
  return next;
}

/** Put a trial side on the first lunch or dinner where it's safe to store, replacing any side there (never dairy with meat for Kosher). */
export function placeTrial(plan: WeekPlan, sideId: string, A: Answers = {}): WeekPlan {
  const side = R[sideId];
  for (let i = 0; i < plan.length; i++) {
    if (storage(side, i + 1).k === 'unsafe') break;
    for (const slot of ['Dinner', 'Lunch'] as Slot[]) {
      const m = plan[i].meals[slot];
      if (m?.r && side.for?.includes(slot) && !kosherClash(A, R[m.r], side)) return plan.map((d, j) => (j === i ? { ...d, meals: { ...d.meals, [slot]: { ...m, side: sideId } } } : d));
    }
  }
  return plan;
}

export interface CheckinResult {
  /** What Remy will change, in plain words. Every line matches something `next` actually does. */
  changes: string[];
  /** The state after saving: learning applied and next week planned. */
  next: PlanState;
}

/**
 * Apply a weekly check-in and plan the next week.
 * Used both to preview the changes and to save them, so the list shown is exactly what happens.
 */
export function applyCheckin(state: PlanState, A: Answers, at = Date.now()): CheckinResult {
  const d = state.checkin;
  const src = `Weekly check-in · ${dateText(at)}`;
  const changes: string[] = [];
  const learned: LearnedItem[] = [];
  const adj = { ...state.adj };
  let { hungry, sweetPortion, trial, noticed } = state;
  let kept = state.learned;
  const learn = (text: string, conf: Confidence, extra?: Partial<LearnedItem>) => learned.push(learnedItem(at, text, src, conf, extra));

  for (const [id, v] of Object.entries(d.rated)) {
    const r = R[id];
    if (!r) continue;
    const name = r.short.toLowerCase();
    const now = adj[id] ?? 0;
    if (v === 'loved') {
      const delta = clamp(now + 2) - now;
      adj[id] = now + delta;
      learn(`Loves ${name}`, 'high', { recipe: id, adj: delta });
      changes.push(`Keep ${name} in rotation`);
    } else if (v === 'no') {
      // Low enough to leave it out of new weeks, however well it scored before.
      const delta = clamp(Math.min(now - 4, AVOID_AT)) - now;
      adj[id] = now + delta;
      const why = d.why[id] ?? [];
      learn(`Not a fan of ${name}${why.length ? ` (${why.join(', ').toLowerCase()})` : ''}`, 'high', { recipe: id, adj: delta });
      changes.push(`Leave ${name} out of new weeks`);
    }
  }

  const q = d.q;
  if (q.sweet === 'I wanted more' || q.sweet === 'It was too much') {
    sweetPortion = q.sweet === 'I wanted more' ? 'more' : 'less';
    kept = kept.filter((x) => x.effect !== 'sweetPortion');
    learn(sweetPortion === 'more' ? 'Evening sweet portion could be a bit bigger' : 'Prefers a smaller evening sweet', 'medium', { effect: 'sweetPortion' });
    changes.push(sweetPortion === 'more' ? 'Suggest a slightly bigger portion on your sweet recipes' : 'Suggest a smaller portion on your sweet recipes');
  }

  let variety: Variety = state.variety ?? defaultVariety(A);
  const vi = VARIETY_ORDER.indexOf(variety);
  if (q.prep === 'Too long') {
    learn('Prep day felt too long', 'high');
    if (vi > 0) {
      variety = VARIETY_ORDER[vi - 1];
      changes.push(`Switch to “${WEEKS[variety].label}”, which has fewer recipes to cook`);
    } else changes.push('Prep day is already at its shortest. Changing your prep-time answer lets Remy plan fewer recipes');
  } else if (q.prep === 'I could do more' && vi < VARIETY_ORDER.length - 1) {
    variety = VARIETY_ORDER[vi + 1];
    learn('Has time for more variety on prep day', 'medium');
    changes.push(`Switch to “${WEEKS[variety].label}” for more variety`);
  }

  if (q.try) {
    const s = noticeSuggestion(A, noticed);
    if (s) {
      noticed = { ...noticed, [s.food]: q.try === 'Sure, once' ? 'yes' : 'no' };
      if (q.try === 'Sure, once') {
        trial = s.side;
        learn(`Open to trying ${s.idea} once`, 'medium', { effect: 'trial', food: s.food });
      }
    }
  }
  if (trial) changes.push(`Add ${R[trial].name.toLowerCase()} as a side, once`);

  const entry: ProgressEntry = { at };
  if (q.hunger) entry.hunger = q.hunger;
  if (q.energy) entry.energy = q.energy;
  if (q.fit) entry.fit = q.fit;
  const w = Number(d.weight);
  if (weightOn(A) && d.weight.trim() && w > 0 && w < 1500) {
    entry.weight = w;
    entry.unit = d.unit;
  }
  const progress = Object.keys(entry).length > 1 ? [entry, ...state.progress] : state.progress;

  if (q.hunger === 'Often hungry') {
    if (!hungry) {
      hungry = true;
      learn('Gets hungry between meals: aim higher on protein', 'high', { effect: 'hungry' });
    }
    changes.push('Aim 5 g higher on protein at breakfast, lunch and dinner');
  } else if ((q.hunger === 'Mostly fine' || q.hunger === 'Too full') && hungry) {
    hungry = false;
    kept = kept.filter((x) => x.effect !== 'hungry');
    changes.push('Go back to the usual protein guide');
  }
  // An estimate-based target can move by 100 kcal, at most every 2 weeks.
  let nutrition = state.nutrition;
  const adjust = proposeAdjustment(state, q, progress, at);
  if (adjust && adjust.delta) {
    const kcal = Number(nutrition.kcal) + adjust.delta;
    nutrition = { ...nutrition, kcal: String(kcal), adjustedAt: at };
    learn(`Daily target ${adjust.delta > 0 ? 'up' : 'down'} ${Math.abs(adjust.delta)} kcal: ${adjust.why}`, 'medium', { effect: 'target', kcal: adjust.delta });
    changes.push(`Aim for about ${kcal.toLocaleString('en-US')} kcal a day (${adjust.delta > 0 ? '+' : '−'}${Math.abs(adjust.delta)}), since ${adjust.why}`);
  } else if (adjust) changes.push(`Keep your daily target as it is, since ${adjust.why}`);
  const lowEnergy = q.energy === 'Low';
  if (lowEnergy) {
    learn('Low energy this week: avoid light days', 'medium');
    changes.push('Add sides from your foods to any day that looks light. If low energy continues, check in with a doctor');
  }

  // This week's meals become "recent", so the new week rotates some of them out.
  const recent = state.plan ? mealsToRate(state.plan).map((m) => m.id) : [];
  const ctx = context(A, adj, hungry, recent, state.shopDays);
  // Next week comes from the weeks planned ahead: meals approved early stay, the drafts follow what Remy just learned.
  const next = state.ahead?.[0];
  const keptAhead = next ? approvedCount(next) : 0;
  const built = buildPlan(variety, ctx, next);
  let plan = built.plan;
  for (const f of built.fixes) changes.push(f);
  if (trial) plan = placeTrial(plan, trial, A);
  if (lowEnergy) plan = plan.map((day, i) => (dayNutrition(day, hungry).light ? fillLightDay(day, i, ctx) : day));
  // Daily goals the person set: fit the new week toward them.
  const goals = goalsOf(nutrition, A);
  if (hasGoals(goals)) plan = fitToGoals(plan, ctx, goals).plan;
  if (keptAhead) changes.push(`Keep the ${keptAhead} meal${keptAhead > 1 ? 's' : ''} you approved ahead for next week`);
  // The rest of the month moves up a week, and a new week is drafted at the end.
  const ahead = state.ahead?.length ? planAhead(plan, state.ahead.slice(1), variety, ctx, goals, state.ahead.length) : [];
  const fresh = mealsToRate(plan).filter((m) => !recent.includes(m.id)).map((m) => R[m.id].short);
  if (recent.length && fresh.length) changes.push(`New next week: ${listText(fresh)}`);
  const before = state.plan ? schedule(state.plan, A).total : 0;
  const after = schedule(plan, A).total;
  changes.push(`Plan a new week (prep day about ${duration(after)}${before ? `, this week was ${duration(before)}` : ''}) and start a fresh grocery list`);

  return {
    changes,
    next: {
      ...state,
      plan,
      ahead,
      variety,
      day: 0,
      weekStartedAt: at,
      recent,
      // Pantry answers carry over; everything else on the list belongs to the old week.
      groceries: { ...emptyGroceryEdits(), have: state.groceries.have },
      adj,
      hungry,
      sweetPortion,
      nutrition,
      trial: null,
      noticed,
      learned: [...learned, ...kept],
      checkin: emptyCheckin(),
      progress,
    },
  };
}

/* ---------- planner rejections ---------- */

/** A meal replaced from “Not this”: rank it lower from now on. */
export function learnFromRejection(state: PlanState, recipeId: string, why: string | null, at = Date.now()): PlanState {
  const now = state.adj[recipeId] ?? 0;
  const delta = clamp(now - (why ? 2 : 1)) - now;
  const name = R[recipeId].short.toLowerCase();
  return {
    ...state,
    adj: { ...state.adj, [recipeId]: now + delta },
    learned: [learnedItem(at, `Skipped ${name}${why ? ` (${why.toLowerCase()})` : ''}`, `Replaced in the planner · ${dateText(at)}`, 'low', { recipe: recipeId, adj: delta }), ...state.learned],
  };
}

/* ---------- deleting what Remy learned ---------- */

function reverse(state: PlanState, x: LearnedItem): PlanState {
  let s = state;
  if (x.recipe && x.adj) {
    const adj = { ...s.adj, [x.recipe]: (s.adj[x.recipe] ?? 0) - x.adj };
    if (adj[x.recipe] === 0) delete adj[x.recipe];
    s = { ...s, adj };
  }
  if (x.effect === 'hungry') s = { ...s, hungry: false };
  if (x.effect === 'sweetPortion') s = { ...s, sweetPortion: null };
  if (x.effect === 'target' && x.kcal && s.nutrition.from === 'estimate' && Number(s.nutrition.kcal))
    s = { ...s, nutrition: { ...s.nutrition, kcal: String(Number(s.nutrition.kcal) - x.kcal) } };
  if ((x.effect === 'trial' || x.effect === 'noticed') && x.food) {
    const noticed = { ...s.noticed };
    delete noticed[x.food];
    s = { ...s, noticed, trial: x.effect === 'trial' && s.trial === TRIALS[x.food] ? null : s.trial };
  }
  return s;
}

/** Delete one learned item and undo its effect. */
export function forgetLearned(state: PlanState, id: string): PlanState {
  const x = state.learned.find((l) => l.id === id);
  if (!x) return state;
  return { ...reverse(state, x), learned: state.learned.filter((l) => l.id !== id) };
}

/** Delete everything learned or inferred. Interview answers stay. */
export function forgetAllLearned(state: PlanState, A: Answers): PlanState {
  const hiddenInferences = { ...state.hiddenInferences };
  for (const x of inferences(A)) hiddenInferences[x.id] = true;
  return { ...state, learned: [], adj: {}, hungry: false, sweetPortion: null, trial: null, noticed: {}, hiddenInferences };
}

/* ---------- progress ---------- */

const KG_PER_LB = 0.45359237;

/**
 * Weight change in kg over the last 3–4 check-ins that include a weight.
 * Null until there are at least 3, because single weeks jump around.
 * Entries saved in lb by earlier versions are converted.
 */
export function weightTrend(progress: ProgressEntry[]): { entries: number; change: number; unit: 'kg' } | null {
  const w = progress.filter((p) => p.weight).slice(0, 4);
  if (w.length < 3) return null;
  const kg = (p: ProgressEntry) => (p.unit === 'lb' ? p.weight! * KG_PER_LB : p.weight!);
  const change = Math.round((kg(w[0]) - kg(w[w.length - 1])) * 10) / 10;
  return { entries: w.length, change, unit: 'kg' };
}
