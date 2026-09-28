# Remy

Remy is a personal-chef web app and the name of its AI chef. It learns what one person genuinely enjoys eating through a conversational interview, then produces a 7-day meal plan, one consolidated grocery list, and a timed prep session for a single cooking day per week. It also gives general nutrition-balance guidance (protein at meals, fruit and vegetables daily, portions) to support sustainable fat loss.

The project has two parts:

- **`prototype/`**: a single-file clickable prototype of every screen, plus the written product plan. It is the design reference.
- **`app/`**: the real app, built in phases with React + Vite + TypeScript. **Phases 1–5 are done**: the interview and taste profile; the week planner, recipes, grocery list, prep-day timeline and nutrition balance; an installable, offline-capable app hosted on GitHub Pages with optional Supabase sign-in and sync; and learning (weekly check-in that plans the next week, “Remy noticed” suggestions, learned preferences, backup files); and free AI recipe ideas through Google Gemini’s free tier.

## Who this is for

- The user (project owner) is an experienced home cook with **no software-development background**. Explain technical terms in plain words, give commands in copy-pasteable blocks, and don't assume familiarity with tooling.
- The target user in v1 is the owner: a picky eater who loves sweets, cooks one day a week (Sunday in the sample), wants to lose weight and body fat sustainably, uses a phone and a computer, and wants the app to be free to start.

## Files

