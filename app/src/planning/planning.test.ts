import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview, type Answers } from '../interview/types';
import { ING } from './data/ingredients';
import { MEAL_IDS, R, SIDE_IDS } from './data/recipes';
import { WEEKS } from './data/weeks';
import { costEstimate, emptyGroceryEdits, fraction, groceryList, quantityText } from './grocery';
import { balanceDay, dayNutrition, sideOptions } from './nutrition';
import {
  approvalCounts,
  autoReplacement,
  buildPlan,
  eachMeal,
  moveBlocker,
  replaceMeal,
  replacementOptions,
  rotation,
  setApproved,
  swapMeals,
} from './planner';
import { check, context, defaultVariety, hardTags, storage, weekDays } from './rules';
import { packingCounts, schedule } from './schedule';
import type { Variety, WeekPlan } from './types';

/** The sample picky-eater profile from the interview. */
const SAMPLE: Answers = activeAnswers(fillWithSamples(emptyInterview()));
const sampleCtx = () => context(SAMPLE);
const with_ = (patch: Answers): Answers => ({ ...SAMPLE, ...patch });
const planFor = (A: Answers, v: Variety = 'balanced') => buildPlan(v, context(A)).plan;

const recipesIn = (plan: WeekPlan) => {
  const ids = new Set<string>();
  eachMeal(plan, (m) => {
    if (m.r) ids.add(m.r);
    if (m.side) ids.add(m.side);
  });
  return [...ids];
};

describe('data integrity', () => {
  it('every recipe ingredient exists and every template recipe exists', () => {
    for (const r of Object.values(R)) for (const [k] of r.ing) expect(ING[k], `${r.id} → ${k}`).toBeDefined();
    for (const w of Object.values(WEEKS)) for (const day of w.days) for (const id of day) expect(R[id], id).toBeDefined();
  });

  it('every recipe lists each rated food its ingredients contain, so Dislike and Never always apply', () => {
    for (const r of Object.values(R)) for (const [k] of r.ing) if (ING[k].f) expect(r.foods, `${r.id} uses ${k}`).toHaveProperty(ING[k].f!);
  });

  it('every meal recipe has steps, reheating guidance and a portion note', () => {
    for (const id of MEAL_IDS) {
      expect(R[id].steps.length, id).toBeGreaterThan(0);
      expect(R[id].reheat, id).not.toBe('');
      expect(R[id].plate, id).not.toBe('');
    }
  });
});

describe('safety rules', () => {
  it('blocks shellfish, including oyster sauce, as an allergy', () => {
    const c = check(R.beefbroc, with_({ allergies: ['Shellfish'] }));
    expect(c).toMatchObject({ ok: false, blocked: true, allergy: true });
    expect(check(R.shrimp, SAMPLE).ok).toBe(false);
  });

  it('never plans a recipe containing any restricted tag, for every allergy and diet', () => {
    const cases: Answers[] = [
      { allergies: ['Milk / dairy'] }, { allergies: ['Eggs'] }, { allergies: ['Wheat / gluten'] }, { allergies: ['Soy'] },
      { allergies: ['Peanuts'] }, { allergies: ['Fish', 'Shellfish'] }, { diet: ['Vegetarian'] }, { diet: ['Vegan'] },
      { diet: ['No red meat'] }, { intolerances: ['Lactose'] },
    ];
    for (const patch of cases) {
      const A = with_({ allergies: ['None'], diet: ['No restrictions'], intolerances: ['None'], ...patch });
      const tags = hardTags(A);
      for (const v of ['favorites', 'balanced', 'variety'] as Variety[]) {
        for (const id of recipesIn(planFor(A, v))) {
          for (const [k] of R[id].ing) for (const t of ING[k].alg ?? []) expect(tags.has(t), `${JSON.stringify(patch)} ${v}: ${id} has ${k} (${t})`).toBe(false);
        }
      }
    }
  });

  it('blocks typed-in allergies by ingredient name', () => {
    expect(check(R.teriyaki, with_({ allergies: ['Carrots'] }))).toMatchObject({ ok: false, blocked: true });
  });

  it('“Olives” on the never-list does not block olive oil', () => {
    expect(check(R.teriyaki, with_({ never: ['Olives'] })).ok).toBe(true);
  });

  it('hides disliked foods and wrong preparations, without calling them safety blocks', () => {
    expect(check(R.salmon, SAMPLE)).toMatchObject({ ok: false, hidden: true });
    // Sample accepts broccoli roasted crispy or with cheese, not steamed.
    const c = check(R.beefbroc, with_({ allergies: ['None'] }));
    expect(c).toMatchObject({ ok: false, hidden: true });
  });
});

