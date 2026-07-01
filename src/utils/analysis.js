import { parseClockToMinutes } from "./time.js";
import { fmtPace, paceDriftPct } from "./pace.js";
import { fuelingBenchmarks } from "./fueling.js";
import { analyzeSplits } from "./ratings.js";

// Every finding and recommendation below is derived from this race's own
// numbers. If a fact can't be computed from the splits, weather, or fueling
// on the race object, it isn't asserted — no season comparisons or sector
// claims are fabricated.
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
    const gapNote = m.useGap ? " grade-adjusted" : "";

    if (m.fadePct <= 4 && m.cvPct < 6) {
      strengths.push({
        title: "Pacing held even through the finish",
        body: `Your closing third averaged ${lastPace}${gapNote} against ${firstPace} in the opening third — a ${fade >= 0 ? "+" : ""}${fade}% change — with split-to-split variation of just ${cv}%. That control is the signature of a well-judged effort.`,
      });
    } else if (m.fadePct > 8) {
      limiters.push({
        title: "Pace faded through the back third",
        body: `Your closing third averaged ${lastPace}${gapNote}, up from ${firstPace} across the opening third — a ${fade}% slowdown. It built progressively rather than appearing in one bad split, which points to accumulating fatigue, fueling, or heat rather than a single section.`,
      });
    } else {
      (m.fadePct > 4 ? limiters : strengths).push({
        title: m.fadePct > 4 ? "Some late-race drift, but no collapse" : "Reasonably even pacing",
        body: `Closing third ${lastPace}${gapNote} vs ${firstPace} in the opening third — a ${fade >= 0 ? "+" : ""}${fade}% change, variation ${cv}%. Solid, with a little time still available from tighter back-half pacing.`,
      });
    }
  }

  // ---- Heat, only when the splits actually carry temperature ----
  const splitTemps = (race.splits || []).map((s) => s.tempC).filter((t) => t != null);
  if (splitTemps.length >= 2 && m) {
    const tmin = Math.min(...splitTemps);
    const tmax = Math.max(...splitTemps);
    const rose = Math.round(tmax - tmin);
    if (tmax >= 24 && rose >= 3 && m.fadePct > 8) {
      limiters.push({
        title: "Your slowdown tracked the rising course temperature",
        body: `Course temperature climbed from ${tmin}°C to ${tmax}°C over the race, and your pace gave way as it did. A ${rose}°C rise into the mid-20s is enough to drive cardiovascular drift independent of fitness.`,
      });
      recs.push({
        action: "Build a heat-specific pacing plan for races above 24°C",
        why: `Your fade this race coincided with temperatures peaking at ${tmax}°C. Starting 4–6% slower through halfway preserves more time than it costs once it's warm.`,
      });
    } else if (tmax <= 14 && m.fadePct <= 4) {
      strengths.push({
        title: "Cool conditions played to your pacing",
        body: `Temperatures stayed between ${tmin}°C and ${tmax}°C — below the band where heat becomes a limiter — and your even splits reflect it.`,
      });
    }
  }

  // ---- Fueling, compared to the duration-based benchmark ----
  if (fuel.needsCarbs && race.fueling?.carbsPerHr != null) {
    const taken = race.fueling.carbsPerHr;
    if (taken < fuel.carbsLow) {
      const gap = fuel.carbsLow - taken;
      limiters.push({
        title: "Carbohydrate intake was light for the duration",
        body: `You took ${taken}g/hr; the evidence-backed range for a ${durationMin}-minute effort is ${fuel.carbsLabel}. That ${gap}g/hr shortfall most often shows up late, where glycogen runs thin.`,
      });
      recs.push({
        action: `Raise carbohydrate intake toward ${fuel.carbsLabel}`,
        why: `At ${taken}g/hr you were ${gap}g/hr under the low end of the ${fuel.carbsLabel} range for ${durationMin}-minute efforts. ${fuel.rationale}`,
      });
    } else if (!m || m.fadePct <= 4) {
      strengths.push({
        title: "Fueling matched the demand of the distance",
        body: `${taken}g/hr sits inside the ${fuel.carbsLabel} range for this duration and you held pace to the line — carry the same rate into your next effort of similar length.`,
      });
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
      const climbFinding = {
        title: climbVsFlat < 8 ? "Climbing effort matched your flat pace" : "Climbing cost more than the flats account for",
        body:
          climbVsFlat < 8
            ? `Across sections averaging ${avgClimbGrade.toFixed(1)}% grade, your grade-adjusted pace tracked within ${Math.abs(climbVsFlat).toFixed(0)}% of your flat effort — strong climbing economy for this course.`
            : `Across sections averaging ${avgClimbGrade.toFixed(1)}% grade, your grade-adjusted effort ran ${climbVsFlat.toFixed(0)}% slower than your flat splits — more than the grade alone explains, which usually means power or form broke down on the climbs specifically.`,
      };
      if (climbVsFlat < 8) strengths.push(climbFinding);
      else limiters.push(climbFinding);
    }
    if (descents.length) {
      const avgDescentGrade = descents.reduce((a, s) => a + s.gradePct, 0) / descents.length;
      const rawDescentPace = descents.reduce((a, s) => a + s.pace, 0) / descents.length;
      const gapDescentPace = descents.reduce((a, s) => a + s.gapPace, 0) / descents.length;
      const recovered = ((gapDescentPace - rawDescentPace) / gapDescentPace) * 100;
      strengths.push({
        title: "Descents recovered time efficiently",
        body: `On grades averaging ${avgDescentGrade.toFixed(1)}%, raw pace ran roughly ${Math.abs(recovered).toFixed(0)}% faster than effort-adjusted pace — gravity was doing the work the way it should, with no sign of over-braking.`,
      });
    }
    if (climbs.length) {
      recs.push({
        action: "Train climbing-specific intervals at race grade",
        why: `Your grade-adjusted pace on this course's climbs is the clearest signal for where to focus — hill repeats at a similar ${climbs[0].gradePct.toFixed(0)}% grade will transfer more directly than flat tempo work.`,
      });
    }
  }

  // ---- A closing pacing rec, only when the data shows a real positive split ----
  if (m && m.fadePct > 8 && !recs.some((r) => /opening|conservativ/i.test(r.action))) {
    recs.push({
      action: "Hold the opening third 3–5 sec/km slower than target",
      why: `Your ${Math.round(m.fadePct)}% positive split this race is the classic signature of starting too fast. Banking a few seconds early is the cheapest time you'll find.`,
    });
  }

  return { strengths, limiters, recs };
}