- `prototype/index.html`: the whole prototype and the product plan in one self-contained HTML file (CSS, markup, and JS inline). **This file is the source of truth**; edit it directly.
- `.claude/launch.json`: `remy-prototype` serves `prototype/` at http://localhost:5178; `remy-app` runs the app’s dev server at http://localhost:5173.
- `app/`: the React app (see “The app” below).
- `.github/workflows/deploy.yml`: on every push to `main`, runs the tests, builds with `BASE_PATH=/remy/` and the optional repository variables `SUPABASE_URL` / `SUPABASE_ANON_KEY`, and publishes to GitHub Pages (https://mval23.github.io/remy/).
- `supabase/functions/remy-ai/index.ts`: the AI server function (Deno). It holds `GEMINI_API_KEY` (a Supabase secret), accepts only signed-in users (it asks Supabase Auth), caps request sizes and use per hour, asks Gemini for JSON matching the schema the app sends, and falls back through `MODELS` when a model isn’t available. `GEMINI_BASE_URL` exists only for local testing against a fake server. Type-check with `npx -y deno@latest check supabase/functions/remy-ai/index.ts`. The owner deploys it from the Supabase dashboard (SETUP.md step 8).
- `supabase/schema.sql`: the single `user_data` table (one row per account, `interview` and `plan` as JSON with change times) and its row-level security. `SETUP.md`: plain-language steps the owner follows to create the Supabase project; Claude can’t create accounts.

## The app (`app/`)

Stack: React 19, Vite 8, TypeScript 7, Dexie 4 (IndexedDB), vite-plugin-pwa, Supabase JS (loaded only when sync is configured), Vitest 5. Run commands from `app/`:

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

To build exactly like GitHub Pages in Git Bash, stop it from rewriting the path: `MSYS_NO_PATHCONV=1 BASE_PATH=/remy/ npm run build`, then start the `remy-app-build` preview (http://localhost:4173/remy/). The service worker only exists in builds, not in `npm run dev`. To try sync locally, copy `app/.env.example` to `app/.env.local` (ignored by Git).

Layout of `app/src`:

- `interview/types.ts`: answer and question types, `InterviewState`.
- `interview/questions.ts`: `SECTIONS`, `LEVELS`, `FOODS`, and every question (`Q`, `QBY`), ported from the prototype. Add or change questions here.
- `interview/engine.ts`: pure functions with no React: `sequence` (branching), `activeAnswers`, `currentQuestion`, `answerQuestion` / `skipQuestion` (including edit mode and the allergy “change my answer” path), `fillWithSamples`, `formatAnswer`, `isValid`.
- `interview/helpers.ts`: small typed helpers (`arr`, `has`, `real`, `allRatings`, `toggleOption`, …).
- `profile/profile.ts`: `safetyRules` (kept separate from preferences) and `inferences` with confidence levels.
- `planning/`: pure, tested planning logic.
  - `types.ts` (`Recipe`, `Meal`, `WeekPlan`, slots, days), `data/ingredients.ts` (`ING`, store sections, rough USD prices), `data/recipes.ts` (`R`, meals and balancing sides with kcal, protein and produce estimates), `data/weeks.ts` (three week templates, reject reasons).
  - `rules.ts`: `check` (safety blocks vs. preference hides; never-list matching), `score`, `matches`, `storage` (fridge/freezer/unsafe by day), `avoided` / `AVOID_AT` (recipes left out of new plans after feedback), `weekDays`, `activeSlots`, `sweetDays`, `defaultVariety`, `windowMinutes`. Rules take a `PlanContext` (`A`, `adj`, `hungry`).
  - `planner.ts`: `buildPlan` (keeps approved meals; skips avoided recipes unless nothing else fits), `replaceMeal`, `replacementOptions`, `autoReplacement`, `moveBlocker`/`swapMeals`, `setSide`, `portions`. All return new plans.
  - `nutrition.ts`: `dayNutrition`, `proteinTarget`, `sideOptions`, `balanceDay`, `estimatesOn`, `LIGHT_DAY_KCAL`.
  - `grocery.ts`: `groceryList` (merges ingredients, applies `GroceryEdits`), `costEstimate` (USD only), `quantityText`.
  - `schedule.ts`: `schedule` (hands 1, stove 2, oven 2 pans at one temperature, shared `key` tasks run once), `packingCounts`, `packPlan`, `clockTime`, `duration`.
- `storage/planState.ts`: `PlanState` (plan, variety, selected day, `weekStartedAt`, grocery edits, nutrition settings, score adjustments `adj`, `hungry`, `sweetPortion`, `learned`, `hiddenInferences`, `noticed`, `trial`, the check-in draft, `progress`), `emptyPlanState`, and `normalizePlanState`, which fills in fields missing from older copies (cloud, backups). Kept apart from `db.ts` so sync and learning can use it without loading Dexie. **When adding a field, add it to `emptyPlanState`**; older copies get it from there.
- `storage/db.ts`: Dexie database `remy`, table `kv` with rows `interview`, `plan` (`PlanState`) and `meta` (`Stamps`: when each document last changed, used by sync). Saves write the document and its stamp in one transaction. `deleteEverything` clears all rows. Failures are swallowed so the app still works when storage is blocked.
- `storage/backup.ts` (tested): `makeBackup`, `backupFileName`, `readBackup` (validates a backup file and explains problems in plain words). A backup is `{app: 'remy', version: 1, exportedAt, interview, plan}`.
- `learning/` (pure, tested): `types.ts` (`LearnedItem`, `CheckinDraft`, `ProgressEntry`) and `learning.ts`:
  - `applyCheckin` applies a weekly check-in and plans the next week. It returns the new state **and** the plain-language change list shown before saving, so the list always matches what happens. “Not again” sets a recipe's score to `AVOID_AT` (−4) or lower, which `resolve` in `planner.ts` skips; “Loved” adds 2. Prep “Too long” / “I could do more” moves variety one step. “Often hungry” sets `hungry`. Low energy fills light days with sides. A new week gets a fresh grocery list (pantry marks kept) and a new `weekStartedAt`.
  - `noticeSuggestion` / `answerSuggestion`: “Remy noticed” offers one low-pressure try of a Dislike (never a Never) vegetable as a side from `TRIALS`, only if the user is open to retrying foods and the side passes every other rule. “Try it once” sets `trial`, which the next check-in places in the new week once.
  - `learnFromRejection` (planner “Not this”), `forgetLearned` (deleting an item reverses its recorded effect: `adj`, `hungry`, `sweetPortion`, `trial`, `noticed`), `forgetAllLearned`, `weightTrend` (needs 3+ weigh-ins; compares the last 3–4), `checkinDue` (last two days of the week, not within 2 days of the last check-in).
- `ai/`: `recipe.ts` (pure, tested): `recipePrompt` / `profileForAi` (food preferences and rules only; never health answers, name or email), `recipeSchema` (ingredient keys limited to `ING`), and `toRecipe`, which rebuilds the model’s answer into a `Recipe`: foods are derived from ingredients (not trusted from the model), “only certain ways” foods must use an accepted preparation, fridge days are capped at 4 and freezer at 3 months, and the result must pass `check`. `client.ts`: `askForJson` calls the function through supabase-js and maps its error codes to plain words. AI recipes get ids starting `ai_`, are saved in `PlanState.aiRecipes`, and are added to `R` / `MEAL_IDS` by `registerAiRecipes` (called on every render in `store.tsx`, on load and on restore). `components/AiIdea.tsx`: the consent panel and the “Ask Remy for a new idea” panel in the Replace sheet. `PlanState.aiConsent` records that the user turned AI on after reading what is sent.
- `sync/`: `merge.ts` (pure, tested: newest change wins per document; within the same week (`weekStartedAt`), grocery check-offs from either device are kept; fills in fields missing from older cloud copies), `supabase.ts` (lazy client; email + password sign-in, account creation with Supabase’s standard confirmation email, password reset; fetch/push/delete the row; off unless `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set), `authErrors.ts` (plain-language sign-in errors), `useSync.ts` (tracks the password-reset link event; syncs on sign-in, 1.5 s after local changes, on focus, on reconnect, and every 30 s). Applying the cloud copy saves it with the cloud’s change time so it isn’t re-uploaded.
- `pwa.ts`: install prompt capture, installed/iOS detection, persistent-storage request. Icons in `app/public` are generated from `public/icon.svg` with `npx pwa-assets-generator` (config in `pwa-assets.config.ts`).
- `store.tsx`: `RemyProvider` loads both rows, builds a first week for a profile confirmed before planning existed, holds interview, plan and UI state, and saves after every change. Changing a profile answer rebuilds unapproved meals. Screens use `useRemy()` (`interview`, `planState`, `ui`, `ctx`, `actions`).
- `screens/`: `Welcome`, `Interview`, `Resume`, `Summary`, `Home`, `Planner`, `Nutrition`, `Recipe`, `Grocery`, `Prep`, `Account` (sync sign-in, install steps, offline note), `Checkin` (weekly check-in; warns when saving before the week is over), `Preferences` (the Profile tab: safety rules, foods by level, learned items with delete, plan settings, backup download/restore, delete learned, delete everything). Home shows the check-in card on the last two days of the week and the “Remy noticed” card; Nutrition shows progress; Welcome can restore a backup. `components/`: `Icon`, `AnswerControls`, `Chrome` (header, bottom nav, storage pill), `Sheets` (interview map, options, start over / delete everything, delete learned, restore a backup, change a food’s level, toast), `PlanSheets` (replace/reject, move, add a side).
- `styles.css`: design tokens and shared component styles (light and dark via `prefers-color-scheme`). `planning.css`: styles for the planning screens. `learning.css`: check-in, preferences and data styles.
- Tests: `ai/recipe.test.ts` (what is sent, allergen and preference checks on AI answers, storage caps, saved AI recipes in plans), `interview/engine.test.ts` (branching, edit flow, sample profile), `planning/planning.test.ts` (allergy blocking for every allergy and diet, storage safety, planner edits, nutrition, groceries, scheduling), `learning/learning.test.ts` (check-in effects, suggestions, reversing learned items, weight trend), `sync/merge.test.ts` (sync decisions), `storage/backup.test.ts` and `storage/db.test.ts` (uses `fake-indexeddb`).

Keep logic in pure, tested functions (`interview/engine.ts`, `planning/*`); keep React components thin.

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
- Free-tier claims must stay honest: the Claude API has no ongoing free tier; say when something may cost money. AI uses Gemini’s free tier (no billing, so it can’t charge), and the app says Google may use free-tier data to improve its products. The owner chose free over private.
- AI only proposes; rules decide. Never show an AI result that hasn’t been through `toRecipe` / `check`, and never send health answers or identifying details to the AI.

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
- Phase 2, planning (recipe library, rule-based planner, grocery list, prep scheduler, nutrition layer): **done** (`app/src/planning`).
- Phase 3, go live: **done** in code. Hosting is GitHub Pages (chosen over Cloudflare Pages/Netlify because the repo is public and it needs no extra account). Sync turns on once the owner completes SETUP.md and sets the two repository variables. Sign-in is email + password, not emailed codes or magic links: Supabase only allows custom email templates with your own email service, and email links open outside an installed iPhone app.
- Phase 4, learning (weekly check-in, learned preferences, export and delete): **done** (`app/src/learning`, `storage/backup.ts`). Export is a JSON backup file that can be restored on any device, so people who don’t sign in can still move or keep their data.
- Phase 5, AI: **done** for recipe ideas (`app/src/ai`, `supabase/functions/remy-ai`). The owner wanted it free, so it uses Gemini’s free tier instead of a paid API with a spending cap. Possible next AI features from the plan: understanding typed interview answers, turning check-in notes into suggested changes, and chat about a meal. Each must return JSON checked by the rules before anything changes.
