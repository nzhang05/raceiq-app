# Design Doc: Internationalization (English + French)

**Status:** Draft
**Date:** 2026-08-17

---

## 1. Problem

Every user-facing string in RaceIQ is a hardcoded English literal, and a large share of
them aren't labels at all — they're **generated prose**. `buildDebrief()` in
[`src/utils/analysis.js`](../src/utils/analysis.js) assembles sentences like:

```js
body: `Your closing third averaged ${lastPace}${gapNote} against ${firstPace} in the
opening third — a ${fade}% change — with split-to-split variation of just ${cv}%.`
```

That's the interesting part of the product and the hard part of this project. A naive
"wrap every string in `t()`" pass would leave these sentences as un-translatable English
templates baked into pure utility modules.

Secondary issues:
- Dates are formatted with a hardcoded locale: `toLocaleDateString("en-US", …)` in
  [`src/utils/time.js:11`](../src/utils/time.js#L11) and `:16`.
- The AI Coach ([`src/components/Coach.jsx`](../src/components/Coach.jsx)) builds an
  English system prompt and English canned fallbacks.
- The plan export ([`src/utils/planPdf.js`](../src/utils/planPdf.js)) renders a whole
  English HTML document for printing.
- `SEED_RACES` in [`src/constants.js`](../src/constants.js) ships English `headline`
  strings as *data*.
- There is nowhere to store a language preference — `profiles` has `units` but no
  `locale` ([`supabase/migrations/0001_auth_and_profiles.sql`](../supabase/migrations/0001_auth_and_profiles.sql)).

## 2. Goals / Non-Goals

**Goals**
- Full EN + FR coverage of the UI, generated debriefs, race plans, the Coach, and the
  printable plan export.
- Language persists: `profiles.locale` for signed-in users, `localStorage` for anonymous,
  `navigator.language` as first-run default.
- Locale-correct dates, numbers, and lists via `Intl`.
- A machine check that fails when EN and FR key sets diverge.

**Non-Goals**
- **Units are not locale.** `profile.units` (metric/imperial) stays an independent
  setting — a French user may want imperial, an American metric. Do not couple them.
- No RTL, no third language yet — but the key structure must not assume two.
- Not translating the design docs or code comments.
- Not translating user-entered content (race names, locations, Coach questions).

## 3. Approach

### 3.1 Library

Add `i18next` + `react-i18next` + `i18next-browser-languagedetector`.

Rejected: a homegrown `t()` over a flat object. It's tempting given the app has three
runtime deps, but we need plural rules (FR has different plural boundaries than EN —
`0` and `1` are both singular in French), interpolation with locale-aware number
formatting, and namespace splitting. i18next gives all of that plus `Intl` integration
for ~40 KB gzipped, and its ICU-ish plural suffixes (`_one` / `_other`) are what
translators expect.

### 3.2 Key architecture — the important decision

**Analysis/plan generators stop returning prose. They return structured findings.**

Today:

```js
strengths.push({
  title: "Pacing held even through the finish",
  body: `Your closing third averaged ${lastPace}…`,
});
```

After:

```js
strengths.push({
  key: "debrief.pacing.even",
  values: { lastPace, firstPace, fade, cv, gapNote: m.useGap },
});
```

and the renderer (`<Finding>` in [`src/components/ui.jsx:241`](../src/components/ui.jsx#L241))
calls `t(`${f.key}.title`)` / `t(`${f.key}.body`, f.values)`.

Why this and not "pass `t` into `buildDebrief()`":
- Keeps `analysis.js`, `racePlan.js`, `ratings.js`, `aidStations.js` **pure** — they stay
  testable and free of React/i18n imports.
- Findings become inspectable data. A finding is now `{key, values}`, which is
  exactly what you'd want if debriefs are ever cached, diffed, or fed to the Coach.
- Translators get a flat catalog of ~60 sentence templates instead of hunting through
  branching JS.
- The `gapNote` case (`" grade-adjusted"` spliced mid-sentence) becomes a boolean the
  French sentence can place wherever French grammar wants it. This is the single most
  common way naive i18n breaks — string concatenation that assumes English word order.

**Ordering caveat:** some templates embed an adjective agreement or a value's position
that differs in FR. Because each finding is one whole sentence keyed independently, the
translator can restructure freely. Never split a sentence across two keys.

### 3.3 Catalog layout

```
src/i18n/
  index.js            # i18next init, detector config, Intl formatters
  en/
    common.json       # nav, buttons, form labels, errors
    debrief.json      # ~35 finding/recommendation templates from analysis.js
    plan.json         # racePlan.js + aidStations.js + planPdf.js
    coach.json        # UI chrome, canned replies, refusals
  fr/  (same four files)
```

Namespaces are lazily loadable later; for now bundle all six JSON files (they're small).

### 3.4 Locale-aware formatting

Replace the hardcoded `"en-US"` in `time.js` with the active locale, and add shared
formatters in `src/i18n/format.js`:

- `fmtDate` / `fmtMonth` — `Intl.DateTimeFormat`. Note FR is `19 avr. 2026`, EN is
  `Apr 19, 2026` — the components must not assume width.
- `fmtNumber` — `Intl.NumberFormat`. **FR uses a comma decimal separator and a
  narrow-NBSP thousands separator.** Every `.toFixed(1)` that lands in the UI
  (grades in `analysis.js`, weights in `ProfileForm.jsx`) needs to route through this.
- `fmtList` — `Intl.ListFormat` for the sport lists in the Coach system prompt.
- Pace `4:42/km` and clock `3:24:51` stay as-is — colon-separated time is universal.
  Do **not** run these through `Intl.NumberFormat`.

`fmtPace` in [`src/utils/pace.js`](../src/utils/pace.js) and the duplicate in
[`planPdf.js:11`](../src/utils/planPdf.js#L11) hardcode the `/km` suffix — that becomes
`t('common:units.perKm')`, and the duplicate should be deleted in favour of the shared one.

### 3.5 Persistence

- Migration `0002_locale.sql`: `alter table public.profiles add column if not exists
  locale text not null default 'en';`
- `AuthContext` already loads/updates `profiles` — extend `updateProfile` to write
  `locale`, and on profile load call `i18n.changeLanguage(profile.locale)`.
- Anonymous users: `localStorage['raceiq:locale']`, which is also what the language
  detector reads first. On first sign-in, the local choice is written to the profile
  (mirroring the existing `migrated_local` race-import pattern).
- Detection order: `localStorage` → `navigator` → fallback `en`. Supported: `['en','fr']`,
  with `fr-CA`/`fr-FR` both resolving to `fr` via i18next's `load: 'languageOnly'`.

### 3.6 The AI Coach

Three separate concerns:
1. **UI chrome** (headers, placeholders, the "Ask RaceIQ" label) — normal `t()`.
2. **Canned fallbacks** — the medical-refusal and training-plan-refusal strings at
   [`Coach.jsx:222-237`](../src/components/Coach.jsx#L222-L237) become catalog entries.
   Note the *intent classifier* that routes to them matches English keywords; it needs a
   FR keyword set too, or it will silently stop catching medical questions asked in
   French. **This is a safety-relevant path, not a cosmetic one.**
3. **LLM output** — append to the system prompt: `Respond in French.` / `Respond in
   English.` keyed off the active locale, and keep the DATA block in English (it's
   structured data; translating field names would only confuse the model). Verify the
   model doesn't drift back to English on long answers.

### 3.7 Seed data and stored races

`SEED_RACES[].headline` is English prose in a data structure. Replace each with a
`headlineKey` (`'seed.r1.headline'`). For user races, `deriveHeadline()` in
[`ratings.js:74`](../src/utils/ratings.js#L74) already generates the headline — convert it
to return `{key, values}` like the debrief findings.

**Migration concern:** races already saved in Supabase (`races.data` jsonb) or
localStorage contain a generated English `headline` string. Handle it in the read path:
if `data.headlineKey` exists use it, else fall back to the stored literal. No backfill
migration needed — the headline is cheap to regenerate, and old rows degrade to showing
English text for that one line rather than breaking.

`verdictLabel()` at [`ratings.js:122`](../src/utils/ratings.js#L122) returns display
strings — move to the catalog. `verdictColor()` is untouched.

### 3.8 Printable plan export

[`planPdf.js`](../src/utils/planPdf.js) builds a full HTML document with ~40 English
labels (`"Target time"`, `"Carbs / hr"`, table headers, the `srcTag` suffixes like
`" (your input)"`). Pass a `t` function into `buildPlanHtml(plan, kit, t)` — this is the
one place where injecting `t` beats returning structured data, since the output is a
finished document, not a render tree. Also set `<html lang>` on the generated document
so the print engine hyphenates correctly.

### 3.9 Language switcher

A two-item segmented control (`EN` / `FR`) in the header next to the profile, plus a
Language row in [`ProfileForm.jsx`](../src/components/ProfileForm.jsx) beside Units.
Switching is instant (no reload) since i18next re-renders subscribers.

## 4. Phasing

| Phase | Scope | Files | Est. |
|---|---|---|---|
| 0 | Delete dead code: [`src/RaceIQ.jsx`](../src/RaceIQ.jsx) (4,887 lines) is not imported anywhere — `main.jsx` renders `App.jsx`. Translating it would be ~40% wasted effort. | 1 | 15 min |
| 1 | Infra: deps, `src/i18n/`, detector, `format.js`, `<html lang>`, language switcher, `0002_locale.sql`, `AuthContext` wiring | ~8 | 0.5 d |
| 2 | Static UI strings: `ui.jsx`, `App.jsx`, `SignIn`, `ProfileForm`, `RaceList`, `Compare`, `RaceDebrief`, `PaceHeatStrip`, `FuelingSectionEditor`, `ElevationProfile` | ~11 | 1 d |
| 3 | Forms + errors: `AddRaceForm` (26 strings incl. GPX parse errors), `RacePlanForm` (27), `gpx.js`, `weather.js` error paths | ~4 | 1 d |
| 4 | **Generated prose refactor** — `analysis.js`, `ratings.js`, `racePlan.js`, `aidStations.js`, `fuelKit.js`, `fueling.js` → `{key, values}`; renderers updated | ~9 | 2 d |
| 5 | Coach: chrome, canned replies, **FR intent-classifier keywords**, system-prompt language directive | 1 | 0.5 d |
| 6 | Plan export `planPdf.js` | 1 | 0.5 d |
| 7 | FR translation pass + layout QA | catalogs | 1–2 d |

Phases 2 and 3 are parallelizable; phase 4 is the critical path and should start early.

## 5. Verification

- **Key parity script** (`scripts/check-i18n.mjs`, wired into `npm run build`): loads
  every EN and FR namespace, fails on missing/extra keys and on interpolation
  placeholders that differ between the two (`{{fade}}` present in EN but not FR).
- **Literal-string scan**: a grep-based check for JSX text nodes matching
  `>[A-Z][a-z]{3,}` outside the catalogs, run manually as a coverage audit. A full
  `eslint-plugin-i18next` setup is overkill here — the repo has no ESLint config at all
  and adding one is a separate decision.
- **Pseudo-locale** (`en-XX` that wraps every string in `⟦…⟧` and pads 30%): catches both
  untranslated literals and layout overflow in one pass. Cheap to add to the i18next init,
  dev-only.
- **Manual QA in FR** on the debrief, plan, and Coach views.

## 6. Risks

- **French runs 15–25% longer than English.** The tight spots are the stat tiles in
  [`RaceDebrief.jsx:59`](../src/components/RaceDebrief.jsx#L59) (`"RaceIQ score"` →
  `"Score RaceIQ"` is fine, but `"Est. conditions"` → `"Conditions estimées"` is not), the
  `Pill` components, and the plan-export table headers. Expect real CSS work in phase 7,
  not just translation. The pseudo-locale surfaces this before the FR copy exists.
- **The debrief refactor touches the product's core value.** Every finding is a behavior
  change risk. Do it as one focused pass with the EN output diffed against current output
  before FR copy is written — the EN strings should render byte-identical after phase 4.
- **Coach LLM drift**: the model may answer in English despite the directive, especially
  when the DATA block is English. Needs spot-checking; a fallback is to also localize the
  DATA block's field labels if drift proves persistent.
- **Terminology consistency.** Endurance-sport French has real conventions —
  *allure* (pace), *dénivelé* (elevation gain), *ravitaillement* (aid station/fueling),
  *fractionné*, *seuil* (threshold). Build a short glossary at the top of the FR catalog
  before phase 7 and hold to it, or the copy will read as machine-translated to the
  target audience.
