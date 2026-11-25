import { withGap } from "./utils/pace.js";

/* ---------------------------------------------------------
   Design tokens — "the endurance journal" (v3)
   Warm ivory, forest green as the brand colour, a deep
   charcoal-green for text, muted sage for quiet fills.
   See docs/design-visual-identity.md. Token *names* are
   unchanged from v1/v2 so every view re-skins for free.
     bg        app background (warm ivory)
     bg2       quiet inset surface (inputs, upload wells)
     surface   card / panel base (warm white)
     surfaceHi hover + elevated state
     line      hairline dividers — deliberately faint; use space first
     paper     primary text          ink  secondary   inkDim  captions
     brass     THE brand colour (forest) — CTAs, links, active states
     sage      muted accent fill (panels, inactive bars) — never text
     green     strength   ember  limiter   neutral  "mixed"

   CONTRAST RULE: every token used as *text* clears WCAG AA 4.5:1
   on bg, surface, surfaceHi and sageTint, and on its own 10% tint
   (pills). Audit, Nov 2026 (worst case in brackets):
     paper 12.3 · ink 7.8 · inkDim 4.9 (on sageTint) · brass 5.1
     (own tint) · ember 5.2 · neutral 5.0 · temp 4.8.
   White text on brass is 6.5:1. Re-run the audit if you touch
   these values, and run axe-core on every view.

   `brass` and `green` are deliberately the SAME forest green:
   the brand and the "strength" verdict are one idea. "mixed"
   therefore uses `neutral`, not the brand colour. --------- */

/* Two palettes sharing identical token *names* so components read `T`
   without caring about mode. `T` is the active theme; the app ships light
   only. "paper" = primary text, "bg" = app background in both. */

const LIGHT = {
  bg: "#F6F4ED",        // warm ivory
  bg2: "#FBF9F3",       // quiet inset (inputs, wells)
  surface: "#FFFDF8",   // warm white cards
  surfaceHi: "#EFEBE0", // hover / elevated
  paper: "#1E2923",     // primary text — deep charcoal-green
  ink: "#3D4840",       // secondary text
  inkDim: "#5C665F",    // captions
  line: "#E3DED0",      // hairline
  brass: "#176B50",     // forest — the brand colour
  brassDim: "#0F4D39",  // darker forest for borders / pressed states
  sage: "#8FA88F",      // muted accent — fills and inactive marks only
  sageTint: "#E4EADF",  // sage panel background
  green: "#176B50",     // strength — same as the brand, by design
  greenDim: "#CFE0D4",  // pale green, borders/tints only (never text)
  ember: "#A3392B",     // limiter / warning — earthy red
  emberDim: "#EBCBC3",  // pale red, borders/tints only (never text)
  neutral: "#58625B",   // "mixed" verdict
  temp: "#2A6A82",      // temperature series
};

const DARK = {
  bg: "#121814",
  bg2: "#18201B",
  surface: "#1A221D",
  surfaceHi: "#222C26",
  paper: "#EEF1EA",
  ink: "#BAC4BC",
  inkDim: "#9AA59D",
  line: "#2A352E",
  brass: "#5FC39A",
  brassDim: "#1D5A43",
  sage: "#6F866F",
  sageTint: "#1F2A22",
  green: "#5FC39A",
  greenDim: "#1E3A2D",
  ember: "#F08A7A",
  emberDim: "#3A211D",
  neutral: "#A9B3AB",
  temp: "#86C2D6",
};

export const THEMES = { light: LIGHT, dark: DARK };

// Active theme. Flip to THEMES.dark (or wire a toggle) for dark mode.
export const T = LIGHT;

