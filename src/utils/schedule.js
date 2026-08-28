// Wall-clock scheduling for long races.
//
// The carry plan (src/utils/aidStations.js) reasons in *moving* minutes, because
// that's what burns fuel. A crew standing in a field at 3 a.m. needs the other
// half: what time the athlete actually arrives, which is moving time plus every
// minute planned at an aid station along the way.
//
// This module is pure and language-free — it emits clock strings and flags, and
// the components render them. It is deliberately separate from aidStations.js so
// the carry math never has to know about sunrise, cutoffs or midnight.

const MINUTES_PER_DAY = 1440;

// "05:00" → 300 minutes past midnight. null for anything unparseable, which
// makes every downstream clock feature switch itself off rather than guess.
export function parseTimeOfDay(v) {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Absolute minutes (which may run past midnight into day 2 or 3) → "HH:MM".
function fmtClock(abs) {
  const mins = ((Math.round(abs) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const dayOffset = (abs) => Math.floor(abs / MINUTES_PER_DAY);

/*
  How much of [absStart, absEnd] falls in darkness.

  Night on day d is [d·1440, d·1440 + sunrise] ∪ [d·1440 + sunset, (d+1)·1440],
  so we walk the days the interval spans and sum the overlaps. Sunrise/sunset are
  taken as constant across a multi-day race — they move by a couple of minutes a
  day, which is far inside the arrival window's own uncertainty.
*/
function darkMinutes(absStart, absEnd, sunriseMin, sunsetMin) {
  if (sunriseMin == null || sunsetMin == null || absEnd <= absStart) return 0;
  const overlap = (a, b) => Math.max(0, Math.min(absEnd, b) - Math.max(absStart, a));
  let total = 0;
  for (let d = dayOffset(absStart); d <= dayOffset(absEnd); d++) {
    const base = d * MINUTES_PER_DAY;
    total += overlap(base, base + sunriseMin);
    total += overlap(base + sunsetMin, base + MINUTES_PER_DAY);
  }
  return total;
}

/*
  A cutoff is published as a bare clock time ("19:00"), which in a race lasting
  more than a day is ambiguous. Resolve it to whichever occurrence sits closest
  to the projected arrival — for any real cutoff that is the intended one, since
  a cutoff more than 12 hours from your ETA isn't the cutoff you're racing.
*/
function resolveCutoff(cutoffMin, arrivalAbs) {
  if (cutoffMin == null) return null;
  const sameDay = dayOffset(arrivalAbs) * MINUTES_PER_DAY + cutoffMin;
  let best = sameDay;
  for (const candidate of [sameDay - MINUTES_PER_DAY, sameDay + MINUTES_PER_DAY]) {
    if (Math.abs(candidate - arrivalAbs) < Math.abs(best - arrivalAbs)) best = candidate;
  }
  return best;
}

/*
  Arrival spread, as a fraction of elapsed time so far.

  A point estimate 19 hours into a 100-miler is fiction, and a crew that treats
  one as a promise stands in the cold. The band opens from about ±4% early on to
  about ±10% by the finish, reflecting how error compounds with fatigue. The
  coefficients are a starting point to calibrate against logged races — see
  docs/design-ultra-planning.md §10.
*/
export function arrivalSpread(arrivalMinutes, targetMinutes) {
  if (!(arrivalMinutes > 0)) return 0;
  const progress = targetMinutes > 0 ? Math.min(1, arrivalMinutes / targetMinutes) : 1;
  return arrivalMinutes * (0.04 + 0.06 * progress);
}

/*
  Build the schedule.

    points     — from buildRoutePoints(): start, each station, finish
    legMinutes — moving minutes for each gap between consecutive points
    opts       — { startTimeOfDay, targetMinutes, sunrise, sunset }

  Returns null when there's no start time to anchor to; every clock-dependent
  piece of UI keys off that null and hides itself.
*/
export function buildSchedule(points, legMinutes, { startTimeOfDay, targetMinutes, sunrise, sunset } = {}) {
  const startMin = parseTimeOfDay(startTimeOfDay);
  if (startMin == null || !points?.length) return null;

  const sunriseMin = parseTimeOfDay(sunrise);
  const sunsetMin = parseTimeOfDay(sunset);
  const hasSun = sunriseMin != null && sunsetMin != null;

  const scheduled = [];
  const legs = [];
  let elapsed = 0;

  points.forEach((point, i) => {
    const arrivalMinutes = elapsed;
    const arrivalAbs = startMin + arrivalMinutes;
    const stop = point.stopMinutes ?? 0;
    const departMinutes = arrivalMinutes + stop;
    const departAbs = arrivalAbs + stop;

    const spread = arrivalSpread(arrivalMinutes, targetMinutes);
    const earlyAbs = arrivalAbs - spread;
    const lateAbs = arrivalAbs + spread;

    // The cutoff check runs against the *late* edge: being on time on average is
    // not the same as being safe.
    const cutoffMin = parseTimeOfDay(point.cutoff);
    const cutoffAbs = resolveCutoff(cutoffMin, arrivalAbs);
    const cutoffMarginMinutes = cutoffAbs != null ? Math.round(cutoffAbs - lateAbs) : null;

    scheduled.push({
      ...point,
      arrivalMinutes,
      departMinutes,
      arrivalClock: fmtClock(arrivalAbs),
      departClock: stop > 0 ? fmtClock(departAbs) : null,
      dayOffset: dayOffset(arrivalAbs),
      window: spread > 0
        ? { earlyClock: fmtClock(earlyAbs), lateClock: fmtClock(lateAbs), spreadMinutes: Math.round(spread) }
        : null,
      inDarkness: hasSun ? darkMinutes(arrivalAbs, arrivalAbs + 1, sunriseMin, sunsetMin) > 0 : null,
      cutoffMarginMinutes,
      atCutoffRisk: cutoffMarginMinutes != null && cutoffMarginMinutes < 0,
    });

    // The leg leaving this point, if there is one.
    const minutes = legMinutes?.[i];
    if (minutes != null && i < points.length - 1) {
      const arriveNextAbs = departAbs + minutes;
      const dark = hasSun ? darkMinutes(departAbs, arriveNextAbs, sunriseMin, sunsetMin) : 0;
      legs.push({
        fromName: point.name,
        toName: points[i + 1].name,
        fromKm: point.km,
        toKm: points[i + 1].km,
        minutes,
        departClock: fmtClock(departAbs),
        arriveClock: fmtClock(arriveNextAbs),
        darkMinutes: hasSun ? Math.round(dark) : null,
        // "Mostly dark" is the useful signal for packing a lamp — a leg with two
        // dark minutes at the end doesn't need one, a half-dark leg does.
        inDarkness: hasSun ? dark > minutes * 0.25 : null,
      });
      elapsed = departMinutes + minutes;
    }
  });

  const finish = scheduled[scheduled.length - 1];
  return {
    startClock: fmtClock(startMin),
    finishClock: finish.arrivalClock,
    finishDayOffset: finish.dayOffset,
    points: scheduled,
    legs,
    hasSun,
    hasDarkness: legs.some((l) => l.inDarkness),
    cutoffRisk: scheduled.some((p) => p.atCutoffRisk),
  };
}

/*
  Is this an ultra? Drives progressive disclosure only — the ultra fields are
  revealed by default when true and hidden behind a link when false, never
  hard-gated. A 42 km race with a 7-hour target is an ultra in every way that
  matters to stop time, drop bags and darkness.
*/
export function isUltra(distanceKm, targetMinutes) {
  return (distanceKm ?? 0) >= 50 || (targetMinutes ?? 0) >= 360;
}