describe('storage safety', () => {
  it('keeps cooked food in the fridge only within its limit, then freezes it or flags it', () => {
    expect(storage(R.teriyaki, 4).k).toBe('fridge');
    expect(storage(R.teriyaki, 5).k).toBe('unsafe');
    expect(storage(R.burritos, 4).k).toBe('freezer');
    expect(storage(R.tenders, 2).k).toBe('freezer');
    expect(storage(R.popcorn, 6).k).toBe('room');
  });

  it('never plans a meal past its safe fridge time, in any template', () => {
    for (const v of ['favorites', 'balanced', 'variety'] as Variety[]) {
      planFor(SAMPLE, v).forEach((day, i) => {
        for (const m of Object.values(day.meals)) {
          if (m?.r) expect(storage(R[m.r], i + 1).k, `${v} ${day.d} ${m.r}`).not.toBe('unsafe');
          if (m?.side) expect(storage(R[m.side], i + 1).k, `${v} ${day.d} ${m.side}`).not.toBe('unsafe');
        }
      });
    }
  });
});

describe('planner', () => {
  it('starts the week the day after prep day', () => {
    expect(weekDays(SAMPLE)[0]).toBe('Mon');
    expect(weekDays(with_({ prepday: 'Wed' }))).toEqual(['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed']);
  });

  it('builds the sample week: Friday dinner out, a sweet every day, only allowed recipes', () => {
    const plan = planFor(SAMPLE);
    expect(plan).toHaveLength(7);
    expect(plan[4].meals.Dinner).toEqual({ out: true });
    expect(plan.every((d) => d.meals['Evening sweet']?.r)).toBe(true);
    for (const id of recipesIn(plan)) expect(check(R[id], SAMPLE).ok, id).toBe(true);
  });

  it('plans sweets only as often as asked', () => {
    const plan = planFor(with_({ sweetfreq: 'A few times a week' }));
    expect(plan.filter((d) => d.meals['Evening sweet']?.r).length).toBe(3);
  });

  it('only plans the meals that come from prep day', () => {
    const plan = planFor(with_({ fromprep: ['Lunch', 'Dinner'] }));
    expect(Object.keys(plan[0].meals).sort()).toEqual(['Dinner', 'Lunch']);
  });

  it('chooses variety from the answers', () => {
    expect(defaultVariety(SAMPLE)).toBe('balanced');
    expect(defaultVariety(with_({ preptime: '1–2 hours' }))).toBe('favorites');
    expect(defaultVariety(with_({ repeats: 'Something different every day' }))).toBe('variety');
  });

  it('keeps approved meals when rebuilding', () => {
    let plan = planFor(SAMPLE);
    plan = setApproved(plan, 0, 'Lunch', true);
    plan = replaceMeal(plan, 0, 'Lunch', 'bbqbowl');
    plan = setApproved(plan, 0, 'Lunch', true);
    const rebuilt = buildPlan('variety', sampleCtx(), plan).plan;
    expect(rebuilt[0].meals.Lunch).toMatchObject({ r: 'bbqbowl', ok: true });
    expect(approvalCounts(rebuilt).ok).toBe(1);
  });

  it('replacing one meal leaves every other meal unchanged', () => {
    const plan = planFor(SAMPLE);
    const next = replaceMeal(plan, 1, 'Lunch', 'bbqbowl');
    expect(next[1].meals.Lunch?.r).toBe('bbqbowl');
    expect(next.map((d, i) => (i === 1 ? null : d))).toEqual(plan.map((d, i) => (i === 1 ? null : d)));
  });

  it('lists blocked replacements with the reason, and picks a safe one', () => {
    const plan = planFor(SAMPLE);
    const opts = replacementOptions(plan, 1, 'Lunch', sampleCtx());
    expect(opts.allowed.map((r) => r.id)).toContain('burritos');
    expect(opts.blocked.map((b) => b.r.id)).toContain('beefbroc');
    expect(opts.blocked.find((b) => b.r.id === 'beefbroc')?.reason).toContain('oyster sauce');
    const pick = autoReplacement(plan, 1, 'Lunch', sampleCtx());
    expect(pick && check(R[pick], SAMPLE).ok).toBe(true);
  });

  it('refuses moves that would break fridge safety', () => {
    const plan = planFor(SAMPLE);
    // Teriyaki (fridge 4 days, doesn't freeze) can't move to day 6.
    expect(plan[0].meals.Lunch?.r).toBe('teriyaki');
    expect(moveBlocker(plan, 0, 5, 'Lunch')).toContain('fridge limit');
    expect(moveBlocker(plan, 0, 1, 'Lunch')).toBeNull();
    const swapped = swapMeals(plan, 0, 3, 'Lunch');
    expect(swapped[0].meals.Lunch?.r).toBe(plan[3].meals.Lunch?.r);
  });
});