/* ---------------------------------------------------------
   Course-visualisation scales (map + elevation profile)

   Two different colour *jobs*, so two different structures:

   - SEGMENT_RAMP is ORDINAL. Segments run S1→Sn along the
     course, so their order carries meaning; a one-hue ramp
     (light→dark in light mode, dark→light in dark mode) lets
     the reader see course progression in the colour itself,
     and unlike a fixed categorical palette it extends to a
     course with many aid stations without ever cycling.
   - GRADE_SCALE is DIVERGING. Gradient has a natural zero, so
     it takes two hues either side of a neutral grey midpoint:
     cool/blue for descent, warm/red for climb. Near the
     midpoint hue carries the sign; at the extremes lightness
     does. Never a rainbow.

   Both were validated (not eyeballed) against the surfaces
   they actually render on — white cards in light mode,
   #161C23 in dark: the ramp passes monotone-lightness,
   ΔL ≥ 0.06 step gaps, light-end ≥ 2:1; each diverging arm is
   monotone outward from the midpoint with every step ≥ 2:1.
   Re-run the dataviz validator if you touch these values.
   --------------------------------------------------------- */

const SEGMENT_RAMP_LIGHT = ["#55C0D1", "#2BA5B9", "#0C8E9F", "#0A7686", "#095E6C", "#074954"];
const SEGMENT_RAMP_DARK = ["#8FE4F2", "#63CFE1", "#3FB8CB", "#2C9BAE", "#22808F", "#1A6773"];

// Diverging gradient arms, listed mild → strong away from the neutral midpoint.
const GRADE_SCALE_LIGHT = {
  flat: "#AAB0B8",
  descent: ["#7FB0E8", "#3E86D8", "#1B5FA8"],
  climb: ["#EC9578", "#E1603F", "#B62F2C"],
};
const GRADE_SCALE_DARK = {
  flat: "#5A626C",
  descent: ["#3D7CC4", "#5E9AE2", "#A8CCF5"],
  climb: ["#CC4A40", "#E4744F", "#F3B49F"],
};

// Selected per mode alongside `T` — dark is its own set of steps for the dark
// surface, not an automatic flip of the light one.
export const SEGMENT_RAMP = T === LIGHT ? SEGMENT_RAMP_LIGHT : SEGMENT_RAMP_DARK;
export const GRADE_SCALE = T === LIGHT ? GRADE_SCALE_LIGHT : GRADE_SCALE_DARK;

// Radius scale for the rounded-card language
export const R = { sm: 6, md: 10, lg: 14, pill: 999 };

// Three separable hues for overlaid race series. `green` is omitted on purpose
// — it is the same value as `brass`, so using both would draw two identical lines.
export const COMPARE_COLORS = [T.paper, T.brass, T.temp];

// Editorial serif for headings, a clean sans for everything else. Data used to
// be set in a monospace face; it is now Inter with tabular numerals (set on
// <body> in App.jsx), so times and distances still align in columns.
// FONT_MONO stays as a name so the many data styles keep a single handle.
export const FONT_DISPLAY = "'Newsreader', Georgia, 'Times New Roman', serif";
export const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif";
export const FONT_MONO = FONT_BODY;

export const SPORTS = ["All", "Road Running", "Trail Running", "Road Cycling", "Gravel Cycling"];
export const SPORT_OPTIONS = SPORTS.filter((s) => s !== "All");
export const SURFACES = ["Road", "Singletrack", "Gravel", "Mixed", "Track"];

// True for "Road Cycling" / "Gravel Cycling"; false for the running sports.
export function isCyclingSport(sport) {
  return /cycling/i.test(sport || "");
}

// `headlineKey` indexes `seed.*` in the debrief catalog rather than carrying
// prose — these are demo data, but they are still user-visible sentences.
// Race *names* stay as they are: they are proper nouns.
//
// Each `verdict` must equal what the engine derives from the splits
// (deriveVerdict in src/utils/ratings.js) — a test holds this. The sample
// athlete is the first thing a visitor sees, and a label the engine itself
// disagrees with would undercut the "every number is computed" claim.
//
// Tunkhannock carries per-split elevation so it exercises grade-adjusted pace
// the way an uploaded trail file would; seedGap() adds gapPace/gradePct exactly
// as enrichRace() does for races entered in the app.
function seedGap(race) {
  return { ...race, usesGap: true, splits: withGap(race.splits, race.sport) };
}

