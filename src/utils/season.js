/*
  What the home page says about a season, computed — never written by a model.

  Every figure here comes from the races themselves or from the analysis
  engine; the page only chooses words for it. Pure, no React, unit-tested in
  src/__tests__/season.test.js.
*/
import { parseClockToMinutes } from "./time.js";
import { fuelingBenchmarks } from "./fueling.js";
import { gatherLimiterPatterns, buildDebrief } from "./analysis.js";

const byDateAsc = (a, b) => new Date(a.date) - new Date(b.date);

// Counts and totals for the season summary strip.
export function seasonSummary(races) {
  const list = races ?? [];
  const minutes = list.reduce((sum, r) => sum + (parseClockToMinutes(r.finishTime) || 0), 0);
  const years = list.map((r) => new Date(r.date).getFullYear()).filter(Number.isFinite);
  const first = Math.min(...years);
  const last = Math.max(...years);
  // The strongest race is the best RaceIQ score — the engine's own ranking.
  const strongest = list.length ? [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] : null;
  return {
    count: list.length,
    km: Math.round(list.reduce((sum, r) => sum + (r.distanceKm || 0), 0)),
    hours: Math.round(minutes / 60),
    strongest,
    // "2026", or "2025–26" across a year boundary.
    yearsLabel: !years.length ? "" : first === last ? String(first) : `${first}–${String(last).slice(-2)}`,
  };
}

/*
  The one pattern worth noting, or null.

  A pattern is stated only when it holds across at least two races AND covers
  at least half of the races it's about — the same rule the season card used
  before the redesign. One hot race that went badly is a race, not a pattern.
  Fueling outranks heat, and heat outranks the cool-weather strength, because
  a limiter the athlete controls is the most useful thing to point at.

  `bars` is the evidence chart: one bar per relevant race, oldest first, with
  `hit` marking the races the pattern is about.
*/
export function pickPattern(races) {
  const p = gatherLimiterPatterns(races ?? []);
  const holds = (n, total) => n >= 2 && n * 2 >= total;

  if (holds(p.underFueled.length, p.limiters.length)) {
    const hit = new Set(p.underFueled.map((r) => r.id));
    const longRaces = (races ?? []).filter((r) => fuelingBenchmarks(r.finishTime).needsCarbs && r.fueling?.carbsPerHr != null);
    return {
      key: "underFueled",
      count: p.underFueled.length,
      total: p.limiters.length,
      races: p.underFueled,
      unit: "pct",
      threshold: 100,
      bars: [...longRaces].sort(byDateAsc).map((r) => ({
        id: r.id,
        name: r.name,
        // Intake as a share of the low end of the race's own carbohydrate band.
        value: Math.round((r.fueling.carbsPerHr / fuelingBenchmarks(r.finishTime).carbsLow) * 100),
        hit: hit.has(r.id),
      })),
    };
  }

  const tempBars = (hitList) => {
    const hit = new Set(hitList.map((r) => r.id));
    return [...(races ?? [])].filter((r) => r.tempC != null).sort(byDateAsc)
      .map((r) => ({ id: r.id, name: r.name, value: r.tempC, hit: hit.has(r.id) }));
  };

  if (holds(p.hotLimiters.length, p.limiters.length)) {
    return { key: "hotLimiters", count: p.hotLimiters.length, total: p.limiters.length, races: p.hotLimiters, unit: "c", threshold: 24, bars: tempBars(p.hotLimiters) };
  }
  if (holds(p.coolStrengths.length, p.strengths.length)) {
    return { key: "coolStrengths", count: p.coolStrengths.length, total: p.strengths.length, races: p.coolStrengths, unit: "c", threshold: 14, bars: tempBars(p.coolStrengths) };
  }
  return null;
}

// A word for race-day conditions, from temperature and humidity alone. It
// labels the number shown beside it; it never replaces it.
export function conditionsKey(tempC, humidity) {
  if (tempC == null || Number.isNaN(Number(tempC))) return null;
  const t = Number(tempC);
  const band = t <= 5 ? "cold" : t <= 15 ? "cool" : t <= 20 ? "mild" : t <= 25 ? "warm" : "hot";
  const humid = humidity != null && humidity >= 70 && t >= 21;
  return humid ? `${band}Humid` : band;
}

/*
  The single insight a race card shows. Returns a description, not prose:
    strength / mixed → the verdict in words, plus the race's own headline
    limiter          → the engine's top limiting finding, plus its first
                       recommendation as the "what to do"
  The caller renders it with the i18n helpers, so nothing here is English.
*/
export function raceInsight(race) {
  const tone = race.verdict === "strength" ? "strength" : race.verdict === "limiter" ? "limiter" : "mixed";
  const { limiters, recs } = buildDebrief(race);
  return {
    tone,
    topLimiter: tone === "limiter" ? limiters[0] ?? null : null,
    firstRec: tone === "limiter" ? recs[0] ?? null : null,
  };
}
