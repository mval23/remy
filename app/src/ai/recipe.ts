import { allRatings, arr, asPreparations, real, str } from '../interview/helpers';
import { FOODS, WAYS } from '../interview/questions';
import type { Answers } from '../interview/types';
import { ING } from '../planning/data/ingredients';
import { MEAL_IDS, R } from '../planning/data/recipes';
import { check, storage } from '../planning/rules';
import type { Lane, Recipe, Slot, Task } from '../planning/types';

/**
 * AI recipe ideas. The model only proposes; the app decides.
 * - The prompt carries food preferences and constraints, never name, email, weight or health answers.
 * - The model may use only ingredients from Remy's list, so every allergen tag still applies.
 * - Foods are worked out from the ingredients, not taken from the model, so a disliked food can't slip through.
 * - The result must pass the same `check` as every library recipe, and storage times are capped conservatively.
 */

export const AI_PREFIX = 'ai_';
export const isAiRecipe = (id: string) => id.startsWith(AI_PREFIX);

/** Longest the app lets cooked food sit in the fridge, whatever the model says. */
const MAX_FRIDGE_DAYS = 4;
const MAX_FREEZER_MONTHS = 3;
const LANES: Lane[] = ['hands', 'stove', 'oven', 'chill'];
export const MAX_REQUEST_CHARS = 200;

const SLOT_HINT: Record<Slot, string> = {
  Breakfast: 'a breakfast, ideally grab-and-go',
  Lunch: 'a lunch that is packed in a container and reheated or eaten cold at work',
  'Afternoon snack': 'a small afternoon snack',
  Dinner: 'a dinner that is reheated at home',
  'Evening sweet': 'a small, portioned evening sweet, planned and satisfying (never framed as a reward)',
};

/** The JSON shape the model must answer in. */
export function recipeSchema() {
  const ingKeys = Object.keys(ING);
  return {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Full recipe name, under 50 characters' },
      short: { type: 'string', description: 'Short name, under 24 characters' },
      emoji: { type: 'string', description: 'One food emoji' },
      why: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Why it fits this person, tied to their answers' },
      serves: { type: 'integer', minimum: 2, maximum: 8, description: 'Portions per batch' },
      ingredients: {
        type: 'array',
        minItems: 2,
        maxItems: 12,
        items: {
          type: 'object',
          properties: { key: { type: 'string', enum: ingKeys }, qty: { type: 'number', description: 'Quantity per batch, in the listed unit' } },
          required: ['key', 'qty'],
        },
      },
      preparations: {
        type: 'array',
        description: 'How each rated food is prepared, when it matters',
        items: {
          type: 'object',
          properties: { food: { type: 'string', enum: Object.keys(FOODS) }, way: { type: 'string', enum: WAYS } },
          required: ['food', 'way'],
        },
      },
      steps: { type: 'array', minItems: 2, maxItems: 8, items: { type: 'string' } },
      reheat: { type: 'string', description: 'How to eat or reheat a portion, with temperatures' },
      thaw: { type: 'string', description: 'How to thaw if frozen; empty if not frozen' },
      fridge_days: { type: 'integer', minimum: 1, maximum: MAX_FRIDGE_DAYS },
      freezer_months: { type: 'integer', minimum: 0, maximum: MAX_FREEZER_MONTHS, description: '0 if it does not freeze well' },
      eaten_cold: { type: 'boolean' },
      tasks: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        description: 'Prep-day tasks. lane: hands = active work, stove, oven, chill = fridge or freezer time',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            lane: { type: 'string', enum: LANES },
            minutes: { type: 'integer', minimum: 1, maximum: 180 },
            oven_temp_f: { type: 'integer', minimum: 250, maximum: 500 },
          },
          required: ['text', 'lane', 'minutes'],
        },
      },
      kcal: { type: 'integer', minimum: 50, maximum: 1200, description: 'Rough calories per portion' },
      protein_g: { type: 'integer', minimum: 0, maximum: 100, description: 'Rough protein grams per portion' },
      produce_servings: { type: 'number', minimum: 0, maximum: 4, description: 'Fruit and vegetable servings per portion' },
      portion: { type: 'string', description: 'What one portion looks like, in plain words' },
    },
    required: ['name', 'short', 'emoji', 'why', 'serves', 'ingredients', 'steps', 'reheat', 'fridge_days', 'freezer_months', 'tasks', 'kcal', 'protein_g', 'produce_servings', 'portion'],
  };
}

