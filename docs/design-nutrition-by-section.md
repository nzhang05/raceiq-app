# Design Doc: Section-Based Nutrition Input

**Status:** Draft
**Author:** RaceIQ
**Date:** 2026-07-07

---

## 1. Problem

RaceIQ explains *why* an athlete performed the way they did. Fueling is one of the
core levers — but today it's captured as four whole-race averages:

```js
fueling: { carbsPerHr: 52, sodiumPerHr: 280, fluidsPerHr: 480, caffeine: 80 }
```
— [`src/constants.js:63`](../src/constants.js#L63), entered in [`AddRaceForm.jsx:323-329`](../src/components/AddRaceForm.jsx#L323-L329).

A single average hides the thing that actually matters diagnostically: **when** the
fuel went in relative to **when** the wheels came off. The analysis engine feels this
directly. When carb intake is low for the duration, the best it can say is a generic
disclaimer:

> "That 12g/hr shortfall most often shows up late, where glycogen runs thin."
> — [`analysis.js:74`](../src/utils/analysis.js#L74)

It says "most often" because it has no idea *where* the athlete fueled. Meanwhile the
splits array already carries position and pace ([`analysis.js:88-140`](../src/utils/analysis.js#L88)),
so RaceIQ can pinpoint exactly where pace faded — it just can't line that up against
fueling.

**The insight this design unlocks:** a fade at km 30 that coincides with carb intake
collapsing from 55 g/hr to 15 g/hr over km 20–30 is a *causal story*, not a
disclaimer. Section-based input is what lets RaceIQ tell that story.

## 2. Goals / Non-Goals

**Goals**
- Let athletes optionally log fueling **by section of the race** instead of one average.
- Keep the fast path fast: overall averages stay the default, one-field-per-metric.
- Support the way athletes actually remember fueling — "3 gels between 20 and 30k",
  not "I averaged 52 g/hr."
- Feed section data into the analysis engine so findings can correlate a fueling
  drop-off with a pace fade *in the same section*.
- **Zero breakage.** Every existing race, the Coach, the debrief, and race plans keep
  working untouched.

**Non-Goals**
- Per-product tracking (brand/SKU of each gel). Out of scope; metrics only.
- Real-time / in-race logging. This is post-race entry, like the rest of the form.
- Changing the fueling benchmark model ([`fueling.js`](../src/utils/fueling.js)) — it stays
  duration-based for now (see Open Questions for per-section benchmarking).

## 3. Current State

| Piece | Where | Behavior |
|---|---|---|
| Data shape | `race.fueling` — 4 scalars | Whole-race averages |
| Input | [`AddRaceForm.jsx:323-329`](../src/components/AddRaceForm.jsx#L323) | 4 number fields |
| Debrief | [`RaceDebrief.jsx:83-117`](../src/components/RaceDebrief.jsx#L83) | "Fueling log" table + duration context |
| Analysis | [`analysis.js:68-86`](../src/utils/analysis.js#L68) | Whole-race carbs vs. benchmark → 1 finding |
| Coach LLM ctx | [`Coach.jsx:116-118`](../src/components/Coach.jsx#L116) | Feeds the 4 averages into the prompt |
| Race plan | [`racePlan.js:112-121`](../src/utils/racePlan.js#L112) | Prescribes a target range (unaffected) |

Splits already look like sections: `{ km, pace, tempC, elevM, gradePct, gapPace }`.
The design leans on this — section boundaries snap to split checkpoints so fueling and
pace share a coordinate system.

## 4. Proposed Data Model

Extend `fueling` **additively**. The four scalar fields remain and remain
authoritative for all existing consumers — when sections are present they're *derived*
(a duration-weighted roll-up) rather than typed. Nothing downstream needs to change to
keep working.

```js
fueling: {
  // Roll-up — ALWAYS present. Existing consumers read only these.
  carbsPerHr: 48,          // duration-weighted avg when sections exist
  sodiumPerHr: 320,
  fluidsPerHr: 510,
  caffeine: 80,            // total mg

  // NEW — provenance + optional detail
  inputMode: "sections",   // "overall" (default) | "sections"
  sections: [              // present only when inputMode === "sections"
    {
      fromKm: 0,  toKm: 15,
      carbsPerHr: 55, sodiumPerHr: 350, fluidsPerHr: 550, caffeineMg: 0,
    },
    {
      fromKm: 15, toKm: 30,
      carbsPerHr: 50, sodiumPerHr: 320, fluidsPerHr: 520, caffeineMg: 40,
    },
    {
      fromKm: 30, toKm: 42.2,
      carbsPerHr: 20, sodiumPerHr: 280, fluidsPerHr: 400, caffeineMg: 40,
    },
  ],
}
```

Notes:
- `inputMode` absent or `"overall"` ⇒ legacy race, no migration needed.
- Sections are contiguous, non-overlapping, cover `[0, distanceKm]`. Validation enforces this.
- `caffeineMg` is **total for the section** (caffeine is dosed, not rate-based); the
  roll-up sums to `fueling.caffeine`.
- Carbs/sodium/fluids per section are **rates (per-hr)** so they're directly comparable
  to the duration benchmark — but the UI lets users enter absolute amounts and converts
  (see §5).

## 5. Input UX

Add a mode toggle to the Fueling section header of the form:

```
FUELING          [ Overall average  •  By section ]
```

**Overall (default)** — exactly today's four fields. Fast path, unchanged, one line.

**By section** — a small editor modeled on the existing Splits grid
([`AddRaceForm.jsx:339-358`](../src/components/AddRaceForm.jsx#L339)) for visual consistency:

```
FROM KM   TO KM   CARBS      SODIUM     FLUIDS     CAFFEINE
  0        15     [55]g/hr   [350]      [550]      [0] mg
 15        30     [50]g/hr   [320]      [520]      [40] mg
 30       42.2    [20]g/hr   [280]      [400]      [40] mg
                                                    [+ ADD SECTION]

Entry:  ( ) Rate per hour   (•) Total amount   ← per-metric toggle
Roll-up (duration-weighted, auto):  48 g/hr · 320 mg/hr · 510 ml/hr · 80 mg caffeine
```

Two things earn their keep here:

1. **Snap-to-split boundaries.** When splits exist, offer them as boundary suggestions
   (0 / 15 / 30 / 42.2). Aligning fuel sections to split checkpoints is what makes the
   correlation in §7 clean — same coordinate system, no interpolation.

2. **Amount → rate conversion.** Athletes remember "2 gels + 500ml between 15 and 30k"
   better than a g/hr rate. In "Total amount" mode the user types grams/mg/ml consumed
   in the section; RaceIQ derives the rate using the **section's elapsed time from the
   splits** (`Σ pace over the km range`, already how time is computed). This is the
   genuinely *more intelligent* input the request asks for — it meets the athlete where
   their memory actually lives.

A live roll-up line shows the derived whole-race averages so the athlete sees the
sections reconcile to the single number they're used to.

**Reasonable defaults / low friction:** switching to "By section" pre-seeds sections
from split boundaries (e.g. thirds of the race) pre-filled with the current overall
values, so a user can start from the average and only edit the sections that differed.

## 6. Roll-up / Derivation Logic

New util, e.g. `src/utils/fuelingSections.js`:

```js
// Duration-weighted roll-up so legacy consumers keep reading fueling.carbsPerHr etc.
rollUpSections(sections, splits) -> { carbsPerHr, sodiumPerHr, fluidsPerHr, caffeine }
```

- **Section duration** = sum of `pace` (min/km) across the km range, matching how the
  rest of the app derives time from splits. Fall back to proportional-by-distance if a
  section spans no split (rare; validated against).
- **Rates** (carbs/sodium/fluids): `Σ(rate_i · minutes_i) / Σ(minutes_i)` — time-weighted,
  because a slow closing section should count for the hours it actually took.
- **Caffeine**: `Σ caffeineMg_i` (already total).
- Amount-mode inputs convert to rate first: `rate = amount / (minutes / 60)`.

This runs in `enrichRace` ([`ratings.js`](../src/utils/ratings.js), called at
[`AddRaceForm.jsx:207`](../src/components/AddRaceForm.jsx#L207)) so the roll-up is
computed once at save time and stored — no consumer computes it at read time.

## 7. Analysis Enhancements (the payoff)

New finding type in [`analysis.js`](../src/utils/analysis.js), gated on
`race.fueling.inputMode === "sections"`. Existing whole-race finding stays for legacy
races.

**Fuel-drop-meets-fade correlation.** RaceIQ already finds the biggest pace jump
(`turnKm`, [`analysis.js:148-152`](../src/utils/analysis.js#L148)) and per-section pace.
Cross it with section carb rate:

- For each section, compare its carb rate to the duration benchmark
  ([`fuelingBenchmarks`](../src/utils/fueling.js)) **and** to the pace drift within that
  section's splits.
- Emit a high-signal limiter when a below-range section aligns with a fade:

  > "Your carb intake fell to **20 g/hr over km 30–42** — well under the 60–90 g/hr
  >  range — and that's exactly where your pace drifted from 5:05 to 6:15/km. The
  >  fade tracks the fuel, not just the distance."

  Contrast with today's un-located "most often shows up late."

- Symmetric strength finding: even carb intake + flat splits through the closing
  section ⇒ "you fueled the back third and it held."

**Heat × sodium/fluid timing.** Splits already carry `tempC`
([`analysis.js:45`](../src/utils/analysis.js#L45)). A section where temp climbed but
sodium/fluid rate dropped is a targeted dehydration finding that the single average
can't produce.

## 8. Debrief & Coach

**Debrief** ([`RaceDebrief.jsx`](../src/components/RaceDebrief.jsx)): when sections exist,
render the "Fueling log" table as a small per-section breakdown (reuse the
[`PaceHeatStrip`](../src/components/PaceHeatStrip.jsx) visual language — a strip colored
by carb-rate-vs-target per section, aligned under the pace chart so fuel and fade line
up visually). Fall back to the current flat table for legacy races.

**Coach** ([`Coach.jsx:116-118`](../src/components/Coach.jsx#L116)): when sections exist,
append a compact per-section block to the LLM context so answers can reason about
timing:

```
Fueling by section:
  0–15km:  55g carbs/hr, 350mg Na/hr  (pace 4:42→4:50)
  15–30km: 50g carbs/hr, 320mg Na/hr  (pace 4:55→5:22)
  30–42km: 20g carbs/hr, 280mg Na/hr  (pace 5:51→6:15)  ⚠ below 60–90 range
```

Keep the roll-up line too, so the existing prompt shape is preserved and the model can
still answer whole-race questions.

## 9. Backward Compatibility & Migration

- **No data migration.** Absent `inputMode` ⇒ treated as `"overall"`; all four scalars
  already exist on every stored race.
- Every current consumer reads `fueling.carbsPerHr` et al. — untouched, because the
  roll-up keeps those fields authoritative.
- Editing a legacy race opens in "Overall" mode with today's fields populated.
- Storage ([`storage.js`](../src/utils/storage.js)) is JSON — the extra keys serialize
  for free.

## 10. Edge Cases

- **Sections don't cover the full distance** → validation error, like the "at least two
  splits" guard ([`AddRaceForm.jsx:178`](../src/components/AddRaceForm.jsx#L178)).
- **Overlapping / out-of-order sections** → sort + validate contiguity on submit.
- **A section spans no split** → can't derive duration for amount-mode; fall back to
  distance-proportional and flag it, or block amount-mode until splits exist.
- **Sub-benchmark-duration races** (<45 min, `needsCarbs: false`) → hide the section
  editor; sectioning fuel adds no signal there.
- **Editing splits after sections exist** → boundaries may no longer align; re-validate
  and re-roll-up on save.

## 11. Rollout / Phasing

1. **Model + roll-up.** Add `inputMode`/`sections`, `fuelingSections.js`, wire roll-up
   into `enrichRace`. No UI yet. Ships invisibly; legacy path identical.
2. **Input UX.** Mode toggle + section grid + amount→rate conversion + live roll-up.
3. **Analysis.** Fuel-drop-meets-fade + heat×sodium findings.
4. **Debrief + Coach.** Per-section visualization and LLM context.

Each phase is independently shippable and reversible; nothing before phase 3 changes
any output.

## 12. Open Questions

- **Per-section benchmarks?** `fuelingBenchmarks` is duration-based over the whole race.
  Do we benchmark each section against the *remaining* duration (a late section in a
  4h race still "needs" 60–90 g/hr) or the whole-race target? Leaning whole-race target
  for v1 to avoid confusing math.
- **Boundary model:** distance (km) vs. time vs. named phases (start/mid/finish)?
  Proposal picks **km snapped to splits** for coordinate alignment; revisit if athletes
  think in time.
- **How many sections is too many?** Suggest defaulting to 3 (thirds) and cap the UI at
  ~6 to keep it from becoming a per-gel log (which is a Non-Goal).
- **Cycling vs. running:** memory notes cycling uses km/hr and running uses min/km pace
  ([[feedback-speed-units]]). Section duration derivation must use the sport-correct
  pace/speed field — confirm against how splits store it per sport.
