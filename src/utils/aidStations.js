// Aid-station carry planning.
//
// The race plan produces per-hour fuelling *rates* (carbs/sodium/fluids). What
// an athlete actually needs to know on the start line is how much to physically
// carry between the points where they can refill — the aid stations. This module
// turns the pacing profile + per-hour rates into a per-leg "carry this much" plan.

const GEL_G = 25;       // grams of carbohydrate per typical gel
const BOTTLE_ML = 500;  // volume of a typical soft-flask / bottle

// `labels` supplies the display names for generated points. Passing them in
// (rather than importing i18n here) keeps this module pure and language-free;
// callers build them from `t`. The English defaults keep direct callers working.
export const DEFAULT_POINT_LABELS = {
  start: "Start",
  finish: "Finish",
  aid: (n) => `Aid ${n}`,
};

// Non-negative number or 0. Guards every ultra field below, so a half-typed
// input ("1e", "-5") can never poison the time budget.
function num(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Cutoffs are entered the way race manuals print them — a wall-clock time.
// Normalised to "HH:MM"; anything unparseable becomes null (no cutoff).
function normalizeCutoff(v) {
  if (typeof v !== "string" || !v.trim()) return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// A drop bag is fuel items (keys from FUEL_ITEMS) plus free-text gear lines.
// An *enabled but empty* bag is kept — the athlete has said "there is a bag
// here", which the crew sheet needs to know even before it's filled in.
function sanitizeDropBag(bag) {
  if (!bag) return null;
  const items = {};
  for (const [k, v] of Object.entries(bag.items ?? {})) {
    const n = Math.round(num(v));
    if (n > 0) items[k] = n;
  }
  return {
    items,
    gear: (bag.gear ?? []).map((g) => String(g).trim()).filter(Boolean),
    notes: (bag.notes ?? "").trim(),
  };
}

// Keep only usable stations: a positive km strictly inside the course, sorted,
// de-duplicated. Anything out of range is silently dropped so bad input can't
// produce a nonsensical leg.
export function sanitizeAidStations(stations, distanceKm, labels = DEFAULT_POINT_LABELS) {
  const seen = new Set();
  return (stations || [])
    .map((s) => {
      const stopMinutes = num(s.stopMinutes);
      return {
        km: Math.round((parseFloat(s.km) || 0) * 100) / 100,
        name: (s.name || "").trim(),
        water: s.water !== false,
        food: s.food !== false,
        // Ultra fields. Sleep is a *subset* of the stop, never additional to it,
        // so a 20-minute stop can't secretly contain a 90-minute nap.
        stopMinutes,
        sleepMinutes: Math.min(stopMinutes, num(s.sleepMinutes)),
        crewAccess: s.crewAccess === true,
        cutoff: normalizeCutoff(s.cutoff),
        dropBag: sanitizeDropBag(s.dropBag),
      };
    })
    .filter((s) => s.km > 0 && s.km < distanceKm)
    .filter((s) => {
      if (seen.has(s.km)) return false;
      seen.add(s.km);
      return true;
    })
    .sort((a, b) => a.km - b.km)
    .map((s, i) => ({ ...s, name: s.name || labels.aid(i + 1) }));
}

// Cumulative-time lookup built from the pacing segments. Each pacing entry is a
// segment endpoint carrying the suggested pace (min/km) held over that segment,
// so a leg that crosses a climb correctly costs more time — and therefore more
// fuel — than a flat leg of the same distance.
function makeTimeAtKm(pacing, distanceKm, targetMinutes) {
  if (!pacing || pacing.length === 0) {
    const perKm = distanceKm > 0 ? targetMinutes / distanceKm : 0;
    return (km) => Math.max(0, Math.min(km, distanceKm)) * perKm;
  }

  // Build [{ startKm, endKm, pace, cumStart }] across the profile, starting at 0.
  const segs = [];
  let prevKm = 0;
  let cum = 0;
  for (const p of pacing) {
    const endKm = p.km;
    const segKm = Math.max(0, endKm - prevKm);
    segs.push({ startKm: prevKm, endKm, pace: p.suggestedPace, cumStart: cum });
    cum += segKm * p.suggestedPace;
    prevKm = endKm;
  }
  const totalCum = cum || targetMinutes;

  return (km) => {
    if (km <= 0) return 0;
    if (km >= distanceKm) return totalCum;
    const seg = segs.find((s) => km <= s.endKm + 1e-9) ?? segs[segs.length - 1];
    return seg.cumStart + (km - seg.startKm) * seg.pace;
  };
}

const round5 = (n) => Math.round(n / 5) * 5;
const round50 = (n) => Math.round(n / 50) * 50;
const round1 = (n) => Math.round(n * 10) / 10;

// Roll the per-km/per-segment pacing up into one row per race section (the gap
// between refill points), so the pacing plan is delimited by aid stations. Each
// segment's distance/time is clipped to the section it falls in, so a segment that
// straddles a station boundary contributes proportionally to both sides. Returns
// null when there are no stations — callers fall back to the flat pacing table.
export function buildPacingSections(pacing, aidStations, distanceKm, labels = DEFAULT_POINT_LABELS) {
  const clean = sanitizeAidStations(aidStations, distanceKm, labels);
  if (clean.length === 0 || !pacing || pacing.length === 0) return null;

  // Rebuild explicit [startKm, endKm] spans from the segment endpoints.
  const segs = [];
  let prevKm = 0;
  for (const p of pacing) {
    segs.push({ startKm: prevKm, endKm: p.km, pace: p.suggestedPace, gradePct: p.gradePct ?? 0, elevM: p.elevM });
    prevKm = p.km;
  }

  const boundaries = [0, ...clean.map((s) => s.km), distanceKm];
  const names = [labels.start, ...clean.map((s) => s.name), labels.finish];
  const sections = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const a = boundaries[i];
    const b = boundaries[i + 1];
    let dist = 0;
    let minutes = 0;
    let gradeWeighted = 0;
    let elevGain = 0;
    let prevElev = null;

    for (const seg of segs) {
      const lo = Math.max(a, seg.startKm);
      const hi = Math.min(b, seg.endKm);
      const overlap = hi - lo;
      if (overlap <= 0) continue;
      dist += overlap;
      minutes += overlap * seg.pace;
      gradeWeighted += overlap * seg.gradePct;
      if (seg.elevM != null) {
        if (prevElev != null && seg.elevM > prevElev) elevGain += seg.elevM - prevElev;
        prevElev = seg.elevM;
      }
    }

    const avgGrade = dist > 0 ? gradeWeighted / dist : 0;
    let label = "FLAT";
    if (avgGrade > 2) label = "CLIMB";
    else if (avgGrade < -2) label = "DESCENT";

    sections.push({
      fromName: names[i],
      toName: names[i + 1],
      fromKm: round1(a),
      toKm: round1(b),
      distanceKm: round1(dist),
      suggestedPace: dist > 0 ? minutes / dist : 0,
      minutes,
      gradePct: round1(avgGrade),
      elevGainM: Math.round(elevGain),
      label,
    });
  }

  return sections;
}

// Total planned non-moving time. This is what separates an ultra plan from a
// marathon plan: ten stations at eight minutes is eighty minutes that the pace
// solver must not spend on running. See docs/design-ultra-planning.md §4.
export function totalStopMinutes(aidStations, distanceKm, labels = DEFAULT_POINT_LABELS) {
  return sanitizeAidStations(aidStations, distanceKm, labels)
    .reduce((sum, s) => sum + s.stopMinutes, 0);
}

// The ordered boundary list — start, each station, finish — shared by the carry
// plan and the schedule so the two can never disagree about what a "point" is.
export function buildRoutePoints(aidStations, distanceKm, labels = DEFAULT_POINT_LABELS) {
  const clean = sanitizeAidStations(aidStations, distanceKm, labels);
  return [
    { km: 0, name: labels.start, water: true, food: true, stopMinutes: 0, sleepMinutes: 0, crewAccess: false, cutoff: null, dropBag: null, isStart: true },
    ...clean,
    { km: distanceKm, name: labels.finish, stopMinutes: 0, sleepMinutes: 0, crewAccess: false, cutoff: null, dropBag: null, isFinish: true },
  ];
}

// Build the carry plan: one leg per gap between refill points (start → aid 1 →
// … → finish). Each leg reports how much to carry out of the point that begins
// it, flagging legs whose fluid need exceeds the athlete's carry capacity.
//
// `movingMinutes` is the running time budget — target finish time *minus* time
// planned at aid stations. Fuel burn tracks time on the move, not time standing
// at a table, so every duration in here is moving time. Wall-clock arrival is
// src/utils/schedule.js's job.
export function buildCarryPlan(pacing, nutrition, aidStations, distanceKm, movingMinutes, carryCapacityMl, labels = DEFAULT_POINT_LABELS) {
  const clean = sanitizeAidStations(aidStations, distanceKm, labels);
  if (clean.length === 0) return null;

  const timeAtKm = makeTimeAtKm(pacing, distanceKm, movingMinutes);
  const carbsPerHr = nutrition.carbsTargetNum ?? 0;
  const fluidsPerHr = nutrition.fluidsMlHr ?? 0;
  const sodiumPerHr = nutrition.sodiumMgHr ?? 0;
  const capacity = carryCapacityMl && carryCapacityMl > 0 ? carryCapacityMl : null;

  const points = buildRoutePoints(aidStations, distanceKm, labels);

  const legs = [];
  const totals = { carbsG: 0, fluidsMl: 0, sodiumMg: 0 };

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const legKm = Math.round((to.km - from.km) * 100) / 100;
    const minutes = timeAtKm(to.km) - timeAtKm(from.km);
    const hours = minutes / 60;

    const carbsG = round5(carbsPerHr * hours);
    const fluidsMl = round50(fluidsPerHr * hours);
    const sodiumMg = round50(sodiumPerHr * hours);
    const gels = carbsPerHr > 0 ? Math.ceil((carbsPerHr * hours) / GEL_G) : 0;
    const bottles = Math.round((fluidsMl / BOTTLE_ML) * 10) / 10;
    const overCapacity = capacity != null && fluidsMl > capacity;

    // The note is emitted as a key + values, not prose — legNoteText() in
    // src/i18n/render.js renders it, appending the over-capacity sentence.
    let noteKey;
    if (from.isStart) noteKey = "leg.fromStart";
    else if (from.food === false) noteKey = "leg.waterOnly";
    else noteKey = "leg.restock";
    const noteValues = { name: from.name, fluidsMl, capacity };

    totals.carbsG += carbsG;
    totals.fluidsMl += fluidsMl;
    totals.sodiumMg += sodiumMg;

    legs.push({
      fromName: from.name,
      toName: to.name,
      fromKm: from.km,
      toKm: to.km,
      legKm,
      minutes,
      carbsG,
      gels,
      fluidsMl,
      bottles,
      sodiumMg,
      water: from.water !== false,
      food: from.food !== false,
      overCapacity,
      noteKey,
      noteValues,
    });
  }

  return {
    gelG: GEL_G,
    bottleMl: BOTTLE_ML,
    carryCapacityMl: capacity,
    stationCount: clean.length,
    packAtStart: legs[0],
    legs,
    totals,
  };
}
