import { afterEach, describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview, type Answers } from '../interview/types';
import { QBY } from '../interview/questions';
import { ING } from '../planning/data/ingredients';
import { MEAL_IDS, R, registerAiRecipes } from '../planning/data/recipes';
import { groceryList } from '../planning/grocery';
import { emptyGroceryEdits } from '../planning/grocery';
import { macrosOf } from '../planning/macros';
import { buildPlan, replaceMeal } from '../planning/planner';
import { context } from '../planning/rules';
import { schedule } from '../planning/schedule';
import { ingredientList, profileForAi, recipePrompt, recipeSchema, safeOnDay, toRecipe } from './recipe';

const SAMPLE: Answers = activeAnswers(fillWithSamples(emptyInterview()));
const with_ = (patch: Answers): Answers => ({ ...SAMPLE, ...patch });

/** A well-formed answer, as the model should send it. */
const good = (patch: Record<string, unknown> = {}) => ({
  name: 'Crispy honey-mustard chicken bowls',
  short: 'Honey-mustard bowls',
  emoji: '🍗',
  why: ['Chicken and rice, both rated Love', 'Honey mustard is one of your sauces'],
  serves: 4,
  ingredients: [
    { key: 'chickenbreast', qty: 1.5 },
    { key: 'rice', qty: 1 },
    { key: 'broccoli', qty: 2 },
    { key: 'honeymustard', qty: 0.5 },
  ],
  preparations: [{ food: 'broccoli', way: 'Roasted until crispy' }],
  steps: ['Roast chicken and broccoli at 220°C for 25 minutes.', 'Portion with rice and drizzle with sauce.'],
  reheat: 'Microwave 2 minutes until steaming, 74°C inside.',
  thaw: '',
  fridge_days: 4,
  freezer_months: 0,
  tasks: [
    { text: 'Cut chicken and broccoli', lane: 'hands', minutes: 10 },
    { text: 'Roast chicken and broccoli', lane: 'oven', minutes: 25, oven_temp_c: 220 },
  ],
  kcal: 560,
  protein_g: 38,
  produce_servings: 1.5,
  portion: 'One container is one portion.',
  ...patch,
});

afterEach(() => registerAiRecipes({}));

describe('what is sent to the AI', () => {
  it('includes food preferences and allergy rules, but never health answers', () => {
    const A = with_({ health: ['Diabetes', 'Pregnancy'] });
    const p = recipePrompt(A, 'Lunch', 'something crispy');
    expect(p).toContain('Shellfish');
    expect(p).toContain('chicken');
    expect(p).toContain('something crispy');
    expect(p).not.toMatch(/diabetes|pregnan/i);
  });

  it('never includes any health, age, weight or calorie answer', () => {
    const opts = (id: string) => (QBY[id].opts ?? []).map((o) => (typeof o === 'string' ? o : o.v)).filter((o) => o !== 'None' && o !== 'Prefer not to say');
    const A = with_({ health: opts('health'), age: opts('age')[0], calories: '1777', progress: 'Weekly weigh-in', pace: 'Detailed' });
    const p = recipePrompt(A, 'Dinner', '');
    for (const o of [...opts('health'), ...opts('age')]) expect(p, o).not.toContain(o);
    expect(p).not.toContain('1777');
    expect(p).not.toMatch(/weigh/i);
  });

  it('lists only ingredients Remy knows, and the schema allows only those keys', () => {
    const schema = recipeSchema() as { properties: { ingredients: { items: { properties: { key: { enum: string[] } } } } } };
    expect(schema.properties.ingredients.items.properties.key.enum.sort()).toEqual(Object.keys(ING).filter((k) => !ING[k].retired).sort());
    expect(ingredientList()).not.toContain('thighs');
    expect(profileForAi(SAMPLE)).toContain('Never (avoid completely)');
  });

  it('keeps typed requests short', () => {
    expect(recipePrompt(SAMPLE, 'Dinner', 'x'.repeat(1000))).not.toContain('x'.repeat(201));
  });
});

