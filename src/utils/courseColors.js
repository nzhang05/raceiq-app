// Colour lookups shared by the course map and the elevation profile, so a
// segment is the same colour in both places (and in the pacing table legend).
//
// See constants.js for why segments take an ordinal ramp and gradient takes a
// diverging scale, and for the validation the two scales had to pass.

import { SEGMENT_RAMP, GRADE_SCALE } from "../constants.js";
import { sanitizeAidStations } from "./aidStations.js";

// Colour for segment `index` of `total`, spread across the whole ramp so a
// 2-segment course uses the light and dark ends rather than two neighbouring
// steps. Courses with more segments than ramp steps reuse steps at the same
// spacing — segment identity is still carried by the S-number label and the
// station marker between them, never by hue alone.
export function segmentColor(index, total) {
  const n = SEGMENT_RAMP.length;
  if (total <= 1) return SEGMENT_RAMP[Math.floor(n / 2)];
  const t = index / (total - 1); // 0..1 across the course
  return SEGMENT_RAMP[Math.min(n - 1, Math.round(t * (n - 1)))];
}

// The user's segments: aid stations cut the course into S1…Sn, exactly the way
// ElevationProfile and buildPacingSections already slice it. One source of truth
// so a segment is the same span, name and colour on the map, on the profile and
// in the pacing table.
export function buildSegments(distanceKm, stations) {
  if (!distanceKm || distanceKm <= 0) return [];
  const clean = sanitizeAidStations(stations, distanceKm);
  const bounds = [0, ...clean.map((s) => s.km), distanceKm];
  const names = ["Start", ...clean.map((s) => s.name), "Finish"];
  const total = bounds.length - 1;

  return Array.from({ length: total }, (_, i) => ({
    index: i,
    label: `S${i + 1}`,
    fromKm: bounds[i],
    toKm: bounds[i + 1],
    fromName: names[i],
    toName: names[i + 1],
    color: segmentColor(i, total),
  }));
}

// Gradient bins, mild → strong per arm. `max` is the exclusive upper bound of
// the bin in percent grade; the last climb bin catches everything above.
export const GRADE_BINS = [
  { max: -10, label: "Steep descent", arm: "descent", step: 2 },
  { max: -5, label: "Descent", arm: "descent", step: 1 },
  { max: -2, label: "Easy descent", arm: "descent", step: 0 },
  { max: 2, label: "Flat", arm: "flat", step: null },
  { max: 5, label: "Easy climb", arm: "climb", step: 0 },
  { max: 10, label: "Climb", arm: "climb", step: 1 },
  { max: Infinity, label: "Steep climb", arm: "climb", step: 2 },
];

function binColor(bin) {
  return bin.arm === "flat" ? GRADE_SCALE.flat : GRADE_SCALE[bin.arm][bin.step];
}

// Bin a percent grade, then colour it. Bins (rather than a continuous
// interpolation) keep the profile readable and line up with the CLIMB / FLAT /
// DESCENT language the pacing plan already uses.
export function gradeBin(gradePct) {
  const g = Number(gradePct) || 0;
  return GRADE_BINS.find((b) => g < b.max) ?? GRADE_BINS[GRADE_BINS.length - 1];
}

export function gradeColor(gradePct) {
  return binColor(gradeBin(gradePct));
}

// Legend rows for the gradient scale, ordered descent → climb.
export const GRADE_LEGEND = GRADE_BINS.map((b) => ({ label: b.label, color: binColor(b) }));
