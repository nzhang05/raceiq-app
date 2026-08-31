import { parseClockToMinutes } from "./time.js";
import { fmtPace, paceDriftPct } from "./pace.js";
import { fuelingBenchmarks } from "./fueling.js";
import { analyzeSplits } from "./ratings.js";

// Interpolation values shared by every fuelling sentence. `rationale` is a
// deferred key reference rather than prose — see resolveValues() in
// src/i18n/render.js — which keeps this module free of catalog text.
function fuelValues(fuel) {
  return {
    carbsLow: fuel.carbsLow,
    carbsHigh: fuel.carbsHigh,
    rationale: { $key: `plan:${fuel.rationaleKey}` },
  };
}

// Every finding and recommendation below is derived from this race's own
// numbers. If a fact can't be computed from the splits, weather, or fueling
// on the race object, it isn't asserted — no season comparisons or sector
// claims are fabricated.
//
// Findings and recommendations are returned as { key, values, context? } rather
// than as prose: this module stays pure and language-free, and the sentence
// templates live in src/i18n/*/debrief.js where a translator can reorder them.
// Render with findingText() / recText() from src/i18n/render.js.
export function buildDebrief(race) {
  const strengths = [];
  const limiters = [];
  const recs = [];
  const fuel = fuelingBenchmarks(race.finishTime);
  const durationMin = Math.round(parseClockToMinutes(race.finishTime));
  const m = analyzeSplits(race.splits, race.sport);

  // ---- Pacing, read from the whole split series ----
  if (m) {
    const firstPace = fmtPace(m.firstAvg);
    const lastPace = fmtPace(m.lastAvg);
    const fade = Math.round(m.fadePct);
    const cv = Math.round(m.cvPct * 10) / 10;
    // `gap` selects the *_gap sentence variants, which carry the
    // "grade-adjusted" qualifier inline rather than spliced after the pace.
    const context = m.useGap ? "gap" : undefined;
    const values = { firstPace, lastPace, fade, cv };

    if (m.fadePct <= 4 && m.cvPct < 6) {
      strengths.push({ key: "pacing.even", values, context });
    } else if (m.fadePct > 8) {
      limiters.push({ key: "pacing.faded", values, context });
    } else if (m.fadePct > 4) {
      limiters.push({ key: "pacing.drift", values, context });
    } else {
      strengths.push({ key: "pacing.steady", values, context });
    }
  }

  // ---- Heat, only when the splits actually carry temperature ----
  const splitTemps = (race.splits || []).map((s) => s.tempC).filter((t) => t != null);
  if (splitTemps.length >= 2 && m) {
    const tmin = Math.min(...splitTemps);
    const tmax = Math.max(...splitTemps);
    const rose = Math.round(tmax - tmin);
    if (tmax >= 24 && rose >= 3 && m.fadePct > 8) {
      limiters.push({ key: "heat.tracked", values: { tmin, tmax, rose } });
      recs.push({ key: "rec.heatPlan", values: { tmax } });
    } else if (tmax <= 14 && m.fadePct <= 4) {
      strengths.push({ key: "heat.cool", values: { tmin, tmax } });
    }
  }

  // ---- Fueling ----
  // When fuelling was logged by section, correlate a low-carb section with a pace
  // fade *in that same section* — a located, causal story. Otherwise fall back to
  // the whole-race benchmark finding.
  const fuelSections = race.fueling?.inputMode === "sections" ? race.fueling.sections : null;
  if (fuelSections?.length && fuel.needsCarbs) {
    addSectionFuelingFindings(race, fuelSections, fuel, m, durationMin, { strengths, limiters, recs });
  } else if (fuel.needsCarbs && race.fueling?.carbsPerHr != null) {
    const taken = race.fueling.carbsPerHr;
    if (taken < fuel.carbsLow) {
      const gap = fuel.carbsLow - taken;
      const values = { taken, gap, durationMin, ...fuelValues(fuel) };
      limiters.push({ key: "fuel.light", values });
      recs.push({ key: "rec.raiseCarbs", values });
    } else if (!m || m.fadePct <= 4) {
      strengths.push({ key: "fuel.matched", values: { taken, ...fuelValues(fuel) } });
    }
  }

  if (race.usesGap) {
    const climbs = race.splits.filter((s) => s.gradePct > 3);
    const descents = race.splits.filter((s) => s.gradePct < -3);
    if (climbs.length) {
      const avgClimbGrade = climbs.reduce((a, s) => a + s.gradePct, 0) / climbs.length;
      const climbGapAvg = climbs.reduce((a, s) => a + s.gapPace, 0) / climbs.length;
      const flatSplits = race.splits.filter((s) => Math.abs(s.gradePct) <= 3);
      const flatGapAvg = flatSplits.length
        ? flatSplits.reduce((a, s) => a + s.gapPace, 0) / flatSplits.length
        : climbGapAvg;
      const climbVsFlat = ((climbGapAvg - flatGapAvg) / flatGapAvg) * 100;
      // The "matched" sentence quotes the gap as a magnitude, the "costly" one
      // as a signed slowdown — hence abs() on one side only.
      if (climbVsFlat < 8) {
        strengths.push({ key: "climb.matched", values: { grade: avgClimbGrade, deltaPct: Math.abs(climbVsFlat) } });
      } else {
        limiters.push({ key: "climb.costly", values: { grade: avgClimbGrade, deltaPct: climbVsFlat } });
      }
    }
    if (descents.length) {
      const avgDescentGrade = descents.reduce((a, s) => a + s.gradePct, 0) / descents.length;
      const rawDescentPace = descents.reduce((a, s) => a + s.pace, 0) / descents.length;
      const gapDescentPace = descents.reduce((a, s) => a + s.gapPace, 0) / descents.length;
      const recovered = ((gapDescentPace - rawDescentPace) / gapDescentPace) * 100;
      strengths.push({
        key: "descent.efficient",
        values: { grade: avgDescentGrade, recovered: Math.abs(recovered) },
      });
    }
    if (climbs.length) {
      recs.push({ key: "rec.climbIntervals", values: { grade: climbs[0].gradePct } });
    }
  }

  // ---- A closing pacing rec, only when the data shows a real positive split ----
  // The de-dupe used to regex the English action text; it now matches on key.
  if (m && m.fadePct > 8 && !recs.some((r) => r.key === "rec.openEasier")) {
    recs.push({ key: "rec.openEasier", values: { fade: Math.round(m.fadePct) } });
  }

  return { strengths, limiters, recs };
}

