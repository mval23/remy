/*
 * Match Remy's ingredients to USDA FoodData Central (https://fdc.nal.usda.gov), for review by a person.
 *
 *   node scripts/fdc-match.mjs search [key ...]   candidates for each ingredient → scripts/fdc-candidates.md
 *   node scripts/fdc-match.mjs fetch              values for the IDs chosen in scripts/fdc-ids.json → scripts/fdc-review.md
 *                                                 and scripts/fdc-values.json (per 100 g, ready to copy into ingredients.ts)
 *
 * The API key comes from FDC_API_KEY in the environment or in app/.env.local (never committed); without one it
 * uses the public DEMO_KEY, which allows only about 30 requests an hour. Nothing here changes the app's data:
 * a person confirms each match before values are copied into src/planning/data/ingredients.ts.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const API = 'https://api.nal.usda.gov/fdc/v1';

function apiKey() {
  if (process.env.FDC_API_KEY) return process.env.FDC_API_KEY;
  const env = join(app, '.env.local');
  if (existsSync(env)) {
    const line = readFileSync(env, 'utf8').split(/\r?\n/).find((l) => l.startsWith('FDC_API_KEY='));
    if (line) return line.slice('FDC_API_KEY='.length).trim();
  }
  return 'DEMO_KEY';
}

/** Ingredient keys, names, units and current values, read from the source file (no TypeScript build needed). */
function ingredients() {
  const src = readFileSync(join(app, 'src/planning/data/ingredients.ts'), 'utf8');
  const out = {};
  const re = /^ {2}([a-z]+): \{ n: '([^']*)', u: '([^']*)'.*?m: \{ pro: ([\d.]+), carb: ([\d.]+), fat: ([\d.]+), fiber: ([\d.]+) \}(?:, gpu: ([\d.]+))?/gm;
  for (const m of src.matchAll(re)) {
    const [, k, n, u, pro, carb, fat, fiber, gpu] = m;
    out[k] = { n, u, m: { pro: +pro, carb: +carb, fat: +fat, fiber: +fiber }, gpu: gpu ? +gpu : undefined };
  }
  return out;
}

/** Remy's values per 100 g, converting per-unit values with grams per unit. */
function per100(g) {
  if (g.u === 'g' || g.u === 'ml') return g.m;
  if (!g.gpu) return null;
  const f = 100 / g.gpu;
  return { pro: g.m.pro * f, carb: g.m.carb * f, fat: g.m.fat * f, fiber: g.m.fiber * f };
}

// FoodData Central nutrient numbers.
const NUM = { pro: '203', fat: '204', carb: '205', fiber: '291', sugar: '269', satFat: '606', sodiumMg: '307' };

function nutrients(food) {
  const out = {};
  for (const x of food.foodNutrients ?? []) {
    const num = x.nutrient?.number ?? x.nutrientNumber;
    const amount = x.amount ?? x.value;
    for (const [k, n] of Object.entries(NUM)) if (num === n && typeof amount === 'number') out[k] = amount;
  }
  return out;
}

async function get(path, init) {
  const url = `${API}${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey()}`;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`FoodData Central answered ${res.status} for ${path.split('?')[0]}`);
  return res.json();
}

const fmt = (x) => (x === undefined || x === null ? '—' : (Math.round(x * 10) / 10).toString());

async function search(keys) {
  const ing = ingredients();
  const lines = ['# FoodData Central candidates', '', 'Pick one FDC ID per ingredient and put it in `scripts/fdc-ids.json`. Values are per 100 g.', ''];
  for (const k of keys.length ? keys : Object.keys(ing)) {
    const g = ing[k];
    if (!g) continue;
    const q = encodeURIComponent(g.n.replace(/\(.*?\)/g, '').trim());
    const data = await get(`/foods/search?query=${q}&dataType=Foundation,SR%20Legacy&pageSize=4`);
    const mine = per100(g);
    lines.push(`## ${k}: ${g.n}`, '', `Remy now: ${mine ? `${fmt(mine.pro)} protein, ${fmt(mine.carb)} carbs, ${fmt(mine.fat)} fat, ${fmt(mine.fiber)} fiber` : 'no grams per unit'}`, '');
    for (const f of data.foods ?? []) {
      const v = nutrients(f);
      lines.push(`- ${f.fdcId} · ${f.description} (${f.dataType}): ${fmt(v.pro)} protein, ${fmt(v.carb)} carbs, ${fmt(v.fat)} fat, ${fmt(v.fiber)} fiber`);
    }
    lines.push('');
  }
  writeFileSync(join(here, 'fdc-candidates.md'), lines.join('\n'));
  console.log('Wrote scripts/fdc-candidates.md');
}

async function fetchChosen() {
  const ing = ingredients();
  const ids = JSON.parse(readFileSync(join(here, 'fdc-ids.json'), 'utf8'));
  const entries = Object.entries(ids);
  const values = {};
  const rows = ['| Ingredient | FDC food | Protein | Carbs | Fat | Fiber | Largest gap |', '| --- | --- | --- | --- | --- | --- | --- |'];
  for (let i = 0; i < entries.length; i += 20) {
    const batch = entries.slice(i, i + 20);
    const foods = await get('/foods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fdcIds: batch.map(([, id]) => Number(id)) }) });
    for (const [k, id] of batch) {
      const food = foods.find((f) => String(f.fdcId) === String(id));
      if (!food) continue;
      const v = nutrients(food);
      values[k] = { id: String(id), description: food.description, dataType: food.dataType, publicationDate: food.publicationDate, per100: v };
      const mine = ing[k] ? per100(ing[k]) : null;
      const gap = mine ? Math.max(...['pro', 'carb', 'fat'].map((n) => Math.abs((mine[n] ?? 0) - (v[n] ?? 0)) / Math.max(1, v[n] ?? 0))) : null;
      const cell = (n) => `${fmt(mine?.[n])} → ${fmt(v[n])}`;
      rows.push(`| ${k} | ${food.description} (${id}) | ${cell('pro')} | ${cell('carb')} | ${cell('fat')} | ${cell('fiber')} | ${gap === null ? '—' : `${Math.round(gap * 100)}%`} |`);
    }
  }
  writeFileSync(join(here, 'fdc-values.json'), `${JSON.stringify(values, null, 2)}\n`);
  writeFileSync(join(here, 'fdc-review.md'), ['# Remy vs FoodData Central, per 100 g', '', 'Remy now → FDC. Gaps over 10% need a look before the values are copied.', '', ...rows, ''].join('\n'));
  console.log(`Wrote scripts/fdc-review.md and scripts/fdc-values.json (${Object.keys(values).length} ingredients)`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'search') await search(rest);
else if (cmd === 'fetch') await fetchChosen();
else console.log('Usage: node scripts/fdc-match.mjs search [key ...] | fetch');
