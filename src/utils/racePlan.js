import { heatPenalty, simulateHistoricalWeather, isNetworkBlockedError } from "./weather.js";
import { runningCostMultiplier, cyclingCostMultiplier } from "./pace.js";
import { fuelingBenchmarks, personalizeFueling } from "./fueling.js";
import { buildCarryPlan, buildPacingSections, buildRoutePoints, sanitizeAidStations, totalStopMinutes, DEFAULT_POINT_LABELS } from "./aidStations.js";
import { buildSchedule } from "./schedule.js";
import { gatherLimiterPatterns } from "./analysis.js";
import { parseClockToMinutes } from "./time.js";
import { splitIntervalKm } from "./gpx.js";
import { isCyclingSport } from "../constants.js";
import { fmtClock } from "./clock.js";

export function minutesToClock(min) {
  return fmtClock(min);
}

export async function forecastWeather(lat, lon, dateStr) {
  try {
    // sunrise/sunset ride along on the daily call we already make — they cost no
    // extra request and drive the darkness markers in the ultra schedule.
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max,sunrise,sunset&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("forecast API error");
    const data = await res.json();
    const d = data.daily;
    const tempC = Math.round(((d.temperature_2m_max[0] + d.temperature_2m_min[0]) / 2) * 10) / 10;
    const wind = d.windspeed_10m_max?.[0] != null ? Math.round(d.windspeed_10m_max[0]) : null;
    // "2026-08-29T06:41" → "06:41". Null when absent, which makes the schedule
    // omit darkness rather than guess at it.
    const clockPart = (v) => (typeof v === "string" && v.includes("T") ? v.split("T")[1].slice(0, 5) : null);
    return {
      tempC,
      humidity: null,
      wind,
      sunrise: clockPart(d.sunrise?.[0]),
      sunset: clockPart(d.sunset?.[0]),
      simulated: false,
    };
  } catch (err) {
    if (isNetworkBlockedError(err)) {
      return { ...simulateHistoricalWeather(lat, lon, Date.now(), Date.now()), simulated: true };
    }
    throw err;
  }
}

export function estimateTargetTime(gpxData, sport, plannedWeather, allRaces) {
  const isCycling = isCyclingSport(sport);
  const sameSportRaces = allRaces.filter((r) => r.sport === sport && r.finishTime && r.distanceKm > 0);

  let estMinutes;

  if (sameSportRaces.length === 0) {
    const genericPace = isCycling ? 60 / 25 : 5.0;
    estMinutes = genericPace * gpxData.distanceKm;
  } else {
    const ref = [...sameSportRaces].sort((a, b) => b.percentile - a.percentile)[0];
    const refMin = parseClockToMinutes(ref.finishTime);
    const refDist = ref.distanceKm;

    if (isCycling) {
      estMinutes = (refMin / refDist) * gpxData.distanceKm;
    } else {
      estMinutes = refMin * Math.pow(gpxData.distanceKm / refDist, 1.06);
    }

    const refElevRatio = (ref.elevationM || 0) / refDist;
    const newElevRatio = (gpxData.elevationM || 0) / gpxData.distanceKm;
    const elevDiff = newElevRatio - refElevRatio;
    if (elevDiff > 0) {
      // +1 min per 100m of total additional elevation gain (standard trail running adjustment)
      estMinutes += (elevDiff / 100) * gpxData.distanceKm;
    }
  }

  const penalty = plannedWeather?.tempC != null ? heatPenalty(plannedWeather.tempC) : 0;
  estMinutes = Math.round(estMinutes * (1 + penalty));

  return { minutes: estMinutes, clock: minutesToClock(estMinutes) };
}

