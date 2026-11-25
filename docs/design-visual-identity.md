# Visual identity: the endurance journal

## Problem

RaceIQ looked like a sport-tech dashboard: cool grey, a monospace data font, verdict pills ("LIMITER") as the main signal, and a race list that read like spreadsheet rows. The analysis underneath is careful and athlete-first, but the surface made it feel like an AI product that happens to analyse running.

## Direction

An outdoor performance brand with a thoughtful digital product: **editorial, premium outdoors, athlete-first, evidence-led.** Each race is presented as an experience with a story, and the numbers stay visible and exact.

| Element | Decision |
|---|---|
| Background | Warm ivory `#F6F4ED` instead of cool grey |
| Surfaces | Warm white `#FFFDF8`, very subtle borders `#E3DED0`, more whitespace and fewer boxes |
| Brand colour | Forest `#176B50`, the core brand colour and not just the button colour |
| Text | Deep charcoal-green `#1E2923`; secondary `#3D4840`; captions `#5C665F` |
| Accent | Muted sage, for panels and quiet fills; never used for text |
| Limiter / warning | Earthy red `#A3392B` |
| Headings | Newsreader (editorial serif) |
| UI and body | Inter |
| Data | Tabular numerals everywhere, so times and distances align. The monospace font is gone |
| Imagery | Photos the athlete supplies (see below), otherwise a topographic-line placeholder |
| Detail | Topographic contour lines and line icons drawn from the outdoors, used sparingly |
| Motion | Gentle hover and fade-in transitions; respects `prefers-reduced-motion` |

All text tokens clear WCAG AA (4.5:1) on ivory, on warm white, on the hover surface, on the sage panel and as text on their own 10% tint. The lowest is captions on sage, at 4.87:1. The audit is in the token comment in `src/constants.js`.

## Page changes

- **Header.** Serif wordmark, top-level tabs (**Races, Plan, Profile**), and *Ask RaceIQ* as a quiet secondary action. Profile appears only for a signed-in athlete. The sample athlete keeps an honest label.
- **Races (home).**
  - A compact editorial hero ("Every finish line tells a story."). It shrinks to a slim banner after the first visit, so a returning athlete sees their races without scrolling.
  - A **season summary** (races, distance, time on course, strongest race) replaces the season-form chart card.
  - **A pattern worth noting**: one engine-computed pattern, stated only under the existing rule (at least two races, and at least half of the relevant set). It names the races behind it and shows a small chart of the evidence.
  - **Race cards** replace spreadsheet rows: photo, name, finish time, conditions, and one meaningful insight in plain language. The insight is the engine's own headline or top finding, never a label.
  - The pace sparklines leave the list; pacing charts live in the race analysis, where they have context.
- **Race analysis.** Read as the story of the race. The AI narrative is the lede and the findings are its chapters. Internal classifications (strength / limiter / data gap) become plain-language kickers with an icon instead of shouted labels. The figures, chart, fueling and recommendations follow in the same editorial rhythm.
- **Everything else** (coach, plan, add race, compare, profile, sign-in, error page) picks up the same tokens, type and components, plus page-level touches where the old layout fought the new look.

## Imagery

No stock or AI-generated photos ship with the app. Photos are discovered at build time from `src/assets/photos/` by file name:

| File | Used for |
|---|---|
| `hero.(jpg|png|webp)` | The home hero |
| `race-<race-name-slug>.jpg` (e.g. `race-tunkhannock-trail-50k.jpg`) | That race's card and analysis header |
| `sport-trail-running.jpg`, `sport-road-running.jpg`, `sport-road-cycling.jpg`, `sport-gravel-cycling.jpg` | Any race of that sport without its own photo |

A missing photo falls back to a sage panel with topographic contour lines, seeded by the race so each card differs. Photo discovery happens at build time, so adding a photo means rebuilding (Vercel does this on push).

## Not in scope

- **An Insights page.** The concept's nav had one; we're restyling only. Nav is Races, Plan, Profile, and the "Explore deeper insights" banner is dropped.
- **Dark mode.** The dark palette is updated to match, but the app still ships light only.
- **Per-athlete photo upload.** Photos are a repo-level asset for now.
