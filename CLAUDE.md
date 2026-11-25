# RaceIQ: notes for Claude

Race analysis and planning for runners and cyclists. React 18 + Vite frontend, one Vercel serverless function, Supabase for auth and data. It's public as a portfolio piece, so code and copy are read by reviewers.

## Architecture

- **Engine (`src/utils/`)** computes every number: `analysis.js` (debrief findings), `ratings.js` (fade, drift, verdicts), `pace.js` (grade-adjusted pace), `fueling.js`, `aidStations.js` (carry plan), `racePlan.js`, `gpx.js`. It's pure, with no React. The API imports it too.
- **`api/claude.js`** is the only AI endpoint. It verifies the Supabase session (or applies the demo budget, `api/_lib/demo.js`), rate-limits, builds prompts server-side (`api/_lib/prompts.js`) and calls Claude. The browser sends race data, never prompt text.
- **Modes.** With no Supabase env vars, it runs locally on localStorage with the sample athlete (`SEED_RACES` in `src/constants.js`). With `VITE_DEMO_MODE=true` you get the public demo: never Supabase, recorded AI answers from `src/demo/recordings/`, and live AI only within `DEMO_AI_*` budgets. Signed-in athletes never see sample races.
- **i18n.** English and French catalogs in `src/i18n/{en,fr}/`, shared with the server. Errors cross the API as catalog keys.
- **Planning form.** `RacePlanForm.jsx` orchestrates. Each section lives in `src/components/racePlan/`.

## Rules

1. **Claude narrates; the engine computes.** Never let a prompt ask the model to produce a statistic, and never pass it a number the engine didn't compute. Every number in an AI answer must appear in its data block. `src/__tests__/grounding.test.js` enforces this, so keep it passing. New AI surfaces need recordings or fixtures in that test.
2. **`ANTHROPIC_API_KEY` stays server-side.** Never give it a `VITE_` prefix and never import it in `src/`. Never commit `.env` / `.env.local` or any secret. `.env.demo` holds only the demo flag.
3. **Keep English and French in sync.** Every user-visible string goes through `t()` with keys in both catalogs. `npm run check:i18n` (part of `build`) fails on a missing key, but it can't see hardcoded JSX text, so don't write any.
4. **Before opening a PR,** run `npm test` and `npm run build`, and check the change at 1280×800 and 390×844, in English and French, with no horizontal overflow at 390.
5. **Git.** Work on a branch with one PR per change. Don't merge to `main`, deploy, change repo visibility, or rewrite pushed history without asking.
6. **Sample data must agree with the engine.** A test checks each sample race's `verdict` against `deriveVerdict`. If you change sample races or prompts, re-run the grounding test, and re-record with `npm run record:demo` if a recording goes stale.

## Commands

```bash
npm run dev            # local mode       npm run dev:demo   # demo mode
npm test               # Vitest: engine, GPX, grounding, form, demo
npm run build          # i18n check + bundle (build:demo for the demo bundle)
npm run eval:grounding # live-model grounding eval (needs a key)
npm run record:demo    # re-record demo AI answers (needs a key)
```

Design docs live in `docs/` (write one before a larger feature). Deploying is covered in `docs/deploy.md`.
