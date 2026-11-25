import { fmtClock } from "./clock.js";
/*
  Failures carry a catalog key (in the `plan` namespace) plus its interpolation
  values, rather than a sentence — see ParseError in gpx.js for the same pattern.
*/
export class WeatherError extends Error {
  constructor(key, values = {}) {
    super(key);
    this.name = "WeatherError";
    this.key = key;
    this.values = values;
  }
}

// fetch() throws a plain TypeError when the request never leaves the browser
// (CSP/sandbox block, DNS failure, offline). We detect this to fall back to
// a deterministic simulation rather than surfacing a confusing network error.
export function isNetworkBlockedError(err) {
  return err instanceof TypeError || /failed to fetch|network/i.test(err?.message || "");
}

function seededRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

// Deterministic, latitude/season-aware estimate. Same inputs → same output,
// so re-importing the same file doesn't change past results.
export function simulateHistoricalWeather(lat, lon, startMs, endMs) {
  const date = new Date(startMs);
  const dayOfYear = Math.floor((date - new Date(date.getUTCFullYear(), 0, 0)) / 86400000);
  const isNorthern = lat >= 0;
  const seasonPhase = isNorthern ? dayOfYear : dayOfYear + 182.5;
  const seasonalTemp = 14 - 12 * Math.cos((2 * Math.PI * seasonPhase) / 365);
  const latitudeCooling = Math.abs(lat) * 0.35;
  const baseTemp = seasonalTemp - latitudeCooling + 10;

  const rand = seededRandom(`${lat.toFixed(2)},${lon.toFixed(2)},${date.toISOString().slice(0, 10)}`);
  const tempC = Math.round((baseTemp + (rand() - 0.5) * 8) * 10) / 10;
  const humidity = Math.round(45 + rand() * 35);
  const wind = Math.round(4 + rand() * 18);
  const precipMm = rand() > 0.78 ? Math.round(rand() * 8 * 10) / 10 : 0;

  const hourlyTimes = [];
  const hourlyTemps = [];
  const startHourMs = Math.floor(startMs / 3600000) * 3600000;
  const endHourMs = Math.ceil((endMs ?? startMs) / 3600000) * 3600000;
  const dailyRange = 6;
  for (let t = startHourMs; t <= endHourMs + 3600000; t += 3600000) {
    const h = new Date(t).getUTCHours();
    const diurnal = -Math.cos((2 * Math.PI * (h - 6)) / 24);
    hourlyTimes.push(new Date(t).toISOString().slice(0, 16));
    hourlyTemps.push(Math.round((tempC + diurnal * (dailyRange / 2)) * 10) / 10);
  }

  return { tempC, humidity, wind, precipMm, simulated: true, hourlyTimes, hourlyTemps };
}

export async function fetchHistoricalWeather(lat, lon, startMs, endMs) {
  const startDate = new Date(startMs).toISOString().slice(0, 10);
  const endDate = new Date(endMs ?? startMs).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: startDate,
    end_date: endDate,
    hourly: "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation",
    timezone: "UTC",
  });
  const url = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    if (isNetworkBlockedError(err)) {
      return simulateHistoricalWeather(lat, lon, startMs, endMs);
    }
    throw err;
  }

  if (!res.ok) {
    // Open-Meteo's own `reason` is passed through when present: it is more
    // specific than anything we could say, and the service replies in English
    // regardless of locale.
    const body = await res.json().catch(() => null);
    if (body?.reason) throw new Error(body.reason);
    throw new WeatherError("errors.weatherLookupFailed", { status: res.status });
  }
  const data = await res.json();
  const times = data?.hourly?.time;
  if (!times || !times.length) {
    throw new WeatherError("errors.noHistoricalWeather");
  }

  const targetMs = startMs;
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i] + ":00Z").getTime() - targetMs);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }

  const temp = data.hourly.temperature_2m?.[bestIdx];
  const humidity = data.hourly.relative_humidity_2m?.[bestIdx];
  const wind = data.hourly.wind_speed_10m?.[bestIdx];
  const precip = data.hourly.precipitation?.[bestIdx];

  if (temp == null) {
    throw new WeatherError("errors.noWeatherForTime");
  }

  return {
    tempC: Math.round(temp * 10) / 10,
    humidity: humidity != null ? Math.round(humidity) : null,
    wind: wind != null ? Math.round(wind) : null,
    precipMm: precip != null ? Math.round(precip * 10) / 10 : null,
    simulated: false,
    hourlyTimes: times,
    hourlyTemps: data.hourly.temperature_2m ?? [],
  };
}

// Samples up to MAX_SAMPLES evenly-spaced GPS points along the course,
// fetches weather at each in parallel, and interpolates for every split.
// This captures elevation-driven and geographic temperature variation that
// a single start-point fetch misses on longer/hillier courses.
export async function fetchWeatherAlongCourse(splits) {
  const geo = splits.filter((s) => s.lat != null && s.lon != null && s.timeMs != null);
  if (geo.length === 0) return splits;

  const totalKm = geo[geo.length - 1].km ?? geo.length;
  const MAX_SAMPLES = Math.max(3, Math.round(totalKm / 20));
  const step = Math.max(1, Math.floor(geo.length / (MAX_SAMPLES - 1)));
  const sampled = [];
  for (let i = 0; i < geo.length; i += step) sampled.push(geo[i]);
  const last = geo[geo.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);

  const fetched = await Promise.all(
    sampled.map((s) =>
      fetchHistoricalWeather(s.lat, s.lon, s.timeMs, s.timeMs).catch(() => null)
    )
  );

  const controls = sampled
    .map((s, i) => ({ km: s.km, tempC: fetched[i]?.tempC ?? null }))
    .filter((c) => c.tempC != null);

  if (controls.length === 0) return splits;

  return splits.map((s) => {
    let lo = controls[0];
    let hi = controls[controls.length - 1];
    for (let i = 0; i < controls.length - 1; i++) {
      if (s.km >= controls[i].km && s.km <= controls[i + 1].km) {
        lo = controls[i];
        hi = controls[i + 1];
        break;
      }
    }
    const t = lo.km === hi.km ? 0 : (s.km - lo.km) / (hi.km - lo.km);
    const tempC = Math.round((lo.tempC + t * (hi.tempC - lo.tempC)) * 10) / 10;
    return { ...s, mappedTempC: tempC };
  });
}

export async function geocodeLocation(query) {
  const params = new URLSearchParams({ name: query, count: "1" });
  let res;
  try {
    res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  } catch (err) {
    if (isNetworkBlockedError(err)) {
      return { lat: 40, lon: -75, label: `${query} (simulated location)`, simulated: true };
    }
    throw err;
  }
  if (!res.ok) throw new WeatherError("errors.locationLookupFailed");
  const data = await res.json();
  const match = data?.results?.[0];
  if (!match) throw new WeatherError("errors.locationNotFound", { query });
  return { lat: match.latitude, lon: match.longitude, label: `${match.name}, ${match.country}`, simulated: false };
}

export function heatPenalty(tempC) {
  return Math.max(0, (tempC - 20) * 0.02);
}

export function heatAdjustedTime(finishTime, fromTempC, toTempC) {
  // inline parseClockToMinutes to avoid circular dep
  const parts = finishTime.split(":").map((p) => parseFloat(p) || 0);
  const rawMin = parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 60 : parts[0] + parts[1] / 60;
  const fairMin = rawMin / (1 + heatPenalty(fromTempC));
  const adjMin = fairMin * (1 + heatPenalty(toTempC));
  return fmtClock(adjMin);
}
