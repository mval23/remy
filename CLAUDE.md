# Remy

Remy is a personal-chef web app and the name of its AI chef. It learns what one person genuinely enjoys eating through a conversational interview, then produces a 7-day meal plan, one consolidated grocery list, and a timed prep session for a single cooking day per week. It also gives general nutrition-balance guidance (protein at meals, fruit and vegetables daily, portions) to support sustainable fat loss.

The project has two parts:

- **`prototype/`**: a single-file clickable prototype of every screen, plus the written product plan. It is the design reference.
- **`app/`**: the real app, built in phases with React + Vite + TypeScript. **Phase 1 (done): the interview, progress/resume and taste profile, saved on the device.** Meal planning, groceries, prep day and nutrition are still prototype-only; port them from `prototype/index.html` in later phases.

## Who this is for

- The user (project owner) is an experienced home cook with **no software-development background**. Explain technical terms in plain words, give commands in copy-pasteable blocks, and don't assume familiarity with tooling.
- The target user in v1 is the owner: a picky eater who loves sweets, cooks one day a week (Sunday in the sample), wants to lose weight and body fat sustainably, uses a phone and a computer, and wants the app to be free to start.

## Files

- `prototype/index.html`: the whole prototype and the product plan in one self-contained HTML file (CSS, markup, and JS inline). **This file is the source of truth**; edit it directly.
- `.claude/launch.json`: `remy-prototype` serves `prototype/` at http://localhost:5178; `remy-app` runs the app’s dev server at http://localhost:5173.
- `app/`: the React app (see “The app” below).

## The app (`app/`)