describe('weekly rotation', () => {
  const mealIds = (plan: WeekPlan) => {
    const ids = new Set<string>();
    eachMeal(plan, (m) => m.r && ids.add(m.r));
    return [...ids];
  };
  const nextWeek = (v: Variety, A: Answers = SAMPLE, adj: Record<string, number> = {}) => {
    const first = buildPlan(v, context(A, adj)).plan;
    const ctx = context(A, adj, false, mealIds(first));
    return { first, second: buildPlan(v, ctx).plan, ctx };
  };

  it('the first week follows the template; later weeks swap some recipes', () => {
    expect(rotation('balanced', context(SAMPLE))).toEqual({});
    const { first, second } = nextWeek('balanced');
    const added = mealIds(second).filter((id) => !mealIds(first).includes(id));
    expect(added.length).toBeGreaterThan(0);
    expect(mealIds(second).length).toBeGreaterThan(4);
  });

  it('“Repeat favorites” keeps the same week', () => {
    const { first, second } = nextWeek('favorites');
    expect(mealIds(second).sort()).toEqual(mealIds(first).sort());
  });

  it('swaps at most one recipe per slot on Balanced, and never a Loved one', () => {
    const { first, ctx } = nextWeek('balanced');
    const swap = rotation('balanced', ctx);
    const slots = Object.keys(swap).map((id) => R[id].slot);
    expect(new Set(slots).size).toBe(slots.length);
    const loved = Object.keys(swap)[0];
    const kept = rotation('balanced', context(SAMPLE, { [loved]: 2 }, false, mealIds(first)));
    expect(kept[loved]).toBeUndefined();
  });

  it('rotates in only safe, liked recipes that keep until their last day', () => {
    for (const A of [SAMPLE, with_({ allergies: ['Milk / dairy'] }), with_({ diet: ['Vegetarian'] })]) {
      const { second } = nextWeek('variety', A);
      second.forEach((day, i) => {
        for (const m of Object.values(day.meals)) {
          if (!m?.r) continue;
          expect(check(R[m.r], A).ok, m.r).toBe(true);
          expect(storage(R[m.r], i + 1).k, `${m.r} day ${i + 1}`).not.toBe('unsafe');
        }
      });
    }
  });

  it('keeps prep day about the same length', () => {
    for (const v of ['balanced', 'variety'] as Variety[]) {
      const { first, second } = nextWeek(v);
      expect(schedule(second, SAMPLE).total).toBeLessThanOrEqual(schedule(first, SAMPLE).total + 20);
    }
  });

  it('gives the same week when rebuilt, so edits mid-week don’t reshuffle it', () => {
    const { first, ctx } = nextWeek('balanced');
    expect(buildPlan('balanced', ctx, null).plan).toEqual(buildPlan('balanced', context(SAMPLE, {}, false, mealIds(first))).plan);
  });
});