/*
  `options` carries everything past the core five: aid stations, carry capacity,
  manual fuelling overrides, the rendered point labels, and the ultra additions
  (`startTimeOfDay` for wall-clock ETAs).

  Time model — see docs/design-ultra-planning.md §4. `targetMinutes` is the
  athlete's total *elapsed* finish time, which is what they type in and what
  every reference race records. Time planned at aid stations is subtracted from
  it before pacing is solved, so the plan doesn't quietly assume you teleport
  through every checkpoint. With no stop times set the subtraction is zero and
  the output is identical to a pre-ultra plan.
*/
export function buildRacePlan(gpxData, sport, weather, targetMinutes, allRaces, options = {}) {
  const {
    aidStations = [],
    carryCapacityMl = null,
    manualFueling = {},
    pointLabels = DEFAULT_POINT_LABELS,
    startTimeOfDay = null,
  } = options;

  const isCycling = isCyclingSport(sport);
  const costFn = isCycling ? cyclingCostMultiplier : runningCostMultiplier;

  const stopMinutes = totalStopMinutes(aidStations, gpxData.distanceKm, pointLabels);
  // Guard: a stop budget over half the target time would produce an absurd
  // moving pace. Clamp and tell the athlete rather than emitting nonsense.
  const stopBudgetExceeded = stopMinutes > targetMinutes * 0.5;
  const appliedStopMinutes = stopBudgetExceeded ? targetMinutes * 0.5 : stopMinutes;
  const movingMinutes = targetMinutes - appliedStopMinutes;

  // Pacing splits
  const splits = gpxData.splits ?? [];
  const pacing = [];

  if (splits.length > 1) {
    let totalWeightedCost = 0;
    const segCosts = [];
    for (let i = 1; i < splits.length; i++) {
      const prev = splits[i - 1];
      const curr = splits[i];
      const segKm = curr.km - prev.km;
      const elevDiff = (curr.elevM ?? 0) - (prev.elevM ?? 0);
      const distM = segKm * 1000;
      const gradePct = distM > 0 ? (elevDiff / distM) * 100 : 0;
      const cost = costFn(gradePct);
      segCosts.push({ curr, segKm, gradePct, cost });
      totalWeightedCost += segKm * cost;
    }

    const baseMinPerKm = totalWeightedCost > 0 ? movingMinutes / totalWeightedCost : movingMinutes / gpxData.distanceKm;

    for (const { curr, gradePct, cost } of segCosts) {
      const suggestedPace = baseMinPerKm * cost;
      let label = "FLAT";
      if (gradePct > 4) label = "CLIMB";
      else if (gradePct < -4) label = "DESCENT";
      pacing.push({ km: curr.km, elevM: curr.elevM, gradePct: Math.round(gradePct * 10) / 10, suggestedPace, label });
    }
  } else {
    const pacePerKm = movingMinutes / gpxData.distanceKm;
    const interval = splitIntervalKm(sport);
    for (let km = interval; km <= gpxData.distanceKm + 0.01; km += interval) {
      pacing.push({ km: Math.min(Math.round(km * 10) / 10, gpxData.distanceKm), elevM: null, gradePct: 0, suggestedPace: pacePerKm, label: "FLAT" });
    }
  }

  // Nutrition — personalised from the athlete's actual fueling in the reference races
  // and any manual known-good rates, falling back to the research benchmark. See
  // personalizeFueling for the per-metric precedence.
  const benchmark = fuelingBenchmarks(minutesToClock(targetMinutes));
  const tempC = weather?.tempC ?? 18;
  const heatExtra = Math.max(0, tempC - 15);
  const nutrition = personalizeFueling({
    benchmark,
    history: allRaces,
    targetMinutes,
    tempC,
    manual: manualFueling,
  });

  // Aid-station carry plan — how much to carry between refill points (null when
  // no stations were provided).
  const carryPlan = buildCarryPlan(pacing, nutrition, aidStations, gpxData.distanceKm, movingMinutes, carryCapacityMl, pointLabels);

  // Section-delimited pacing (one row per leg between aid stations); null when no
  // stations were set, so the view falls back to the per-km pacing table.
  const pacingSections = buildPacingSections(pacing, aidStations, gpxData.distanceKm, pointLabels);

  // Wall-clock schedule. Needs a start time-of-day to anchor to; without one
  // every clock-dependent piece of UI stays hidden. The leg moving-times come
  // from whichever section view exists so the two can't drift apart.
  const routePoints = buildRoutePoints(aidStations, gpxData.distanceKm, pointLabels);
  const legMinutes = (pacingSections ?? carryPlan?.legs)?.map((l) => l.minutes) ?? [movingMinutes];
  const schedule = buildSchedule(routePoints, legMinutes, {
    startTimeOfDay,
    targetMinutes,
    sunrise: weather?.sunrise ?? null,
    sunset: weather?.sunset ?? null,
  });

  // Recommendations
  const { hotLimiters = [], underFueled = [] } = gatherLimiterPatterns(allRaces);
  const recs = [];
  if (hotLimiters.length > 0) recs.push({ key: "rec.heatStart" });
  if (underFueled.length > 0) recs.push({ key: "rec.fuelEarly" });
  if (tempC > 24) {
    recs.push({
      key: "rec.preCool",
      values: { extraMl: Math.round(heatExtra * 30), tempC, penaltyPct: Math.round(heatPenalty(tempC) * 100) },
    });
  }
  if ((gpxData.elevationM || 0) > 500) {
    recs.push({
      key: "rec.climbByEffort",
      values: { elevationM: gpxData.elevationM },
    });
  }
  recs.push({ key: "rec.evenStart" });

  const sameSportRaces = allRaces.filter((r) => r.sport === sport && r.finishTime);
  const referenceRace = sameSportRaces.sort((a, b) => b.percentile - a.percentile)[0] ?? null;

  return {
    // `path` and `splits` ride along so the plan view can draw the course map
    // and elevation profile without re-reading the original GPX (which the
    // athlete no longer has open by this point).
    course: {
      name: gpxData.name,
      distanceKm: gpxData.distanceKm,
      elevationM: gpxData.elevationM,
      path: gpxData.path ?? [],
      splits: splits,
      stations: sanitizeAidStations(aidStations, gpxData.distanceKm, pointLabels),
    },
    targetMinutes,
    targetClock: minutesToClock(targetMinutes),
    // The elapsed/moving split. `stopMinutes` is what the athlete planned;
    // `appliedStopMinutes` is what the pace solver could honour.
    stopMinutes,
    appliedStopMinutes,
    movingMinutes,
    movingClock: minutesToClock(movingMinutes),
    stopBudgetExceeded,
    startTimeOfDay,
    schedule,
    // The cleaned station list, so the view and the crew sheet read the same
    // stations the planning modules did rather than re-sanitizing raw input.
    stations: sanitizeAidStations(aidStations, gpxData.distanceKm, pointLabels),
    pacing,
    pacingSections,
    nutrition,
    carryPlan,
    recommendations: recs,
    referenceRace,
    weather,
  };
}