export const SEED_RACES = [
  {
    id: "r1",
    name: "Brandywine Valley Marathon",
    sport: "Road Running",
    date: "2026-04-19",
    distanceKm: 42.2,
    elevationM: 310,
    surface: "Road",
    finishTime: "3:24:51",
    placement: 142,
    field: 1850,
    percentile: 92.3,
    tempC: 27,
    humidity: 71,
    wind: 14,
    rating: 1842,
    ratingDelta: -38,
    verdict: "limiter",
    headlineKey: "seed.r1",
    splits: [
      { km: 5, pace: 4.42, tempC: 18 },
      { km: 10, pace: 4.45, tempC: 19 },
      { km: 15, pace: 4.5, tempC: 21 },
      { km: 20, pace: 4.55, tempC: 23 },
      { km: 25, pace: 5.05, tempC: 25 },
      { km: 30, pace: 5.22, tempC: 26 },
      { km: 35, pace: 5.51, tempC: 27 },
      { km: 40, pace: 6.08, tempC: 27 },
      { km: 42.2, pace: 6.15, tempC: 27 },
    ],
    fueling: { carbsPerHr: 52, sodiumPerHr: 280, fluidsPerHr: 480, caffeine: 80 },
  },
  seedGap({
    id: "r2",
    name: "Tunkhannock Trail 50K",
    sport: "Trail Running",
    date: "2026-02-08",
    distanceKm: 50,
    elevationM: 1640,
    surface: "Singletrack",
    finishTime: "5:48:12",
    placement: 11,
    field: 210,
    percentile: 95.2,
    tempC: 6,
    humidity: 58,
    wind: 9,
    rating: 1910,
    ratingDelta: 64,
    verdict: "strength",
    headlineKey: "seed.r2",
    splits: [
      { km: 8, pace: 6.1, tempC: 4, elevM: 310 },
      { km: 16, pace: 6.4, tempC: 5, elevM: 400 },
      { km: 24, pace: 6.55, tempC: 6, elevM: 490 },
      { km: 32, pace: 7.05, tempC: 7, elevM: 710 },
      { km: 40, pace: 7.0, tempC: 7, elevM: 900 },
      { km: 50, pace: 7.1, tempC: 6, elevM: 1120 },
    ],
    fueling: { carbsPerHr: 78, sodiumPerHr: 540, fluidsPerHr: 620, caffeine: 120 },
  }),
  {
    id: "r3",
    name: "Hollow Road Gravel Classic",
    sport: "Gravel Cycling",
    date: "2025-11-02",
    distanceKm: 105,
    elevationM: 980,
    surface: "Gravel",
    finishTime: "3:51:09",
    placement: 28,
    field: 340,
    percentile: 91.8,
    tempC: 11,
    humidity: 64,
    wind: 22,
    rating: 1768,
    ratingDelta: 12,
    verdict: "mixed",
    headlineKey: "seed.r3",
    splits: [
      { km: 20, pace: 2.1, tempC: 9 },
      { km: 40, pace: 2.2, tempC: 10 },
      { km: 60, pace: 2.35, tempC: 11 },
      { km: 80, pace: 2.4, tempC: 12 },
      { km: 105, pace: 2.3, tempC: 11 },
    ],
    fueling: { carbsPerHr: 64, sodiumPerHr: 410, fluidsPerHr: 550, caffeine: 60 },
  },
  {
    id: "r4",
    name: "Lakefront 10K",
    sport: "Road Running",
    date: "2025-09-14",
    distanceKm: 10,
    elevationM: 35,
    surface: "Road",
    finishTime: "0:38:42",
    placement: 9,
    field: 640,
    percentile: 98.6,
    tempC: 14,
    humidity: 49,
    wind: 6,
    rating: 1830,
    ratingDelta: 22,
    verdict: "strength",
    headlineKey: "seed.r4",
    splits: [
      { km: 2.5, pace: 3.52, tempC: 13 },
      { km: 5, pace: 3.5, tempC: 13 },
      { km: 7.5, pace: 3.47, tempC: 14 },
      { km: 10, pace: 3.44, tempC: 14 },
    ],
    fueling: { carbsPerHr: 0, sodiumPerHr: 0, fluidsPerHr: 200, caffeine: 100 },
  },
];