Stack: React 19, Vite 8, TypeScript 7, Dexie 4 (IndexedDB), Vitest 5. Run commands from `app/`:

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm run build` type-checks (`tsc`) and then builds to `app/dist`. `npm run typecheck` runs only the type check.

Layout of `app/src`:

- `interview/types.ts`: answer and question types, `InterviewState`.
- `interview/questions.ts`: `SECTIONS`, `LEVELS`, `FOODS`, and every question (`Q`, `QBY`), ported from the prototype. Add or change questions here.
- `interview/engine.ts`: pure functions with no React: `sequence` (branching), `activeAnswers`, `currentQuestion`, `answerQuestion` / `skipQuestion` (including edit mode and the allergy “change my answer” path), `fillWithSamples`, `formatAnswer`, `isValid`.
- `interview/helpers.ts`: small typed helpers (`arr`, `has`, `real`, `allRatings`, `toggleOption`, …).
- `profile/profile.ts`: `safetyRules` (kept separate from preferences) and `inferences` with confidence levels.
- `storage/db.ts`: Dexie database `remy`, table `kv`; `loadInterview`, `saveInterview`, `deleteEverything`. Failures are swallowed so the app still works when storage is blocked.
- `store.tsx`: `RemyProvider` loads saved progress, holds interview state and UI state (screen, edit mode, drafts, sheet, toast), and saves after every change. Screens use `useRemy()`.
- `screens/`: `Welcome`, `Interview`, `Resume`, `Summary`. `components/`: `Icon`, `AnswerControls`, `Sheets` (interview map, options, start-over confirmation, toast).
- `styles.css`: the prototype’s design tokens and component styles (light and dark via `prefers-color-scheme`).
- Tests: `interview/engine.test.ts` (branching, edit flow, sample profile) and `storage/db.test.ts` (uses `fake-indexeddb`).

Keep interview logic in `engine.ts` as pure functions with tests; keep React components thin.

## Published artifact

The prototype is published as a private Claude Artifact: https://claude.ai/artifact/HpMXUf4C6d8Y6iYBp5v2pU

To update it from a new conversation, publish `prototype/index.html` with the Artifact tool, passing that URL as `url` (read it first). Publishing without `url` creates a separate artifact. When publishing, the file is wrapped in its own `<html>/<head>/<body>` skeleton, so `index.html` intentionally has no doctype or `<html>`/`<body>` tags; keep it that way.

## How `index.html` is organized

1. `<title>`, Google Fonts link, and one `<style>` block. Colors are CSS tokens on `:root` with dark-mode overrides (`prefers-color-scheme` guarded by `:root:not([data-theme="light"])`, plus `:root[data-theme="dark"]`). Fonts: Bricolage Grotesque (display), Figtree (body), DM Mono (numbers).
2. Markup: top bar with the **Try Remy / Product Plan** toggle, the prototype shell (screen rail, phone frame, "About this screen" notes), then the Product Plan document (`<main id="planMode">`, sections with `id="p-…"`).
3. One `<script>` at the end, in three banner-marked parts:
   - **Data**: `ICONS`, `SECTIONS`, `LEVELS`, `FOODS`, interview questions `Q`, ingredients `ING`, recipes `R`, week templates `WEEKS`, `SCREENS`, `NOTES`.
   - **Nutrition layer data**: `NUT` (kcal, protein g, produce servings, portion note per recipe), `SIDES` (merged into `R` with `slot:'Side'`), and the extra goals questions `balance` and `progress` (spliced into `Q`; indices and `QBY` are rebuilt after).
   - **Engine and screens**: state `S` (saved to `localStorage` under `remy-prototype-v1`), transient UI state `U`, interview engine, rule checks, planner, grocery consolidation, prep scheduler, nutrition helpers, `SCR.<screen>()` renderers, `sheetHTML()`, `ACT` actions, `render()`.

### Key mechanics

- **Interview branching**: each question in `Q` may have `when(A)`; `seq()` is the list of questions that currently apply. `PA()` returns only answers from questions still in `seq()`, so answers from abandoned branches are ignored. Add a question by inserting it into `Q` with `sec`, `type`, `say`, optional `why`, `because`, `ack`, `sample`.
- **Safety**: `check(recipe)` blocks allergens, diet rules and intolerances via `ING[...].alg` tags (e.g. oyster sauce → `shellfish`) and hides dislikes, never-list items and wrong preparations. Allergies are hard constraints and must stay separate from preferences.
- **Storage safety**: `storage(recipe, day)` returns fridge/freezer/unsafe from `fridge` (days) and `freezer` (months). Nothing cooked may be planned past its fridge limit unless frozen.
- **Planner**: `buildPlan(variant, keepApproved)` fills `WEEKS` templates, swapping out anything `check()` rejects via `resolve()`.
- **Grocery list**: `groceries()` merges ingredients across planned recipes. Pantry answers move items to "Already at home". Costs only show for a USD budget.
- **Prep scheduler**: `schedule()` places recipe `tasks` into lanes (hands 1, stove 2, oven 2 pans at one temperature, chill unlimited). Tasks with the same `key` are shared across recipes; `end:1` tasks go in the packing phase.
- **Nutrition**: `dayNut()`, `protTh()` (15 g breakfast / 25 g lunch and dinner, +5 if often hungry), 3+ produce servings a day, `autoBalance()` adds sides from `sideOptions()`. Days estimated under ~1,200 kcal are flagged, never planned deliberately. Estimates are hidden unless `numsOn()`.
- **UI events**: buttons use `data-act="name" data-arg="…"` and are dispatched through `ACT`; inputs use `data-inp`. Always escape user text with `esc()`.

## Product rules (don't break these)

- Remy is **not a dietitian and gives no medical advice**. No diagnoses, promised results, or calorie targets computed from body data. Professional targets can be entered and are compared, not enforced.
- No shame-based language, guilt, or extreme restriction. **Sweets are always planned and portioned**, never banned or framed as rewards.
- Weight, measurements and calorie numbers are **optional**. Weight is weekly and shown only as a trend.
- Recommend only foods the user rated Okay or better, in preparations they accept. Never move a food to "Never suggest" without asking.
- Remy's voice: warm, curious, encouraging, practical, nonjudgmental, concise. One question at a time.
- Free-tier claims must stay honest: the Claude API has no ongoing free tier; say when something may cost money.

## Design conventions

- Mobile-first: the prototype must work at ~375 px wide with 44 px+ touch targets and no horizontal page scroll.
- Style through the CSS tokens only (no hard-coded colors), so light and dark themes both work.
- Keep external resources to Google Fonts and the CDN allowlist that artifacts permit (cdnjs, jsdelivr, unpkg). Everything else is inline.
- Nutrition values in `NUT` are rough prototype estimates; don't present them as precise.

## Checking changes

**App:** run `npm test` and `npm run build` in `app/`, then start the `remy-app` preview and click through the changed screens at phone width (375 px).

**Prototype:**

1. Syntax-check the script (Node is installed; Python isn't):

   ```bash
   sed -n '/<script>/,/<\/script>/p' prototype/index.html | sed '1d;$d' > /tmp/remy.js && node --check /tmp/remy.js
   ```

2. Start the `remy-prototype` preview from `.claude/launch.json` and click through the affected screens. The rail on the left jumps to any screen; "Explore with a sample profile" loads the full sample picky-eater profile.
3. The browser pane can't run scripts from a `file://` URL, so use the local server.

## Roadmap

The Product Plan tab in the prototype holds the full plan: recommended stack (React + Vite PWA, IndexedDB via Dexie, Supabase for sign-in and sync, Cloudflare Pages or Netlify hosting, AI in release 2 through a server function), MVP acceptance criteria, data model, testing plan and risks.

Progress against the plan’s phases:

- Phase 1, interview and profile saved on the device: **done** (`app/`).
- Phase 2, planning (recipe library, rule-based planner, grocery list, prep scheduler, plus the nutrition layer): next. Port the logic from the prototype’s engine into pure, tested modules first, then the screens.
- Phase 3, go live (hosting, installable PWA, Supabase sign-in and sync).
- Phase 4, learning (weekly check-in, learned preferences, export and delete).
- Phase 5, AI features behind a spending cap.
