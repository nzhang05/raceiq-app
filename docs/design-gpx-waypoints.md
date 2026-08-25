# Design Doc: Aid-Station Prefill from GPX Waypoints

**Status:** Implemented
**Date:** 2026-08-25

> Implemented as specified, with two deliberate departures from §6, both noted inline
> in [`src/utils/waypoints.js`](../src/utils/waypoints.js): exclusions no longer beat a
> positive aid match (so "Ravito Col de la Forclaz" stays a station), and water-only is
> judged from the name and symbol rather than the description (so a full station whose
> description reads "eau, sucré, salé" isn't demoted). Both are covered by tests.

---

## 1. Problem

`parseGpxPoints()` in [`src/utils/gpx.js:22`](../src/utils/gpx.js#L22) reads `<trkpt>`
elements and nothing else. Aid stations in course files are essentially never track
points — they are `<wpt>` elements, siblings of `<trk>`, carrying `<name>`, `<desc>`,
`<sym>` and `<type>`. Course downloads from UTMB, ITRA-affiliated organizers, Gaia,
Komoot and most timing providers ship aid stations, checkpoints and cutoffs exactly
this way. RaceIQ discards all of it.

The cost is concentrated in one place. `buildCarryPlan()`
([`src/utils/aidStations.js:137`](../src/utils/aidStations.js#L137)) defines every leg
by the gaps between station km marks, so the entire carry plan — how many gels to leave
the start line with, which legs exceed carry capacity — is only as good as those marks.
Today the only assisted way to get them is `autoSpaceStations()`
([`src/components/RacePlanForm.jsx:129`](../src/components/RacePlanForm.jsx#L129)), which
drops a station every 8 km (25 km cycling) regardless of where the race actually put
them. On a mountain course where stations cluster at cols and are 14 km apart across a
high traverse, that guess is wrong in the direction that matters: it under-carries.

Two related defects surface in the same files:

- **Course name is misread whenever waypoints exist.**
  `xmlDoc.getElementsByTagName("name")[0]` ([`gpx.js:184`](../src/utils/gpx.js#L184) and
  [`:237`](../src/utils/gpx.js#L237)) takes the first `<name>` in document order. The GPX
  schema orders children `metadata → wpt* → rte* → trk*`, so on a file with waypoints and
  no `<metadata><name>`, the course name becomes *the first aid station's name*. This bug
  is currently invisible and becomes visible the moment we start shipping waypoint-rich
  files through the parser.
- **Route-only exports fail outright.** Some organizers publish the course as `<rte>` /
  `<rtept>` rather than a track. Those hit `"No track points found in this file."`
  ([`gpx.js:170`](../src/utils/gpx.js#L170)).

## 2. Goals / Non-Goals

**Goals**

- Parse `<wpt>` elements out of GPX, resolve each to a course distance in km, classify it
  as an aid station or not, and prefill Section 6 of the plan form.
- Never silently overwrite stations the athlete has already entered or placed.
- Degrade honestly: a file with no waypoints behaves exactly as it does today.
- Fix the `<name>` scoping bug and accept `<rte>`/`<rtept>` as a track fallback.

**Non-Goals**

- Cutoff times. `<desc>` frequently carries them and they belong in the plan, but they
  need their own model and UI. Out of scope; see §10.
- Drop-bag / crew-access flags. Same reasoning.
- TCX. The format has no waypoint concept worth mining here; `parseTcxPoints` is
  untouched.
- FIT support, Athlinks/Garmin ingestion. Separate work.
- Aid stations on *past* races. [`AddRaceForm.jsx`](../src/components/AddRaceForm.jsx) has
  no station model at all. Only the name-bug and `<rte>` fixes reach it.

## 3. What the files actually contain

A representative organizer export:

```xml
<gpx>
  <metadata><name>UTMB 2026 — Course</name></metadata>
  <wpt lat="45.9237" lon="6.8694">
    <name>Ravitaillement Les Houches</name>
    <desc>km 8.2 — eau, sucré, salé. Barrière horaire 19h30</desc>
    <sym>Restaurant</sym>
  </wpt>
  <wpt lat="45.8912" lon="6.7734">
    <name>Point d'eau Delevret</name>
    <sym>Drinking Water</sym>
  </wpt>
  <wpt lat="45.9012" lon="6.8231"><name>Parking navettes</name></wpt>
  <trk><name>UTMB 2026</name><trkseg><trkpt .../></trkseg></trk>
</gpx>
```

Three things to note, each of which drives a design decision below:

1. Waypoints carry position, not distance. The km mark has to be **derived by projecting
   onto the course**.
2. Not every waypoint is an aid station. Parking, the start village, viewpoints and photo
   spots all appear as `<wpt>`. Classification is required, and it will not be perfect.
3. Names and symbols are **multilingual**. French is a first-class case for trail racing
   and is already a planned locale ([`design-i18n.md`](design-i18n.md)), so the keyword
   sets ship EN + FR from day one.

## 4. Parsing

New export in [`src/utils/gpx.js`](../src/utils/gpx.js):

```js
export function parseWaypoints(xmlDoc)  // → RawWaypoint[]
```

Reads every `<wpt>`, producing:

```js
{ lat, lon, ele, name, desc, sym, type }
```

Empty-string defaults for the four text fields; `NaN` lat/lon filtered out. Order is
document order and is **preserved** — §5.2 relies on it.

### 4.1 Track-name scoping (bug fix)

Replace the two `getElementsByTagName("name")[0]` calls with a helper that reads, in
priority order:

1. `<metadata><name>`
2. the first `<trk>`'s direct `<name>` child
3. the first `<rte>`'s direct `<name>` child
4. filename minus extension

Direct-child lookup, not `getElementsByTagName`, so a `<name>` nested inside a waypoint
can never be picked up.

### 4.2 Route fallback

If `parseGpxPoints()` yields fewer than 2 points, fall back to `<rtept>` before throwing.
`<rtept>` has the same attribute and child shape as `<trkpt>`, so the existing mapper is
reused with a different tag name. Route points generally lack `<time>`, which the existing
`hasTime` path already handles.

## 5. Resolving a waypoint to a course kilometer

This is the substantive part.

### 5.1 Project against full-resolution points

Projection runs inside `parseRouteFile()` against the `points` array returned by
`pointsToCumulativeDistance()` — **before** `buildCoursePath()` simplification. The
simplified path is capped at 1500 points ([`gpx.js:91`](../src/utils/gpx.js#L91)) and RDP
deliberately drops points along straight runs, so projecting against it would quantize km
marks to whatever survived. On a 170 km course that is an error of hundreds of metres for
free; against full resolution it is metres.

For each waypoint, find the nearest point on the *polyline* — nearest **segment**, not
nearest vertex — and interpolate `cumKm` along that segment. Reuse the scaled degree-space
metric already established in `perpDistance()` ([`gpx.js:96`](../src/utils/gpx.js#L96));
the accuracy is more than adequate over a single course's extent, and it avoids a second
distance model in the same file.

Cost is O(waypoints × points). Course files carry tens of waypoints against tens of
thousands of points — a few million scalar operations, once, on import. No spatial index.

### 5.2 Snap tolerance and the out-and-back problem

Two failure modes, handled separately:

**Off-course waypoints.** Parking, hotels, the finish-line expo. Rejected by a hard
threshold: if the nearest approach exceeds **150 m**, the waypoint is not a course
feature. It is retained in the parse result but not offered as a station. 150 m is loose
enough to survive an organizer marking a station at the building rather than the road, and
tight enough to reject a car park.

**Ambiguous waypoints.** On a lollipop or out-and-back, one position sits near two
different kilometers, and the nearest-approach answer is a coin flip that can be off by
half the race. Rule:

1. If `<desc>` or `<name>` contains an explicit distance (`km 8.2`, `8.2 km`, `KM8`),
   **trust it** over geometry. Organizers state the intended distance and it disambiguates
   directly. Only accept it if it lands within tolerance of *some* near-approach, so a
   stray number can't invent a station.
2. Otherwise, if a second local minimum exists within 150 m and more than 2 km away in
   course distance, resolve by **monotonic ordering**: waypoints appear in course order in
   practice, so choose the candidate that keeps the sequence non-decreasing.
3. If ordering does not resolve it, take the global nearest and mark the station
   `ambiguous: true`.

Ambiguity is a UI concern, not a failure — the elevation profile already supports dragging
a station to a new km via `onMove` ([`RacePlanForm.jsx:530`](../src/components/RacePlanForm.jsx#L530)).
Flagged stations get a visual marker and a line in the import message telling the athlete
to check them.

## 6. Classification

`classifyWaypoint(wpt)` returns `{ isStation, water, food, confidence }`.

Matching is case- and accent-insensitive (`String.normalize("NFD")` with combining marks
stripped, so `ravitaillement` matches `Ravitaillement` and `refuge` matches `Refuge`)
across `name`, `desc`, `sym` and `type`.

| Class | Matches | Result |
|---|---|---|
| Full aid | `aid`, `aid station`, `ravito`, `ravitaillement`, `feed`, `feed zone`, `refreshment`, `checkpoint`, `check point`, `cp`, `base vie`, `refuge` | `water: true, food: true` |
| Water-only | `water`, `water only`, `eau`, `point d'eau`, `fontaine`, `spring`, `source` | `water: true, food: false` |
| Not a station | `parking`, `navette`, `shuttle`, `depart`, `start`, `arrivee`, `finish`, `hotel`, `gare`, `viewpoint`, `photo`, `summit`, `col`, `sommet` | excluded |

Notes on the edges:

- `cp` matches on **whole-token** boundaries only, so `CP3` and `CP 3` classify but
  `Alpcross` does not.
- Water-only is checked **before** full-aid, since `point d'eau` should not be promoted by
  a stray `ravito` elsewhere in a `<desc>`.
- Exclusions are checked first and win outright.
- `col` / `sommet` / `summit` are excluded because they are overwhelmingly terrain
  markers, and a col that *is* a station almost always says so.
- Anything matching nothing gets `isStation: false, confidence: "unknown"` and is
  surfaced as an opt-in row rather than dropped (§7.2). This is the escape hatch for
  organizers with idiosyncratic naming, and it means an unrecognized vocabulary costs the
  athlete a checkbox rather than the feature.

Classification is deliberately keyword-based, not model-based. It runs on import with no
network, and a wrong guess is one click to fix.

## 7. Integration

### 7.1 Parser output

`parseRouteFile()` gains one field, keeping every existing field unchanged:

```js
waypoints: [
  {
    name, desc, sym,
    km,                 // projected, 2dp — null when off-course
    distanceFromCourseM,
    isStation, water, food,
    confidence,         // "explicit" | "keyword" | "unknown"
    ambiguous,          // true when §5.2 rule 3 fired
  },
]
```

One array, not two, so the "unrecognized waypoints" UI has something to render. Callers
that ignore the field — notably `parseTrackFile` consumers — are unaffected.

### 7.2 Plan form

In `handleFileImport()` ([`RacePlanForm.jsx:202`](../src/components/RacePlanForm.jsx#L202)),
after `setGpxData(parsed)`:

- Build candidate stations from `waypoints.filter(w => w.isStation && w.km != null)`,
  mapped to the existing `{ id: uid(), km, name, water, food }` shape
  ([`:121`](../src/components/RacePlanForm.jsx#L121)) so nothing downstream changes.
- Pass them through `sanitizeAidStations()`
  ([`aidStations.js:14`](../src/utils/aidStations.js#L14)), which already handles
  range-clipping, dedup by km, sorting and default naming. No new validation code.
- **Apply automatically only when `aidStations.length === 0`.** If the athlete has already
  entered stations, do not touch them — surface a button instead (below). Import must never
  destroy typed input.

Import message extends the existing string:

> Loaded 171.5 km course with 10040m elevation gain. Found 11 aid stations in the file —
> review them in Section 6. 2 need a distance check.

Section 6's button row ([`:541`](../src/components/RacePlanForm.jsx#L541)) gains a third
button, shown only when the file had usable stations:

- `IMPORT 11 FROM FILE` — primary when stations were found and the list is non-empty
  (i.e. the auto-apply path was declined because the athlete had typed something).
  Replaces the current list, behind a confirm when that list is non-empty.
- `AUTO-SPACE` — unchanged, but demoted to the fallback it now is.

Ambiguous stations render with an accent border in the station table
([`:569`](../src/components/RacePlanForm.jsx#L569)) reusing the existing `outOfRange`
treatment, plus a title attribute explaining why.

Waypoints with `isStation: false` collapse into a disclosure row — *"6 other waypoints in
this file"* — listing name and km with a checkbox to promote each to a station. Off-course
waypoints (`km == null`) are listed but not promotable.

### 7.3 What does not change

`buildCarryPlan`, `buildPacingSections`, `CourseMap`, `ElevationProfile`, the plan schema
and storage all consume the same station shape they do today. This feature only changes
where the initial values come from.

## 8. Edge cases

| Case | Behavior |
|---|---|
| No `<wpt>` at all | Identical to today. No message change. |
| Waypoints, none classified | Import message notes *"11 waypoints found, none recognized as aid stations"*; all offered in the disclosure row. |
| All waypoints off-course | Same as above; km shown as `—`, not promotable. |
| Waypoint at km 0 or ≥ distance | Dropped by `sanitizeAidStations` — start and finish are already implicit points in `buildCarryPlan` ([`aidStations.js:147`](../src/utils/aidStations.js#L147)). |
| Two waypoints at the same km | Deduped by existing `sanitizeAidStations` logic; first wins. |
| Unnamed waypoint | `sanitizeAidStations` assigns `Aid N`. |
| 200+ waypoints (some Komoot exports) | Cap the promotable list at 50 by proximity; classification still runs on all. |
| Sport is cycling | No behavioral difference — feed zones classify on the same keywords. |
| Re-upload after editing stations | Confirm before replacing. |

## 9. Testing

`DOMParser` is browser-only, so `gpx.js` is not directly unit-testable under bare Node.
Two options; I'd take the first:

- Inject a parser: `parseRouteFile(file, sport, { parser })` defaulting to `new DOMParser()`,
  letting tests pass a `jsdom` instance. Small, contained, and makes the module testable
  as a whole rather than only through the browser harness.
- Otherwise, drive it through the existing Playwright harness
  ([`src/__harness.jsx`](../src/__harness.jsx), [`__shot.mjs`](../__shot.mjs)).

Fixtures to add under `src/__fixtures__/gpx/`:

1. **`utmb-style.gpx`** — waypoints before the track, no `<metadata><name>`. Asserts the
   §4.1 name fix and end-to-end classification.
2. **`out-and-back.gpx`** — one waypoint equidistant from two course kilometers, with
   `km 8.2` in `<desc>`. Asserts explicit-distance precedence.
3. **`out-and-back-nodesc.gpx`** — same geometry, no hint. Asserts monotonic ordering, then
   the `ambiguous` flag.
4. **`off-course.gpx`** — a parking waypoint 400 m away. Asserts `km: null`.
5. **`route-only.gpx`** — `<rte>`/`<rtept>`, no `<trk>`. Asserts §4.2.
6. **`french.gpx`** — `Ravitaillement`, `Point d'eau`, accented. Asserts normalization and
   water-only precedence.

Plus a projection accuracy check: place a synthetic waypoint exactly on a known track
point and assert the resolved km matches its `cumKm` to within 10 m.

## 10. Future work

- **Cutoff times.** `<desc>` carries them (`Barrière horaire 19h30`) on most trail course
  files. Extracting them would let the plan flag legs where the projected pace misses a
  barrier — arguably more valuable than the carry plan for long ultras, and the parse work
  here is the prerequisite.
- **Roadbook PDF parsing.** Most races that ship a waypoint-free GPX publish an aid-station
  table as a PDF. Routing it through the existing server-side Claude proxy
  ([`api/claude.js`](../api/claude.js)) would cover the remainder. The station shape this
  doc settles on is the target format.
- **`<extensions>`.** Some organizers put structured station metadata there. No common
  schema, so not worth chasing until a real file demands it.
