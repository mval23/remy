# Remy

Remy is a personal-chef web app. Through a short, friendly conversation it learns what you actually enjoy eating: favorite foods, textures, sauces, sweets, and how much time you have to cook. From that it builds a week of meals, one grocery list, and a timed plan for a single prep day.

It's designed for picky eaters and people who want to eat in a more balanced way without banning the foods they love. Sweets are planned and portioned, never forbidden.

**Try it:** https://mval23.github.io/remy/ (on a phone, add it to your home screen to install it)

> Remy offers general meal-planning and balance guidance. It isn't medical advice and doesn't replace a doctor or registered dietitian.

## Status

| Part | State |
| --- | --- |
| `prototype/` | Clickable prototype of every screen, plus the full product plan (open `prototype/index.html` through a local server) |
| `app/` Phase 1 | Done: conversational interview, progress and resume, taste profile, saved on the device |
| `app/` Phase 2 | Done: week planner, recipes, grocery list, prep-day timeline, nutrition balance |
| `app/` Phase 3 | Done: installable app that works offline, hosted on GitHub Pages; optional sign-in and sync (see [SETUP.md](SETUP.md)) |
| `app/` Phase 4 | Done: weekly check-in that plans the next week, learned preferences you can inspect and delete, backup file download and restore |
| `app/` Phase 5 | Done: free AI recipe ideas (Google Gemini free tier), checked against your safety rules before you see them (see [SETUP.md](SETUP.md) step 8) |

## Run the app

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
cd app
npm install
npm run dev
```

Then open http://localhost:5173. Other commands, run from `app/`:

```bash
npm test
```

```bash
npm run build
```

## Built with

React, Vite, TypeScript, Dexie (on-device storage with IndexedDB), vite-plugin-pwa, Supabase (optional sync), and Vitest.

## License

[Apache License 2.0](LICENSE)