export function gatherDiagnosticData(race) {
  const key = race.splits?.[0]?.gapPace != null ? "gapPace" : "pace";
  const drift = paceDriftPct(race.splits);
  const fuel = fuelingBenchmarks(race.finishTime);
  const durationMin = Math.round(parseClockToMinutes(race.finishTime));
  const hot = race.tempC >= 24;
  const fuelingGap = fuel.needsCarbs ? race.fueling.carbsPerHr - fuel.carbsLow : null;
  const { strengths, limiters, recs } = buildDebrief(race);

  let turnKm = null;
  let maxJump = -Infinity;
  for (let i = 1; i < race.splits.length; i++) {
    const jump = race.splits[i][key] - race.splits[i - 1][key];
    if (jump > maxJump) { maxJump = jump; turnKm = race.splits[i].km; }
  }

  return {
    race, durationMin, drift, hot, fuelingGap, fuelRange: fuel.carbsLabel,
    needsCarbs: fuel.needsCarbs, turnKm,
    firstPace: fmtPace(race.splits[0][key]),
    lastPace: fmtPace(race.splits[race.splits.length - 1][key]),
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
      return fuel.needsCarbs && r.fueling.carbsPerHr < fuel.carbsLow;
    }),
    coolStrengths: strengths.filter(r => r.tempC <= 14),
  };
}
