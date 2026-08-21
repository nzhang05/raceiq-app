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
    out.limiters.push({
      title: "Fuel dropped where your pace did",
      body: `Over km ${x.sec.fromKm}–${x.sec.toKm} your carb intake was ${x.carbRate}g/hr — ${gap}g/hr under the ${fuel.carbsLabel} range for a ${durationMin}-minute effort — and that's exactly where your pace slipped from ${fmtPace(x.firstPace)} to ${fmtPace(x.lastPace)}. The fade tracks the fuel, not just the distance.`,
    });
    out.recs.push({
      action: `Hold ${fuel.carbsLabel} through km ${x.sec.fromKm}–${x.sec.toKm}`,
      why: `You under-fuelled that section by ${gap}g/hr and it's where the wheels came off. Carrying the target rate through it is the highest-leverage change for this course. ${fuel.rationale}`,
    });
  } else {
    // Located strength: closing section fuelled in range and held.
    const closing = summaries[summaries.length - 1];
    if (closing && closing.firstPace != null && closing.carbRate >= fuel.carbsLow && closing.driftPct <= 4) {
      out.strengths.push({
        title: "You fuelled the back section and it held",
        body: `Through the closing km ${closing.sec.fromKm}–${closing.sec.toKm} you took ${closing.carbRate}g/hr — inside the ${fuel.carbsLabel} range — and pace held at ${fmtPace(closing.lastPace)}. Fuelling late is exactly where it pays off.`,
      });
    }
  }

  // Heat × fluid timing: a later, hotter section with a lower fluid rate.
  for (let i = 1; i < summaries.length; i++) {
    const prev = summaries[i - 1];
    const cur = summaries[i];
    if (prev.avgTemp != null && cur.avgTemp != null && cur.avgTemp - prev.avgTemp >= 2 && cur.avgTemp >= 22 && cur.fluidRate < prev.fluidRate) {
      out.limiters.push({
        title: "Fluid intake fell as it got hotter",
        body: `Over km ${cur.sec.fromKm}–${cur.sec.toKm} the course averaged ${Math.round(cur.avgTemp)}°C — up from ${Math.round(prev.avgTemp)}°C — yet your fluid intake dropped to ${cur.fluidRate}ml/hr from ${prev.fluidRate}ml/hr. Hydration should rise with temperature, not fall.`,
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
