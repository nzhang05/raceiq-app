# Design Doc: Ultra-Distance Planning — Stop Time, Drop Bags & the Crew Sheet

**Status:** Implemented (Phases 1–4) on `feat/ultra-planning`
**Author:** RaceIQ
**Date:** 2026-08-25

---

## 1. Problem

The race plan today models a race as *continuous motion*. `buildCarryPlan`
([`aidStations.js:146`](../src/utils/aidStations.js#L146)) walks the pacing profile,
converts elapsed minutes per leg into carbs/fluids/sodium, and stops there. Aid
stations exist only as refill points with two booleans — `water` and `food`
([`aidStations.js:23-40`](../src/utils/aidStations.js#L23)).

That model is correct for a marathon and wrong for a 100-miler. In an ultra:

- **Time stands still at aid stations.** Ten stations × 8 minutes is 80 minutes.
  A 100-mile plan with a sleep stop can lose 2–4 hours to non-moving time. The plan
  currently distributes the athlete's entire target time across the course as
  *pace*, so every stop the athlete actually takes silently blows the plan.
- **Fuel isn't carried, it's staged.** Beyond ~50 km the question stops being
  "how many gels fit in my vest" and becomes "what's in the drop bag at Station 4,
  and did I remember the headlamp." RaceIQ has a kit builder
  ([`fuelKit.js`](../src/utils/fuelKit.js)) but it tallies one undifferentiated pile
  for the whole race.
- **Nobody knows when the athlete arrives.** The single most-asked question in
  ultra crewing — *"what time will they hit Aid 6?"* — is unanswerable from the
  current plan, which reports elapsed minutes only. Elapsed minutes are useless to
  a crew member standing in a field at 3 a.m.

**The insight:** once stop time and a start time-of-day exist, every one of these
falls out of the same computation. Cumulative elapsed → clock ETA → darkness →
headlamp → drop-bag contents → crew schedule. The PDF export
([`planPdf.js`](../src/utils/planPdf.js)) already produces a hand-off document; it
just has nothing ultra-specific to hand off.

## 2. Goals / Non-Goals

**Goals**

- Model **time spent at aid stations**, including long stops and sleep, as
  first-class non-moving time that the pacing plan accounts for.
- Compute **estimated time of day** at every aid station, with an arrival
  *window* rather than a false-precision point estimate.
- Let athletes define **drop bags** per station: fuel items plus free-text gear.
- Produce a **crew sheet** — a separate printable document aimed at the support
  crew, not the athlete: where to be, when, what to hand over.
- Keep the marathon/road path visually and behaviourally unchanged. Every new
  field is optional and collapses away below ultra distance.
- **Zero breakage.** Existing plans, the Coach, the debrief and the existing PDF
  keep working untouched.

**Non-Goals**

- Live tracking or in-race updates. This is a pre-race artifact.
- Pacer scheduling / crew-member assignment as a modelled entity (v1 keeps crew
  notes as free text per station).
- Multi-loop courses with repeated stations. The station list stays a monotonic
  km-ordered list; a loop course is modelled by repeating the km values.
- Changing the fueling benchmark model ([`fueling.js`](../src/utils/fueling.js)).

## 3. Current State

| Piece | Where | Behavior |
|---|---|---|
| Station shape | [`aidStations.js:23-40`](../src/utils/aidStations.js#L23) | `{ km, name, water, food }` |
| Station editor | [`RacePlanForm.jsx:570-607`](../src/components/RacePlanForm.jsx#L570) | 4-column grid + drag-on-profile |
| Leg computation | [`aidStations.js:146`](../src/utils/aidStations.js#L146) | Elapsed minutes → carbs/fluids/sodium per leg |
| Pacing sections | [`aidStations.js:82`](../src/utils/aidStations.js#L82) | Per-section pace, grade, elev gain |
| Time budget | [`racePlan.js:95`](../src/utils/racePlan.js#L95) | `targetMinutes` spread across weighted course cost |
| Kit | [`fuelKit.js`](../src/utils/fuelKit.js) + [`RacePlanView.jsx:310`](../src/components/RacePlanView.jsx#L310) | One whole-race tally |
| Export | [`planPdf.js:31`](../src/utils/planPdf.js#L31) | Athlete-facing HTML → browser print |
| Plan persistence | [`App.jsx:135`](../src/App.jsx#L135) | **None** — `planData` is in-memory React state |

Two facts from this table drive the design below: `targetMinutes` is currently
consumed as *moving* time even though it's entered as a finish time, and plans are
not persisted at all.

## 4. The Time Model (the load-bearing decision)

Today `buildRacePlan` hands `targetMinutes` straight to the pace solver
([`racePlan.js:95`](../src/utils/racePlan.js#L95)), so the target is implicitly
**moving time**. But the athlete types it into a field labelled "target finish
time", and every reference race it's derived from is a *gun-to-tape elapsed* result
([`estimateTargetTime`](../src/utils/racePlan.js#L37)). The two only agree when stop
time is zero — which is exactly the assumption ultras break.

**Decision: `targetMinutes` means total elapsed time.** Introduce the split:

```js
stopMinutes  = Σ station.stopMinutes          // non-moving
movingMinutes = targetMinutes - stopMinutes   // what the pace solver gets
```

Consequences, all deliberate:

- With no stop times set, `stopMinutes === 0` and every existing plan produces
  byte-identical output. This is what makes the change safe to land first.
- Adding a 90-minute sleep stop makes the athlete's *moving* pace faster, and the
  plan says so. That's the honest answer: if you want to sleep, you have to run
  the rest quicker or move your goal.
- Guard: if `stopMinutes >= targetMinutes * 0.5`, clamp and surface a warning
  rather than emitting an absurd pace. Renders through the existing note channel
  (key + values, per [`aidStations.js:180`](../src/utils/aidStations.js#L180)).

`carryPlan` legs must then distinguish **moving minutes** (which drive fuel
consumption on the leg) from **elapsed minutes** (which drive the clock). Fuel
burn keeps using moving time; a station stop gets its own small fuel allowance
handled as station intake, not carried load.

## 5. Data Model Changes

### 5.1 Aid station

```js
{
  id, km, name, water, food,        // unchanged
  stopMinutes: 0,                   // planned dwell
  sleepMinutes: 0,                  // subset of stopMinutes, flagged separately
  crewAccess: false,                // crew allowed at this station
  dropBag: null | {
    items: { gel: 4, bar: 2, ... }, // keys from FUEL_ITEMS
    gear: ["Headlamp + spare batteries", "Dry socks"],
    notes: "",
  },
  cutoff: null,                     // "HH:MM" clock time or null
}
```

`sanitizeAidStations` gains coercion for the new fields with the same
drop-bad-input discipline it already applies to `km`: non-numeric or negative
`stopMinutes` → 0, `sleepMinutes` clamped to `≤ stopMinutes`.

### 5.2 Plan

```js
plan.startTimeOfDay = "05:00"   // local clock, required for ETAs
plan.ultra = true               // derived; see §7
plan.stopMinutes                // total, for the summary card
plan.movingMinutes
```

### 5.3 Carry-plan leg / station row

Each leg gains `movingMinutes`; each *point* gains an arrival block:

```js
{
  arrivalMinutes,      // cumulative elapsed at arrival
  departMinutes,       // arrivalMinutes + stopMinutes
  arrivalClock,        // "14:32"
  arrivalDayOffset,    // 0 | 1 | 2 — "+1d" badge for multi-day races
  arrivalWindow: { earlyClock, lateClock },
  inDarkness: bool,
  cutoffMarginMinutes, // null when no cutoff set; negative = projected miss
}
```

### 5.4 Arrival windows

A point ETA 19 hours into a 100-miler is fiction. Model spread as a percentage of
elapsed time that widens with distance into the race:

```js
spread = arrivalMinutes * (0.04 + 0.06 * (arrivalMinutes / targetMinutes))
```

≈ ±4 % early on, ≈ ±10 % by the finish. Crews plan against the **early** edge
(be there before they are) and the cutoff check runs against the **late** edge.
The coefficients are a starting point to tune against logged races — see §10.

Darkness uses sunrise/sunset for the race location and date. Open-Meteo's daily
endpoint — already called in [`forecastWeather`](../src/utils/racePlan.js#L19) —
returns `sunrise,sunset` for free; adding them to the existing `daily=` parameter
list costs one request and no new dependency. It also already has the offline
fallback path via `isNetworkBlockedError`, which we reuse (no sunrise data →
`inDarkness: null` → the darkness column simply doesn't render).

## 6. Phasing

Each phase is independently shippable and independently valuable.

### Phase 1 — Stop time & the elapsed/moving split

*Core of the whole feature; everything else builds on it.*

- `sanitizeAidStations`: accept and clamp `stopMinutes` / `sleepMinutes`.
- `buildRacePlan`: compute `stopMinutes`/`movingMinutes`, pass moving time to the
  pace solver, add the over-budget guard.
- `buildCarryPlan` / `buildPacingSections`: take `movingMinutes`, expose both
  moving and elapsed per leg.
- Form: a "Stop" minutes column in the station grid
  ([`RacePlanForm.jsx:572`](../src/components/RacePlanForm.jsx#L572) — grid becomes
  `80px 1fr 70px auto auto 32px`).
- View: a "Moving / stopped" line under the target-time summary card.
- i18n: new keys in `en/plan.js` + `fr/plan.js` (`check-i18n` enforces parity).

**Test focus:** zero stop time reproduces current output exactly.

### Phase 2 — Clock ETAs, darkness & cutoffs

- Start time-of-day field in the form (next to `raceDate`,
  [`RacePlanForm.jsx:306`](../src/components/RacePlanForm.jsx#L306)).
- New `src/utils/schedule.js`: pure module turning `(plan, startTimeOfDay,
  sun)` into the per-point arrival block of §5.3. Kept out of `aidStations.js`
  so the carry math stays independent of wall-clock concerns.
- Extend `forecastWeather` with `sunrise,sunset`.
- Station grid gains an optional cutoff field; view flags a projected miss in
  `T.ember`, matching the existing `overCapacity` treatment.
- View: ETA and "🌙" darkness marker in the pacing-section rows.

**Value on its own:** an athlete who never touches drop bags still gets a
station-by-station schedule and a cutoff safety check.

### Phase 3 — Drop bags

- Per-station drop-bag editor. Recommended UX: the station row gets a "BAG"
  toggle; enabling it expands an inline panel reusing the `FUEL_ITEMS` stepper
  control already built in
  [`RacePlanView.jsx:321-343`](../src/components/RacePlanView.jsx#L321) — extract
  it to `components/FuelItemPicker.jsx` and share.
- Free-text gear lines (add/remove), the ultra-critical half: lamps, batteries,
  socks, poles, jacket, charger.
- **Derived suggestions**, the piece that makes this RaceIQ rather than a notes
  app:
  - Bag at a station whose *outbound* leg runs in darkness and has no lamp line →
    suggest "Headlamp + spare batteries".
  - Outbound leg carbs exceed what the athlete is carrying → suggest the gel/bar
    count that closes the gap, computed from the leg's existing `carbsG`.
  - Any station past ~8 h with no dry-socks/shoe line → suggest it.
  - Suggestions are one-tap-accept chips, never auto-inserted.
- Kit tally becomes two-tier: *on-body* vs *staged*, so the progress bars in
  [`RacePlanView.jsx:346`](../src/components/RacePlanView.jsx#L346) measure the
  right thing.

### Phase 4 — The crew sheet

A **second** export, not a section bolted onto the athlete PDF. Different reader,
different information, different physical use (printed, folded, in a car).

`src/utils/crewPdf.js`, sharing the `esc`/`fmtDuration` helpers and the print-to-
iframe mechanism already in [`planPdf.js:191`](../src/utils/planPdf.js#L191) —
extract those into `printDocument(html)` and have both callers use it.

Layout, one page per crew-access station where possible:

```
ATHLETE   Noah Zhang  ·  BIB —  ·  UTMB 100M  ·  2026-08-29 05:00 START

STATION 4 — COL DU BONHOMME          km 61.2        CREW ACCESS
  ARRIVE      15:42   (window 14:58 – 16:31)
  CUTOFF      19:00                 margin +2h29
  STOP        12 min planned
  DEPART      15:54    · next 18.4 km, 3h10, DARK after 20:10

  HAND OVER   4 × gel · 2 × bar · 1 × flask (sports mix)
              Headlamp + spare batteries
              Dry socks, long-sleeve
  TAKE BACK   empty flasks, poles
  NOTES       he'll say he's fine. make him eat something warm.
```

Plus a leading summary table (all stations, one row each: km, ETA window, crew
access Y/N, cutoff) so the crew can see the whole day at a glance, and a "what
they're carrying between stations" strip so a crew member can sanity-check the
athlete's vest.

### Phase 5 — Persistence & sharing *(scope decision required)*

The crew sheet is a document you give to *other people*, which raises the obvious
question of a shareable link. But **plans are not persisted at all today**
([`App.jsx:135`](../src/App.jsx#L135)) — a refresh loses the plan. Making a plan
shareable means a `race_plans` table, RLS, a share-token path, and an unauthenticated
read route: a materially larger piece of work than Phases 1–4 combined.

**Recommendation: v1 is print/PDF only.** The PDF is genuinely the right medium
for a crew — it works in a valley with no signal, which a URL does not. Persistence
should be justified on its own merits (not losing your plan on refresh), and is
tracked as a separate design.

## 7. Progressive Disclosure

Ultra fields must not clutter a 10 km plan. Derive an `ultra` flag:

```js
const ultra = gpxData.distanceKm >= 50 || targetMinutes >= 360;
```

- `ultra === false` → stop-time, cutoff, drop-bag and crew columns hidden;
  a single "Ultra options" link reveals them (never hard-gated — a 42 km race with
  a 7-hour target is an ultra in every way that matters here).
- `ultra === true` → shown by default, and `autoSpaceStations`
  ([`RacePlanForm.jsx:132`](../src/components/RacePlanForm.jsx#L132)) seeds a
  default `stopMinutes` (suggest 5 min, 15 min at stations past 8 hours) so the
  athlete edits numbers rather than inventing them.

The station grid is already at 5 columns and will not absorb 4 more. Phase 3
should move each station to an expandable row: the current compact grid stays as
the collapsed summary, and expanding reveals stop time / sleep / cutoff / crew /
drop bag.

## 8. Files Touched

| File | Phase | Change |
|---|---|---|
| [`src/utils/aidStations.js`](../src/utils/aidStations.js) | 1, 3 | New fields; moving-vs-elapsed split |
| [`src/utils/racePlan.js`](../src/utils/racePlan.js) | 1, 2 | Time budget; `sunrise,sunset` in forecast |
| `src/utils/schedule.js` | 2 | **New** — clock ETAs, windows, darkness, cutoffs |
| [`src/utils/fuelKit.js`](../src/utils/fuelKit.js) | 3 | Per-bag tallying alongside whole-race |
| `src/utils/dropBags.js` | 3 | **New** — bag suggestion rules (kept out of `fuelKit.js`: they need leg and schedule data, which are not fuel-kit concerns) |
| `src/utils/printDoc.js` | 4 | **New** — `printDocument()`, shared formatters and the print stylesheet, extracted from `planPdf.js` so both documents match |
| [`src/components/RacePlanForm.jsx`](../src/components/RacePlanForm.jsx) | 1–3 | Start time; expandable station rows |
| `src/components/FuelItemPicker.jsx` | 3 | **New** — extracted from `RacePlanView` |
| [`src/components/RacePlanView.jsx`](../src/components/RacePlanView.jsx) | 1–3 | ETA/darkness/cutoff columns; two-tier kit |
| [`src/utils/planPdf.js`](../src/utils/planPdf.js) | 4 | Moved to `printDoc.js` helpers; schedule table + ETA column |
| `src/utils/crewPdf.js` | 4 | **New** — crew sheet |
| `src/i18n/{en,fr}/plan.js` | all | New keys, both locales |

## 9. Risks

- **Silent plan shift.** Phase 1 changes what `targetMinutes` means. Mitigated by
  the zero-stop-time identity property, but it must be an explicit test, and the
  view should state "moving X, stopped Y" so the athlete sees the split.
- **False precision.** A crew that treats a 3 a.m. ETA as a promise will be
  standing in the cold. Every ETA renders as a window; the point estimate is
  secondary typography.
- **Station-row complexity.** Nine fields per station is a data-entry chore
  mid-form. The expandable row plus seeded defaults is the mitigation; if it still
  feels heavy, the fallback is a dedicated "Ultra setup" step after plan generation.
- **Sunrise dependency.** One more field on an existing call, with the existing
  offline fallback — but darkness must degrade to "not shown", never to "wrong".
- **i18n drift.** `scripts/check-i18n.mjs` runs in `npm run build` and catches
  missing keys and placeholder mismatches; new keys land in both locales in the
  same commit.

## 10. Open Questions

1. **Window coefficients.** The ±4→10 % spread in §5.4 is asserted, not measured.
   Worth calibrating against logged ultra results once a few exist — a debrief
   already knows planned vs actual per section.
2. **Fuel consumed *at* a station.** A 15-minute stop with soup and coke is real
   intake that currently isn't counted anywhere. Simplest v1: exclude it, and let
   the drop-bag/hand-over list carry the intent. Proper modelling is a follow-up.
3. **Cutoffs as clock vs elapsed.** Race manuals publish both. v1 accepts clock
   time (what manuals most often print); accepting elapsed and converting is a
   small addition once `startTimeOfDay` exists.
4. **Pacer legs.** Many US 100-milers allow a pacer from a given station. It's
   one more per-station boolean and one more crew-sheet line — cheap, but deferred
   until the station row's complexity budget is understood.
5. **Does the crew sheet want the pacing table at all?** Argument for: a crew that
   sees the athlete is 40 minutes down knows to change the plan. Argument against:
   it's the athlete's information and it makes the sheet twice as long. Leaning
   toward a compact "on schedule / behind" reference column only.

---

## 11. Implementation Notes

Built on `feat/ultra-planning`. Two deviations from the file table as originally
drafted, both recorded above: bag suggestions live in their own `dropBags.js`
rather than in `fuelKit.js` (they depend on leg and schedule data, which the fuel
catalogue has no business knowing about), and the print helpers were extracted to
`printDoc.js` rather than exported from `planPdf.js`, so the crew sheet doesn't
have to import the athlete's plan document to print itself.

`buildRacePlan` was refactored from nine positional parameters to
`(gpxData, sport, weather, targetMinutes, allRaces, options)`. Adding
`startTimeOfDay` to the positional list would have made it eleven.

**The §4 identity property was verified, not assumed.** The pre-ultra
`racePlan.js` and `aidStations.js` were restored from `HEAD` alongside the new
ones and both were run over the same 100 km course: `pacing`, `pacingSections`,
`carryPlan`, `nutrition`, `recommendations` and `targetClock` were byte-identical
with no stop times set.

Phase 5 (persistence and sharing) was not built, per the recommendation in that
section — the plan is still in-memory and the crew sheet is print-only.