/*
  The debrief renders findings as a fixed row of three cards, so the count is a
  layout contract. Claude's schema enforces exactly three on its side
  (NARRATIVE_SCHEMA in api/_lib/prompts.js); this holds the same guarantee for
  every other path — the rule-engine output that paints first, the fallback when
  the request fails, and the signed-out case where no request is made at all.

  buildDebrief() legitimately returns anywhere from zero to about six findings:
  the pacing branch needs analyzeSplits() to return non-null, heat needs split
  temperatures in a narrow band, fueling needs a duration long enough to matter.
  A hand-entered race with no splits produces none.

  Padding is deliberately NOT a fabricated finding. A short list is filled with
  `kind: "context"` entries that state which analysis could not run and why,
  chosen from what is actually missing on this race. Same { key, values } shape
  as everything else here, so findingText() renders them without a special case.
*/
export function toThreeFindings(strengths, limiters, race) {
  // Limiters lead: they are the actionable half, and the engine has no ranking
  // of its own, so alternating keeps a race from opening with three strengths.
  const l = limiters.map((f) => ({ ...f, kind: "limiter" }));
  const s = strengths.map((f) => ({ ...f, kind: "strength" }));
  const out = [];
  for (let i = 0; i < Math.max(l.length, s.length); i++) {
    if (l[i]) out.push(l[i]);
    if (s[i]) out.push(s[i]);
  }
  if (out.length >= 3) return out.slice(0, 3);

  const splits = race?.splits ?? [];
  const pool = [];
  if (splits.length < 3) pool.push({ key: "context.noSplits" });
  if (!splits.some((sp) => sp.elevM != null) && !race?.usesGap) pool.push({ key: "context.noElevation" });
  if (race?.fueling?.carbsPerHr == null) pool.push({ key: "context.noFueling" });
  pool.push({ key: "context.thinData" });

  let i = 0;
  while (out.length < 3) {
    const pick = pool[i++] ?? { key: "context.thinData" };
    out.push({ ...pick, kind: "context" });
  }
  return out;
}