describe('checking AI recipes', () => {
  it('accepts a recipe that fits the profile', () => {
    const r = toRecipe(good(), SAMPLE, 'Lunch', 'ai_test');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.recipe.foods).toEqual({ chicken: 1, rice: 1, broccoli: 'Roasted until crispy' });
      expect(r.recipe.slot).toBe('Lunch');
      expect(r.recipe.tasks[1]).toMatchObject({ l: 'oven', temp: 220 });
    }
  });

  it('rejects ingredients Remy doesn’t know, since they can’t be allergy-checked', () => {
    const r = toRecipe(good({ ingredients: [{ key: 'chickenbreast', qty: 1 }, { key: 'mystery_sauce', qty: 1 }] }), SAMPLE, 'Lunch', 'ai_x');
    expect(r).toMatchObject({ ok: false, reason: expect.stringContaining('safety-checked') });
  });

  it('rejects allergens, including hidden ones like oyster sauce for shellfish', () => {
    expect(toRecipe(good({ ingredients: [{ key: 'shrimp', qty: 1 }, { key: 'rice', qty: 1 }] }), SAMPLE, 'Dinner', 'ai_x').ok).toBe(false);
    expect(toRecipe(good({ ingredients: [{ key: 'beef', qty: 1 }, { key: 'oyster', qty: 0.25 }] }), SAMPLE, 'Dinner', 'ai_x').ok).toBe(false);
    const dairyFree = with_({ allergies: ['Milk / dairy'] });
    expect(toRecipe(good({ ingredients: [{ key: 'chickenbreast', qty: 1 }, { key: 'cheddar', qty: 1 }] }), dairyFree, 'Dinner', 'ai_x').ok).toBe(false);
  });

  it('works out foods from the ingredients, so a disliked food can’t be left unmentioned', () => {
    // Zucchini is rated Dislike in the sample; the model doesn't mention it in "preparations".
    const r = toRecipe(good({ ingredients: [{ key: 'chickenbreast', qty: 1 }, { key: 'zucchini', qty: 2 }], preparations: [] }), SAMPLE, 'Dinner', 'ai_x');
    expect(r.ok).toBe(false);
  });

  it('requires an accepted preparation for foods eaten only certain ways', () => {
    const steamed = toRecipe(good({ preparations: [{ food: 'broccoli', way: 'Steamed' }] }), SAMPLE, 'Lunch', 'ai_x');
    const unstated = toRecipe(good({ preparations: [] }), SAMPLE, 'Lunch', 'ai_x');
    expect(steamed.ok).toBe(false);
    expect(unstated.ok).toBe(false);
  });

  it('caps storage times, whatever the model says', () => {
    const r = toRecipe(good({ fridge_days: 10, freezer_months: 12 }), SAMPLE, 'Lunch', 'ai_x');
    expect(r.ok && r.recipe.fridge).toBe(4);
    expect(r.ok && r.recipe.freezer).toBe(3);
    const short = toRecipe(good({ fridge_days: 2, freezer_months: 0 }), SAMPLE, 'Lunch', 'ai_x');
    expect(short.ok && safeOnDay(short.recipe, 3)).toBe(false);
  });

  it('works out calories and macros from the ingredients, not the model’s guess', () => {
    const r = toRecipe(good({ kcal: 1100, protein_g: 90 }), SAMPLE, 'Lunch', 'ai_x');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recipe).toMatchObject(macrosOf(r.recipe.ing, r.recipe.serves));
    expect(r.recipe.kcal).toBeLessThan(1100);
  });

  it('rejects answers without steps or with nonsense', () => {
    expect(toRecipe('not an object', SAMPLE, 'Lunch', 'ai_x').ok).toBe(false);
    expect(toRecipe(good({ steps: [] }), SAMPLE, 'Lunch', 'ai_x').ok).toBe(false);
    expect(toRecipe(good({ tasks: [{ text: 'x', lane: 'teleport', minutes: 5 }] }), SAMPLE, 'Lunch', 'ai_x').ok).toBe(false);
  });
});

describe('saved AI recipes', () => {
  it('work in the planner, grocery list and prep schedule, and can be removed', () => {
    const r = toRecipe(good(), SAMPLE, 'Lunch', 'ai_saved');
    if (!r.ok) throw new Error(r.reason);
    registerAiRecipes({ ai_saved: r.recipe });
    // Registered with its numbers worked out from the ingredients, like library recipes.
    expect(R.ai_saved).toEqual(r.recipe);
    expect(MEAL_IDS).toContain('ai_saved');

    const plan = replaceMeal(buildPlan('balanced', context(SAMPLE)).plan, 0, 'Lunch', 'ai_saved');
    expect(groceryList(plan, SAMPLE, emptyGroceryEdits()).some((x) => x.from.includes('Honey-mustard bowls'))).toBe(true);
    expect(schedule(plan, SAMPLE).total).toBeGreaterThan(0);

    registerAiRecipes({});
    expect(R.ai_saved).toBeUndefined();
    expect(MEAL_IDS).not.toContain('ai_saved');
  });
});
