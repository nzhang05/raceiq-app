/* ---------------------------------------------------------
   Design tokens — "modern sport-tech" (v2)
   Cooler neutral-slate dark surfaces, soft depth, a single
   vivid accent (teal). Token *names* are unchanged
   from v1 so every view re-skins for free; only values moved.
     bg        app background (deepest)
     surface   card / panel base
     surfaceHi elevated + hover state
     line      hairline dividers
     paper     primary text (near-white)
     ink       secondary text
     inkDim    tertiary / captions
     brass     THE accent — CTAs, scores, active states, "mixed"
     green     strength   ember  limiter
   --------------------------------------------------------- */

/* Two palettes sharing identical token *names* so components read `T`
   without caring about mode. `T` is the active theme; a future dark-mode
   toggle swaps which object `T` points at (see project-design-system memo
   — a runtime toggle will need CSS-variable/context theming since imports
   are static). "paper" = primary text, "bg" = app background in both. */

const LIGHT = {
  bg: "#F4F6F8",       // app background (cool light gray)
  bg2: "#FFFFFF",      // legacy alias — base card surface
  surface: "#FFFFFF",
  surfaceHi: "#EDF0F4", // elevated + hover
  paper: "#151A21",    // primary text (near-black)
  ink: "#525A64",      // secondary text
  inkDim: "#8B939D",   // tertiary / captions
  line: "#E3E7EC",     // hairline dividers
  brass: "#0E8C9E",    // vivid teal accent (deepened for contrast on white)
  brassDim: "#0A6675",
  green: "#0E9E6E",
  greenDim: "#BFE6D5",
  ember: "#E24955",
  emberDim: "#F3C2C4",
  temp: "#3E90AA",
};

const DARK = {
  bg: "#0E1217",
  bg2: "#161C23",
  surface: "#161C23",
  surfaceHi: "#1E262F",
  paper: "#F2F5F8",
  ink: "#AAB4C0",
  inkDim: "#6B7580",
  line: "#242C35",
  brass: "#35C2D6",
  brassDim: "#14545F",
  green: "#33D69A",
  greenDim: "#16332B",
  ember: "#F0555C",
  emberDim: "#331B20",
  temp: "#6FB6CC",
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
export const R = { sm: 8, md: 12, lg: 16, pill: 999 };

export const COMPARE_COLORS = [T.paper, T.green, T.brass];

export const FONT_DISPLAY = "'Space Grotesk', 'Inter', system-ui, sans-serif";
export const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif";
export const FONT_MONO = "'IBM Plex Mono', 'SFMono-Regular', monospace";

export const SPORTS = ["All", "Road Running", "Trail Running", "Road Cycling", "Gravel Cycling"];
export const SPORT_OPTIONS = SPORTS.filter((s) => s !== "All");
export const SURFACES = ["Road", "Singletrack", "Gravel", "Mixed", "Track"];

// True for "Road Cycling" / "Gravel Cycling"; false for the running sports.
export function isCyclingSport(sport) {
  return /cycling/i.test(sport || "");
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
    headline: "Heat and a fast first half cost you the back nine.",
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
  {
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
    headline: "Even effort on the climbs delivered your best ultra to date.",
    splits: [
      { km: 8, pace: 6.1, tempC: 4 },
      { km: 16, pace: 6.4, tempC: 5 },
      { km: 24, pace: 6.55, tempC: 6 },
      { km: 32, pace: 7.05, tempC: 7 },
      { km: 40, pace: 7.0, tempC: 7 },
      { km: 50, pace: 7.1, tempC: 6 },
    ],
    fueling: { carbsPerHr: 78, sodiumPerHr: 540, fluidsPerHr: 620, caffeine: 120 },
  },
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
    headline: "Strong legs, but headwind sectors leaked more time than fueling did.",
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
    headline: "Negative split in cool conditions — your fitness is ahead of your race calendar.",
    splits: [
      { km: 2.5, pace: 3.52, tempC: 13 },
      { km: 5, pace: 3.5, tempC: 13 },
      { km: 7.5, pace: 3.47, tempC: 14 },
      { km: 10, pace: 3.44, tempC: 14 },
    ],
    fueling: { carbsPerHr: 0, sodiumPerHr: 0, fluidsPerHr: 200, caffeine: 100 },
  },
];