describe('nutrition balance', () => {
  it('balances every day of the sample week with sides from accepted foods', () => {
    const plan = planFor(SAMPLE);
    plan.forEach((day) => expect(dayNutrition(day, false).ok, day.d).toBe(true));
    const sides = recipesIn(plan).filter((id) => SIDE_IDS.includes(id));
    expect(sides.length).toBeGreaterThan(0);
    for (const id of sides) expect(check(R[id], SAMPLE).ok).toBe(true);
  });

  it('adds nothing when the user said no to balance help', () => {
    const plan = planFor(with_({ balance: 'No thanks' }));
    expect(recipesIn(plan).some((id) => SIDE_IDS.includes(id))).toBe(false);
  });

  it('never repeats a side within a day and never offers an allergen side', () => {
    const A = with_({ allergies: ['Milk / dairy'] });
    for (const s of sideOptions(context(A), 0, 'Breakfast')) expect(check(s, A).ok).toBe(true);
    const plan = planFor(SAMPLE);
    for (const day of plan) {
      const sides = Object.values(day.meals).map((m) => m?.side).filter(Boolean);
      expect(new Set(sides).size).toBe(sides.length);
    }
  });

  it('raises protein targets for someone often hungry', () => {
    const plan = planFor(with_({ balance: 'Just show me' }));
    const thursday = plan[3];
    const normal = dayNutrition(thursday, false);
    const hungry = dayNutrition(thursday, true);
    expect(hungry.low.length).toBeGreaterThanOrEqual(normal.low.length);
    expect(balanceDay(thursday, 3, context(SAMPLE, {}, true)).added).toBeGreaterThan(0);
  });
});

describe('grocery list', () => {
  it('merges the same ingredient across recipes and moves pantry items to “at home”', () => {
    const items = groceryList(planFor(SAMPLE), SAMPLE, emptyGroceryEdits());
    const rice = items.find((x) => x.k === 'rice');
    expect(rice?.from).toEqual(expect.arrayContaining(['Teriyaki bowl', 'Chicken burritos']));
    expect(rice?.home).toBe(true);
    expect(items.find((x) => x.k === 'thighs')?.home).toBe(false);
  });

  it('applies edits: checked, deleted, custom items', () => {
    const edits = { ...emptyGroceryEdits(), deleted: { thighs: true }, custom: [{ id: 'c1', n: 'Paper towels', sec: 'Other', q: '1 roll' }] };
    const items = groceryList(planFor(SAMPLE), SAMPLE, edits);
    expect(items.some((x) => x.k === 'thighs')).toBe(false);
    expect(items.find((x) => x.k === 'c1')).toMatchObject({ custom: true, qtyText: '1 roll', cost: null });
  });

  it('shows costs only for a USD budget', () => {
    const items = groceryList(planFor(SAMPLE), SAMPLE, emptyGroceryEdits());
    const usd = costEstimate(items, SAMPLE);
    expect(usd.show).toBe(true);
    if (usd.show) expect(usd.low).toBeLessThan(usd.high);
    expect(costEstimate(items, with_({ budget: { amount: 300000, currency: 'COP' } })).show).toBe(false);
  });

  it('formats quantities in kitchen fractions', () => {
    expect(fraction(1.5)).toBe('1½');
    expect(fraction(0.33)).toBe('⅓');
    expect(quantityText(2, 'head')).toBe('2 heads');
    expect(quantityText(1, 'head')).toBe('1 head');
    expect(quantityText(450, 'g')).toBe('450 g');
  });
});

describe('prep-day schedule', () => {
  const plan = planFor(SAMPLE);
  const sc = schedule(plan, SAMPLE);

  it('fits the sample week into a 3–4 hour prep day', () => {
    expect(sc.total).toBeLessThanOrEqual(240);
  });

  it('never double-books hands, and never mixes oven temperatures or overfills the oven', () => {
    const at = (l: string) => sc.tasks.filter((t) => t.l === l);
    for (const a of at('hands')) for (const b of at('hands')) if (a !== b) expect(a.s < b.e && b.s < a.e, `${a.t} / ${b.t}`).toBe(false);
    // Check the oven at every moment a task starts: what's inside right then.
    const oven = at('oven');
    for (const moment of oven.map((t) => t.s)) {
      const inside = oven.filter((b) => b.s <= moment && moment < b.e);
      expect(new Set(inside.map((b) => b.temp)).size, `at ${moment} min`).toBe(1);
      expect(inside.reduce((n, b) => n + (b.pans ?? 1), 0), `at ${moment} min`).toBeLessThanOrEqual(2);
    }
  });

  it('cooks shared rice once for several recipes', () => {
    const rice = sc.tasks.filter((t) => t.id === 'key:rice');
    expect(rice).toHaveLength(1);
    expect(rice[0].for.length).toBeGreaterThan(1);
  });

  it('counts containers and freezer portions', () => {
    const p = packingCounts(plan, SAMPLE);
    expect(p.containers).toBeGreaterThan(0);
    expect(p.freezer).toBeLessThanOrEqual(p.freezerCap);
  });
});