// Per-section fuelling findings: line up a below-range carb section with a pace
// fade in the same km range (located limiter), reward an even, well-fuelled close
// (located strength), and flag a section where temperature rose but fluid intake
// dropped (dehydration timing). All numbers come from this race's own sections.
function addSectionFuelingFindings(race, sections, fuel, m, durationMin, out) {
  const key = m?.paceKey ?? (race.splits?.[0]?.gapPace != null ? "gapPace" : "pace");
  const inRange = (sec) => (race.splits || []).filter((s) => s.km > sec.fromKm + 1e-9 && s.km <= sec.toKm + 1e-9);

  const summaries = sections.map((sec) => {
    const sp = inRange(sec);
    const paces = sp.map((s) => s[key]).filter((p) => p != null && isFinite(p));
    const temps = sp.map((s) => s.tempC).filter((t) => t != null);
    const firstPace = paces[0] ?? null;
    const lastPace = paces[paces.length - 1] ?? null;
    const driftPct = firstPace ? ((lastPace - firstPace) / firstPace) * 100 : 0;
    const avgTemp = temps.length ? temps.reduce((a, t) => a + t, 0) / temps.length : null;
    return { sec, firstPace, lastPace, driftPct, avgTemp, carbRate: sec.carbsPerHr ?? 0, fluidRate: sec.fluidsPerHr ?? 0 };
  });

  // Located limiter: the biggest-faded under-fuelled section.
  const faded = summaries
    .filter((x) => x.firstPace != null && x.lastPace != null && x.carbRate < fuel.carbsLow && x.driftPct > 8)
    .sort((a, b) => b.driftPct - a.driftPct);

  if (faded.length) {
    const x = faded[0];
    const gap = fuel.carbsLow - x.carbRate;
    const values = {
      fromKm: x.sec.fromKm, toKm: x.sec.toKm, carbRate: x.carbRate, gap, durationMin,
      ...fuelValues(fuel),
      firstPace: fmtPace(x.firstPace), lastPace: fmtPace(x.lastPace),
    };
    out.limiters.push({ key: "section.fuelDropped", values });
    out.recs.push({ key: "rec.holdCarbs", values });
  } else {
    // Located strength: closing section fuelled in range and held.
    const closing = summaries[summaries.length - 1];
    if (closing && closing.firstPace != null && closing.carbRate >= fuel.carbsLow && closing.driftPct <= 4) {
      out.strengths.push({
        key: "section.fuelledClose",
        values: {
          fromKm: closing.sec.fromKm, toKm: closing.sec.toKm, carbRate: closing.carbRate,
          ...fuelValues(fuel), lastPace: fmtPace(closing.lastPace),
        },
      });
    }
  }

  // Heat × fluid timing: a later, hotter section with a lower fluid rate.
  for (let i = 1; i < summaries.length; i++) {
    const prev = summaries[i - 1];
    const cur = summaries[i];
    if (prev.avgTemp != null && cur.avgTemp != null && cur.avgTemp - prev.avgTemp >= 2 && cur.avgTemp >= 22 && cur.fluidRate < prev.fluidRate) {
      out.limiters.push({
        key: "section.fluidFell",
        values: {
          fromKm: cur.sec.fromKm, toKm: cur.sec.toKm,
          curTemp: Math.round(cur.avgTemp), prevTemp: Math.round(prev.avgTemp),
          curFluid: cur.fluidRate, prevFluid: prev.fluidRate,
        },
      });
      break;
    }
  }
}