export const SYSTEM_PROMPT = [
  'You are Remy, a warm, practical personal chef for a picky eater who cooks once a week and eats the food over the following days.',
  'Propose exactly one recipe as JSON matching the schema.',
  'Rules:',
  '- Use only ingredient keys from the provided list, with quantities in their units.',
  '- Build the dish around foods the person rated Love or Like. Never use foods they dislike or never eat, or any allergen or diet restriction they listed.',
  '- For foods they only eat certain ways, prepare them only in one of those ways, and list that in "preparations".',
  '- It is cooked on prep day and stored: keep fridge_days realistic (never more than 4) and use freezer_months 0 unless it truly freezes and reheats well.',
  '- Keep it simple for one home cook: few steps, sheet pans, air fryer or one pot where possible.',
  '- Give temperatures in °F and °C for cooking and reheating. Cooked chicken and turkey reach 165°F / 74°C.',
  '- Estimates are rough; do not give medical or diet advice. No shame or guilt language.',
].join('\n');

/** Food preferences and constraints for the prompt. Deliberately leaves out health answers and anything identifying. */
export function profileForAi(A: Answers): string {
  const rat = allRatings(A);
  const ways = asPreparations(A.ways);
  const group = (lvl: string) => Object.keys(rat).filter((f) => rat[f] === lvl).map((f) => FOODS[f]?.n.toLowerCase()).filter(Boolean);
  const onlyWays = Object.keys(rat)
    .filter((f) => rat[f] === 'ways')
    .map((f) => `${FOODS[f].n.toLowerCase()} (only: ${(ways[f] ?? []).join(', ').toLowerCase() || 'unspecified'})`);
  const lines = [
    `Allergies and diet rules (hard constraints): ${[...real(A.allergies), ...arr(A.diet).filter((x) => x !== 'No restrictions'), ...real(A.intolerances)].join(', ') || 'none'}`,
    `Loves: ${group('love').join(', ') || 'none listed'}`,
    `Likes: ${group('like').join(', ') || 'none listed'}`,
    `Okay: ${group('okay').join(', ') || 'none listed'}`,
    `Only certain ways: ${onlyWays.join('; ') || 'none'}`,
    `Dislikes (avoid): ${group('dislike').join(', ') || 'none'}`,
    `Never (avoid completely): ${[...group('never'), ...arr(A.never).map((x) => x.toLowerCase())].join(', ') || 'none'}`,
    `Favorite meals: ${real(A.favorites).join(', ') || 'none listed'}`,
    `Dishes from home they still love: ${arr(A.homedishes).join(', ') || 'none listed'}`,
    `Frozen vegetables and fruit: ${str(A.frozenveg) || 'no preference given'}`,
    `Flavors: ${arr(A.flavors).join(', ') || 'any'}. Sauces: ${arr(A.sauces).join(', ') || 'any'}. Cuisines: ${arr(A.cuisines).join(', ') || 'any'}.`,
    `Spice: ${str(A.spice) || 'mild'}. Textures that are a no: ${arr(A.textures).join(', ') || 'none'}. Mixed dishes: ${str(A.mixed) || 'unknown'}.`,
    `Hidden vegetables: ${str(A.visible) || 'unknown'}. Doesn’t reheat well for them: ${arr(A.reheat).join(', ') || 'nothing noted'}.`,
    `Sweets they love: ${arr(A.sweets).join(', ') || 'any'}.`,
    `Equipment: ${arr(A.equipment).join(', ') || 'oven and stovetop'}. Cooking confidence: ${str(A.skill) || 'unknown'}.`,
  ];
  return lines.join('\n');
}

export function ingredientList(): string {
  return Object.entries(ING)
    .map(([k, g]) => `${k}: ${g.n}${g.u ? ` (${g.u})` : ' (count)'}`)
    .join('\n');
}

/** The full request for one recipe idea. */
export function recipePrompt(A: Answers, slot: Slot, request: string): string {
  const existing = MEAL_IDS.filter((id) => R[id].slot === slot).map((id) => R[id].name);
  const wish = request.trim().slice(0, MAX_REQUEST_CHARS);
  return [
    `Create ${SLOT_HINT[slot]}.`,
    wish ? `They asked for: "${wish}". Follow it if it fits the rules; otherwise get as close as the rules allow.` : 'Surprise them with something new they will probably enjoy.',
    `Don’t repeat these existing recipes: ${existing.join('; ')}.`,
    '',
    'About the person:',
    profileForAi(A),
    '',
    'Ingredients you may use (key: name (unit)):',
    ingredientList(),
  ].join('\n');
}

/* ---------- checking the answer ---------- */

