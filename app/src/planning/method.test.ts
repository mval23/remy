import { describe, expect, it } from 'vitest';
import { activeAnswers, fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { ING } from './data/ingredients';
import { R } from './data/recipes';
import { batchesFor, gearGroups, gearList, ingredientName, isDetailed, partsText, placeholders, recipeSteps, renderLine, scaledIngredients, setupLines, timelineSteps } from './method';
import { buildPlan, dayApproved, menuCount, menuCountText, replaceMeal } from './planner';
import { context, matches, matchReasons } from './rules';
import { schedule } from './schedule';
import { migrateRecipe, quantityText } from './units';

const A = activeAnswers(fillWithSamples(emptyInterview()));
const plan = buildPlan('balanced', context(A)).plan;
const detailed = Object.values(R).filter(isDetailed);

describe('metric amounts', () => {
  it('formats grams, kilos, millilitres, litres, spoons and counts', () => {
    expect(quantityText(567, 'g')).toBe('570 g');
    expect(quantityText(1140, 'g')).toBe('1.1 kg');
    expect(quantityText(2000, 'ml')).toBe('2 L');
    expect(quantityText(7.4, 'g')).toBe('7 g');
    expect(quantityText(1.5, 'tbsp')).toBe('1½ tbsp');
    expect(quantityText(3, 'clove')).toBe('3 cloves');
    expect(quantityText(2, '')).toBe('2');
  });

  it('uses only metric units in the ingredient list', () => {
    for (const [k, g] of Object.entries(ING)) expect(['g', 'ml', 'tbsp', 'tsp', '', 'head', 'clove', 'box', 'bag', 'jar', 'can', 'sleeve'], k).toContain(g.u);
  });

  it('converts AI recipes saved in US units', () => {
    const old = { ...R.teriyaki, id: 'ai_x', ing: [['thighs', 1.25], ['rice', 1], ['oil', 1]] as [string, number][], tasks: [{ t: 'Roast', l: 'oven' as const, m: 20, temp: 425 }] };
    const m = migrateRecipe(old);
    expect(m.ing).toEqual([['thighs', 570], ['rice', 190], ['oil', 1]]);
    expect(m.tasks[0].temp).toBe(220);
  });
});

describe('detailed instructions', () => {
  it('has the pilot recipes and the world-kitchen recipes written out in full', () => {
    const pilot = ['brownies', 'burritos', 'oats', 'pancakes', 'quesadilla', 'spaghetti', 'tenders', 'teriyaki'];
    const world = ['arepas', 'bfsandwich', 'frittata', 'arrozconpollo', 'frijoles', 'fajitabowl', 'pestopasta', 'greekbowl', 'lemonchicken', 'ajiaco', 'sudado', 'enchiladas', 'tortillasoup', 'lasagna', 'chickenparm', 'minestrone', 'turkeyburgers', 'lemonsalmon', 'tunamelt', 'tunapasta', 'pandebono', 'esquites', 'hummus', 'eggbox', 'side_boiledeggs', 'arrozconleche', 'tiramisu', 'applecrisp', 'bandeja', 'bolognese', 'carbonara', 'pechugagratinada', 'nachos', 'pechuga', 'sandwich', 'wraps', 'guacamole', 'pericos', 'alfredo', 'salmonbowl', 'tunaavocado', 'caesar', 'sancocho', 'tinga', 'pizza', 'empanadas', 'obleas', 'fresas'];
    expect(detailed.map((r) => r.id).sort()).toEqual([...pilot, ...world].sort());
  });

  it('every amount in a step is one of that recipe’s ingredients', () => {
    for (const r of Object.values(R))
      for (const t of r.tasks) for (const line of t.how ?? []) for (const k of placeholders(line)) expect(r.ing.map(([x]) => x), `${r.id}: ${line}`).toContain(k);
  });

  it('every ingredient of a written-out recipe is used in some step', () => {
    for (const r of detailed) {
      const used = new Set(r.tasks.flatMap((t) => (t.how ?? []).flatMap(placeholders)));
      for (const [k] of r.ing) expect(used, `${r.id} never uses ${k}`).toContain(k);
    }
  });

  it('writes no US measures or °F', () => {
    for (const r of Object.values(R)) {
      const text = [...r.steps, r.reheat, r.thaw ?? '', r.plate, ...r.tasks.flatMap((t) => t.how ?? [])].join(' ');
      // A number followed by a US measure ("2 cups"), not a container ("mousse cups").
      expect(text, r.id).not.toMatch(/°F|[\d½¼¾⅓⅔]\s*(cups?|oz|lbs?|inch(es)?|quarts?)\b|-inch/);
    }
  });

  it('scales amounts with the batches made this week', () => {
    const one = partsText(renderLine('Toss {thighs} with {taco} and {oil}.', [{ r: R.burritos, batches: 1 }]));
    const two = partsText(renderLine('Toss {thighs} with {taco} and {oil}.', [{ r: R.burritos, batches: 2 }]));
    expect(one).toBe('Toss 570 g boneless chicken thighs with 2 tbsp taco seasoning and 1 tbsp olive oil.');
    expect(two).toBe('Toss 1.1 kg boneless chicken thighs with 4 tbsp taco seasoning and 2 tbsp olive oil.');
  });

  it('supports shares, other units and portions', () => {
    const src = [{ r: R.teriyaki, batches: 1 }];
    expect(partsText(renderLine('{teriyaki*0.5} now, {teriyaki*0.5:q} later', src))).toBe('60 ml teriyaki sauce now, 60 ml later');
    expect(partsText(renderLine('Water: {rice*1.5:ml}', src))).toBe('Water: 290 ml');
    expect(partsText(renderLine('{portions} boxes, {portions*2} squares', src))).toBe('3 boxes, 6 squares');
    const amounts = renderLine('Beat {eggs}.', [{ r: R.tenders, batches: 1 }]);
    expect(amounts).toEqual([{ t: 'Beat ' }, { t: '1', amount: true }, { t: ' egg' }, { t: '.' }]);
  });

  it('adds up a shared step across every recipe that uses it', () => {
    const p = replaceMeal(replaceMeal(plan, 0, 'Lunch', 'teriyaki'), 3, 'Lunch', 'burritos');
    const sc = schedule(p, A);
    const rice = sc.tasks.find((t) => t.id === 'key:rice')!;
    expect(rice.refs.map((x) => x.r.id).sort()).toEqual(expect.arrayContaining(['burritos', 'teriyaki']));
    const b = batchesFor(p);
    const grams = rice.refs.reduce((s, x) => s + x.r.ing.find(([k]) => k === 'rice')![1] * b[x.r.id], 0);
    const step = timelineSteps(sc).find((s) => s.id === 'key:rice')!;
    expect(partsText(step.lines[0])).toContain(quantityText(grams, 'g'));
  });

  it('names ingredients naturally inside a sentence', () => {
    expect(ingredientName('marinara', 1)).toBe('marinara sauce');
    expect(ingredientName('eggs', 1)).toBe('egg');
    expect(ingredientName('eggs', 3)).toBe('eggs');
    expect(scaledIngredients(R.oats, 2).find((x) => x.k === 'oats')?.amount).toBe('360 g');
  });
});

describe('prep day views', () => {
  const sc = schedule(plan, A);

  it('the timeline and the recipe-by-recipe view cover the same work', () => {
    const timeline = timelineSteps(sc).filter((s) => s.id !== 'start' && s.id !== 'cleanup').map((s) => s.id).sort();
    const byRecipe = recipeSteps(plan, sc).flatMap((x) => x.steps.filter((s) => !s.alreadyDone).map((s) => s.id)).sort();
    expect(byRecipe).toEqual(timeline);
  });

  it('shows a shared step once and points to it from the other recipes', () => {
    const p = replaceMeal(replaceMeal(plan, 0, 'Lunch', 'teriyaki'), 3, 'Lunch', 'burritos');
    const flows = recipeSteps(p, schedule(p, A));
    const rice = flows.flatMap((f) => f.steps).filter((s) => s.id === 'key:rice');
    expect(rice.filter((s) => !s.alreadyDone)).toHaveLength(1);
    expect(rice.length).toBeGreaterThan(1);
  });

  it('lists the equipment the written-out recipes need', () => {
    const gear = gearList(plan, sc);
    expect(gear).toContain('baking paper');
    expect(gear).toContain('sheet pan ×2');
    expect(gear).toContain('20 cm square baking pan');
    expect(gear).not.toContain('containers');
    expect(new Set(gear).size).toBe(gear.length);
  });
});

describe('screen summaries', () => {
  const sc = schedule(plan, A);
  const gear = gearList(plan, sc);

  it('groups the equipment into pans, bowls and tools, keeping every item', () => {
    const groups = gearGroups(['sheet pan ×2', 'mixing bowl', 'whisk', 'large pot', '20 cm square baking pan', 'baking paper', 'shallow bowl ×3']);
    expect(groups).toEqual([
      { name: 'Pans and pots', items: ['sheet pan ×2', 'large pot', '20 cm square baking pan'] },
      { name: 'Bowls', items: ['mixing bowl', 'shallow bowl ×3'] },
      { name: 'Tools', items: ['whisk', 'baking paper'] },
    ]);
    expect(gearGroups(gear).flatMap((g) => g.items).sort()).toEqual([...gear].sort());
  });

  it('gives the setting-up step real instructions: oven, equipment and what to pack into', () => {
    const lines = setupLines(sc, gear, { containers: 14, bags: 2, foil: 0 }).map(partsText);
    const oven = sc.tasks.find((t) => t.l === 'oven' && t.temp);
    if (oven) expect(lines).toContain(`Turn the oven on to ${oven.temp}°C`);
    expect(lines).toContain('Have ready 14 containers and 2 freezer bags');
    expect(timelineSteps(sc, setupLines(sc, gear, { containers: 1, bags: 0, foil: 0 }))[0].lines.length).toBeGreaterThan(1);
    expect(timelineSteps(sc)[0].lines).toEqual([]);
  });

  it('counts dishes and sides the same way everywhere, without store-bought items', () => {
    const { dishes, sides } = menuCount(plan);
    expect(dishes).toBeGreaterThan(0);
    expect(menuCountText(plan)).toBe(`${dishes} dishes${sides ? ` + ${sides} side${sides === 1 ? '' : 's'}` : ''}`);
  });

  it('marks a day approved only when every planned meal is', () => {
    expect(dayApproved(plan[0])).toBe(false);
    const day = { ...plan[0], meals: Object.fromEntries(Object.entries(plan[0].meals).map(([k, m]) => [k, m && { ...m, ok: true }])) };
    expect(dayApproved(day)).toBe(true);
  });

  it('explains a match as food and reason, the way the recipe page lists it', () => {
    const reasons = matchReasons(R.oats, A);
    expect(reasons.length).toBe(matches(R.oats, A).length);
    for (const x of reasons) expect(x.name.charAt(0)).toBe(x.name.charAt(0).toUpperCase());
  });
});
