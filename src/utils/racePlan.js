import { heatPenalty, simulateHistoricalWeather, isNetworkBlockedError } from "./weather.js";
import { runningCostMultiplier, cyclingCostMultiplier } from "./pace.js";
import { fuelingBenchmarks, personalizeFueling } from "./fueling.js";
import { buildCarryPlan, buildPacingSections, sanitizeAidStations } from "./aidStations.js";
import { gatherLimiterPatterns } from "./analysis.js";
import { parseClockToMinutes } from "./time.js";
import { splitIntervalKm } from "./gpx.js";
import { isCyclingSport } from "../constants.js";

export function minutesToClock(min) {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  const s = Math.round((min * 60) % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export async function forecastWeather(lat, lon, dateStr) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("forecast API error");
    const data = await res.json();
    const d = data.daily;
    const tempC = Math.round(((d.temperature_2m_max[0] + d.temperature_2m_min[0]) / 2) * 10) / 10;
    const wind = d.windspeed_10m_max?.[0] != null ? Math.round(d.windspeed_10m_max[0]) : null;
    return { tempC, humidity: null, wind, simulated: false };
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

export function buildRacePlan(gpxData, sport, weather, targetMinutes, allRaces, aidStations = [], carryCapacityMl = null, manualFueling = {}) {
  const isCycling = isCyclingSport(sport);
  const costFn = isCycling ? cyclingCostMultiplier : runningCostMultiplier;

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

    const baseMinPerKm = totalWeightedCost > 0 ? targetMinutes / totalWeightedCost : targetMinutes / gpxData.distanceKm;

    for (const { curr, gradePct, cost } of segCosts) {
      const suggestedPace = baseMinPerKm * cost;
      let label = "FLAT";
      if (gradePct > 4) label = "CLIMB";
      else if (gradePct < -4) label = "DESCENT";
      pacing.push({ km: curr.km, elevM: curr.elevM, gradePct: Math.round(gradePct * 10) / 10, suggestedPace, label });
    }
  } else {
    const pacePerKm = targetMinutes / gpxData.distanceKm;
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
  const carryPlan = buildCarryPlan(pacing, nutrition, aidStations, gpxData.distanceKm, targetMinutes, carryCapacityMl);

  // Section-delimited pacing (one row per leg between aid stations); null when no
  // stations were set, so the view falls back to the per-km pacing table.
  const pacingSections = buildPacingSections(pacing, aidStations, gpxData.distanceKm);

  // Recommendations
  const { hotLimiters = [], underFueled = [] } = gatherLimiterPatterns(allRaces);
  const recs = [];
  if (hotLimiters.length > 0) {
    recs.push({
      action: "Start conservatively — your past heat races show a late fade",
      why: "You have historically underperformed in warm conditions. Dial back the opening third by 5–8 sec/km and bank the energy.",
    });
  }
  if (underFueled.length > 0) {
    recs.push({
      action: "Fuel in the first 20 minutes, before you feel hungry",
      why: "Your past limiters include under-fueled races. Starting carbohydrate intake early prevents the late-race wall.",
    });
  }
  if (tempC > 24) {
    recs.push({
      action: `Pre-cool before the start and add ${Math.round(heatExtra * 30)} ml/hr extra fluids`,
      why: `At ${tempC}°C expect a ~${Math.round(heatPenalty(tempC) * 100)}% heat tax. Early hydration and active cooling are the highest-leverage mitigation.`,
    });
  }
  if ((gpxData.elevationM || 0) > 500) {
    recs.push({
      action: "Race by effort on the climbs, not by target pace",
      why: `${gpxData.elevationM}m of gain means per-km pace will swing widely. Chase grade-adjusted effort on the uphills and let the descents pay you back.`,
    });
  }
  recs.push({
    action: "Stick to your target splits in the opening third",
    why: "Going out too fast is the single most common cause of late-race fade, regardless of fitness level.",
  });

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
      stations: sanitizeAidStations(aidStations, gpxData.distanceKm),
    },
    targetMinutes,
    targetClock: minutesToClock(targetMinutes),
    pacing,
    pacingSections,
    nutrition,
    carryPlan,
    recommendations: recs,
    referenceRace,
    weather,
  };
}