export type AiRecipeResult = { ok: true; recipe: Recipe } | { ok: false; reason: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const text = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const num = (x: unknown, min: number, max: number, fallback: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback);
const texts = (x: unknown, maxItems: number, maxLen: number) => (Array.isArray(x) ? x.map((s) => text(s, maxLen)).filter(Boolean).slice(0, maxItems) : []);

/**
 * Turn the model's answer into a Recipe, or explain why it can't be used.
 * Everything is re-checked here; nothing from the model is trusted as-is.
 */
export function toRecipe(raw: unknown, A: Answers, slot: Slot, id: string): AiRecipeResult {
  if (!isObj(raw)) return { ok: false, reason: 'Remy’s idea came back incomplete.' };
  const name = text(raw.name, 60);
  if (!name) return { ok: false, reason: 'Remy’s idea came back without a name.' };

  const ing: [string, number][] = [];
  if (Array.isArray(raw.ingredients))
    for (const x of raw.ingredients) {
      if (!isObj(x) || typeof x.key !== 'string' || !ING[x.key]) return { ok: false, reason: 'Remy’s idea used an ingredient Remy doesn’t know, so it can’t be safety-checked.' };
      const qty = num(x.qty, 0, 40, 0);
      if (qty <= 0) continue;
      const same = ing.find(([k]) => k === x.key);
      if (same) same[1] += qty;
      else ing.push([x.key, Math.round(qty * 100) / 100]);
    }
  if (ing.length < 2) return { ok: false, reason: 'Remy’s idea didn’t list enough ingredients.' };

  // Foods come from the ingredients themselves; the model only says how they're prepared.
  const preps: Record<string, string> = {};
  if (Array.isArray(raw.preparations))
    for (const p of raw.preparations) if (isObj(p) && typeof p.food === 'string' && typeof p.way === 'string' && WAYS.includes(p.way)) preps[p.food] = p.way;
  const rat = allRatings(A);
  const ways = asPreparations(A.ways);
  const foods: Record<string, 1 | string> = {};
  for (const [k] of ing) {
    const f = ING[k].f;
    if (!f) continue;
    foods[f] = preps[f] ?? 1;
    // A food you eat only certain ways must name one of those ways.
    if (rat[f] === 'ways' && (ways[f]?.length ?? 0) > 0 && !ways[f].includes(String(foods[f])))
      return { ok: false, reason: `Remy’s idea didn’t prepare ${FOODS[f]?.n.toLowerCase() ?? f} one of the ways you eat it.` };
  }

  const tasks: Task[] = [];
  if (Array.isArray(raw.tasks))
    for (const t of raw.tasks) {
      if (!isObj(t) || typeof t.lane !== 'string' || !LANES.includes(t.lane as Lane)) continue;
      const task: Task = { t: text(t.text, 90) || 'Prep', l: t.lane as Lane, m: Math.round(num(t.minutes, 1, 180, 10)) };
      if (task.l === 'oven') task.temp = Math.round(num(t.oven_temp_f, 250, 500, 400));
      tasks.push(task);
    }
  if (!tasks.length) return { ok: false, reason: 'Remy’s idea had no prep-day steps.' };

  const steps = texts(raw.steps, 8, 300);
  if (steps.length < 2) return { ok: false, reason: 'Remy’s idea came back without steps.' };
  const freezer = Math.round(num(raw.freezer_months, 0, MAX_FREEZER_MONTHS, 0));
  const emoji = text(raw.emoji, 8);

  const recipe: Recipe = {
    id,
    name,
    short: text(raw.short, 28) || name.slice(0, 28),
    slot,
    e: emoji && [...emoji].length <= 3 ? emoji : '🍽️',
    serves: Math.round(num(raw.serves, 2, 8, 4)),
    fridge: Math.round(num(raw.fridge_days, 1, MAX_FRIDGE_DAYS, 3)),
    freezer,
    cold: raw.eaten_cold === true ? true : undefined,
    foods,
    ing,
    why: texts(raw.why, 3, 160),
    note: 'A new idea from Remy’s AI. Checked against your safety rules and ratings; amounts and nutrition are rough estimates.',
    steps,
    reheat: text(raw.reheat, 300) || 'Reheat until steaming hot all the way through.',
    thaw: freezer ? text(raw.thaw, 200) || 'Move to the fridge the night before.' : undefined,
    tasks,
    kcal: Math.round(num(raw.kcal, 50, 1200, 400)),
    pro: Math.round(num(raw.protein_g, 0, 100, 10)),
    prod: Math.round(num(raw.produce_servings, 0, 4, 0) * 4) / 4,
    plate: text(raw.portion, 200) || `One of ${Math.round(num(raw.serves, 2, 8, 4))} portions.`,
  };
  if (!recipe.thaw) delete recipe.thaw;
  if (!recipe.cold) delete recipe.cold;

  const c = check(recipe, A);
  if (!c.ok) return { ok: false, reason: `Remy’s idea didn’t fit your rules (${c.reason.toLowerCase()}), so it was thrown out.` };
  return { ok: true, recipe };
}

/** Can this recipe go on this day (1–7 after prep)? */
export const safeOnDay = (r: Recipe, day: number) => storage(r, day).k !== 'unsafe';
