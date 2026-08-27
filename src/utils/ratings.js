import { T } from "../constants.js";
import { hasElevationData, sportUsesGap, withGap } from "./pace.js";
import { rollUpSections } from "./fuelingSections.js";

export function derivePercentile(placement, field) {
  if (!placement || !field || field <= 0) return null;
  const pct = (1 - (placement - 1) / field) * 100;
  return Math.round(pct * 10) / 10;
}

export function deriveRating(percentile, distanceKm) {
  if (percentile == null) return 1500;
  const base = 1000 + percentile * 9;
  const distanceBonus = Math.min(distanceKm, 100) * 1.5;
  return Math.round(Math.min(3000, Math.max(1000, base + distanceBonus)));
}

// Robust, whole-series read of a split set. Every downstream verdict and
// narrative claim should come from these numbers rather than from the first
// and last split alone (which is hostage to one noisy km).
export function analyzeSplits(splits, sport) {
  if (!splits || splits.length < 2) return null;
  const useGap = hasElevationData(splits) && sportUsesGap(sport);
  const series = useGap ? withGap(splits, sport) : splits;
  const key = useGap ? "gapPace" : "pace";
  const paces = series.map((s) => s[key]).filter((p) => p != null && isFinite(p));
  const n = paces.length;
  if (n < 2) return null;

  const mean = paces.reduce((a, b) => a + b, 0) / n;

  // Full-series drift: least-squares slope of pace vs split index, expressed
  // as the fitted first→last fractional change. Uses every split, so a single
  // fast opening or sprint finish no longer flips the read.
  const xMean = (n - 1) / 2;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (paces[i] - mean);
    den += (i - xMean) ** 2;
  }
  const slope = den ? num / den : 0;
  const driftPct = mean ? (slope * (n - 1)) / mean * 100 : 0;

  // Second-half fade: last third vs first third of the race.
  const third = Math.max(1, Math.floor(n / 3));
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const firstAvg = avg(paces.slice(0, third));
  const lastAvg = avg(paces.slice(n - third));
  const fadePct = firstAvg ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;

  // Evenness: coefficient of variation across all splits.
  const variance = paces.reduce((a, p) => a + (p - mean) ** 2, 0) / n;
  const cvPct = mean ? (Math.sqrt(variance) / mean) * 100 : 0;

  return { paceKey: key, useGap, n, mean, firstAvg, lastAvg, driftPct, fadePct, cvPct };
}

export function deriveVerdict(splits, tempC, sport) {
  const m = analyzeSplits(splits, sport);
  if (!m) return "mixed";

  // Blend the robust full-series drift with the half-to-half fade so neither
  // a single metric nor a single split decides the verdict.
  const drift = 0.5 * m.driftPct + 0.5 * m.fadePct;
  const hot = tempC >= 24;
  const limiterCut = hot ? 7 : 12;

  if (drift < 4 && m.cvPct < 8) return "strength";
  if (drift > limiterCut) return "limiter";
  return "mixed";
}

// Returns a key into the `debrief` catalog rather than prose — see
// src/i18n/en/debrief.js (headline.*) and headlineText() in src/i18n/render.js.
export function deriveHeadline(verdict, race) {
  if (verdict === "strength") {
    return race.tempC <= 14 ? "headline.strengthCool" : "headline.strengthWarm";
  }
  if (verdict === "limiter") {
    return race.tempC >= 24 ? "headline.limiterHot" : "headline.limiterCool";
  }
  return "headline.mixed";
}

export function enrichRace(raw) {
  const percentile = derivePercentile(raw.placement, raw.field);
  const usesGap = hasElevationData(raw.splits) && sportUsesGap(raw.sport);
  const splits = usesGap ? withGap(raw.splits, raw.sport) : raw.splits;
  const verdict = deriveVerdict(raw.splits, raw.tempC, raw.sport);
  const rating = deriveRating(percentile, raw.distanceKm);
  const headlineKey = deriveHeadline(verdict, raw);

  // When fuelling was logged by section, roll it up into the four scalar fields
  // so every existing consumer keeps reading fueling.carbsPerHr et al. unchanged.
  let fueling = raw.fueling;
  if (fueling?.inputMode === "sections" && fueling.sections?.length) {
    fueling = { ...fueling, ...rollUpSections(fueling.sections, raw.splits) };
  }

  return {
    ...raw,
    splits,
    usesGap,
    fueling,
    percentile: percentile ?? 50,
    verdict,
    rating,
    ratingDelta: 0,
    headlineKey,
  };
}

export function verdictColor(v) {
  if (v === "strength") return T.green;
  if (v === "limiter") return T.ember;
  // "mixed" is neutral, not the accent — the accent is the same green as
  // "strength", so reusing it here would make the two verdicts look alike.
  return T.neutral;
}

// The display label lives in the `common` catalog (verdict.*) — components read
// it with t(`verdict.${race.verdict}`). This normalises anything unexpected so
// a bad value can't produce a missing-key placeholder.
export function verdictKey(v) {
  return v === "strength" || v === "limiter" ? v : "mixed";
}