export function gatherDiagnosticData(race) {
  // Races entered by hand may carry no splits and no fueling log, so every read
  // below is guarded — this runs server-side for the coach, where a throw is a
  // 500 rather than a blank panel.
  const splits = race.splits ?? [];
  const key = splits[0]?.gapPace != null ? "gapPace" : "pace";
  const drift = paceDriftPct(splits);
  const fuel = fuelingBenchmarks(race.finishTime);
  const durationMin = Math.round(parseClockToMinutes(race.finishTime));
  const hot = race.tempC >= 24;
  const carbsTaken = race.fueling?.carbsPerHr;
  const fuelingGap = fuel.needsCarbs && carbsTaken != null ? carbsTaken - fuel.carbsLow : null;
  const { strengths, limiters, recs } = buildDebrief(race);

  let turnKm = null;
  let maxJump = -Infinity;
  for (let i = 1; i < splits.length; i++) {
    const jump = splits[i][key] - splits[i - 1][key];
    if (jump > maxJump) { maxJump = jump; turnKm = splits[i].km; }
  }

  return {
    race, durationMin, drift, hot, fuelingGap, fuelRange: fuel.carbsLabel, fuelLow: fuel.carbsLow,
    needsCarbs: fuel.needsCarbs, turnKm,
    firstPace: splits.length ? fmtPace(splits[0][key]) : "—",
    lastPace: splits.length ? fmtPace(splits[splits.length - 1][key]) : "—",
    strengths, limiters, recs,
  };
}

export function gatherTrendData(races, sportFilter) {
  let filtered = [...races].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sportFilter) {
    const sf = sportFilter.toLowerCase();
    filtered = filtered.filter(r => {
      if (sf.includes("trail")) return r.sport === "Trail Running";
      if (sf.includes("marathon")) return r.sport === "Road Running" && r.distanceKm >= 40;
      if (sf.includes("gravel") || sf.includes("cycling")) return r.sport.includes("Cycling");
      if (sf.includes("road")) return r.sport === "Road Running";
      return true;
    });
  }
  if (filtered.length < 2) return { filtered, insufficient: true };

  const ratings = filtered.map(r => r.rating);
  const percentiles = filtered.map(r => r.percentile);
  const verdicts = filtered.map(r => r.verdict);

  return {
    filtered, insufficient: false,
    ratingTrend: Math.round(ratings[ratings.length - 1] - ratings[0]),
    percentileTrend: Math.round((percentiles[percentiles.length - 1] - percentiles[0]) * 10) / 10,
    firstRating: ratings[0], lastRating: ratings[ratings.length - 1],
    firstPct: percentiles[0], lastPct: percentiles[percentiles.length - 1],
    strengthCount: verdicts.filter(v => v === "strength").length,
    limiterCount: verdicts.filter(v => v === "limiter").length,
  };
}

export function gatherFitData(races) {
  if (races.length < 2) return { insufficient: true };
  const byVerdict = { strength: [], limiter: [], mixed: [] };
  for (const r of races) byVerdict[r.verdict].push(r);

  const avgTemp = (arr) => arr.length ? Math.round(arr.reduce((a, r) => a + r.tempC, 0) / arr.length * 10) / 10 : null;
  const sportVerdicts = {};
  for (const r of races) {
    if (!sportVerdicts[r.sport]) sportVerdicts[r.sport] = { strength: 0, limiter: 0, mixed: 0, count: 0 };
    sportVerdicts[r.sport][r.verdict]++;
    sportVerdicts[r.sport].count++;
  }

  return {
    insufficient: false,
    byVerdict, sportVerdicts, races,
    avgStrengthTemp: avgTemp(byVerdict.strength),
    avgLimiterTemp: avgTemp(byVerdict.limiter),
    topRaces: [...races].sort((a, b) => b.percentile - a.percentile).slice(0, 3),
  };
}

export function gatherLimiterPatterns(races) {
  const limiters = races.filter(r => r.verdict === "limiter");
  const strengths = races.filter(r => r.verdict === "strength");
  return {
    races, limiters, strengths,
    hotLimiters: limiters.filter(r => r.tempC >= 24),
    underFueled: limiters.filter(r => {
      const fuel = fuelingBenchmarks(r.finishTime);
      return fuel.needsCarbs && r.fueling?.carbsPerHr != null && r.fueling.carbsPerHr < fuel.carbsLow;
    }),
    coolStrengths: strengths.filter(r => r.tempC <= 14),
  };
}
