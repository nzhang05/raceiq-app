import { isCyclingSport } from "../constants.js";
import { haversineMeters } from "./geo.js";
import { resolveWaypoints } from "./waypoints.js";
import { fmtClock } from "./clock.js";

/*
  Failures carry a catalog key (in the `plan` namespace) rather than a sentence,
  so this module stays language-free. Callers render it with errorText() from
  src/i18n/render.js.
*/
export class ParseError extends Error {
  constructor(key) {
    super(key);
    this.name = "ParseError";
    this.key = key;
  }
}

// Chart/split sampling cadence: running races get a point every km,
// cycling races every 5 km (cycling covers far more ground, so 1 km
// splits would crowd the analysis chart with little added signal).
export function splitIntervalKm(sport) {
  return isCyclingSport(sport) ? 5 : 1;
}

function parseGpxPoints(xmlDoc, tagName = "trkpt") {
  const trkpts = Array.from(xmlDoc.getElementsByTagName(tagName));
  return trkpts
    .map((pt) => {
      const lat = parseFloat(pt.getAttribute("lat"));
      const lon = parseFloat(pt.getAttribute("lon"));
      const eleEl = pt.getElementsByTagName("ele")[0];
      const timeEl = pt.getElementsByTagName("time")[0];
      const ele = eleEl ? parseFloat(eleEl.textContent) : null;
      const time = timeEl ? new Date(timeEl.textContent).getTime() : null;
      return { lat, lon, ele, time };
    })
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));
}

function parseTcxPoints(xmlDoc) {
  const trackpoints = Array.from(xmlDoc.getElementsByTagName("Trackpoint"));
  return trackpoints
    .map((pt) => {
      const posEl = pt.getElementsByTagName("Position")[0];
      const lat = posEl ? parseFloat(posEl.getElementsByTagName("LatitudeDegrees")[0]?.textContent) : NaN;
      const lon = posEl ? parseFloat(posEl.getElementsByTagName("LongitudeDegrees")[0]?.textContent) : NaN;
      const altEl = pt.getElementsByTagName("AltitudeMeters")[0];
      const timeEl = pt.getElementsByTagName("Time")[0];
      const ele = altEl ? parseFloat(altEl.textContent) : null;
      const time = timeEl ? new Date(timeEl.textContent).getTime() : null;
      return { lat, lon, ele, time };
    })
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));
}

const childText = (el, tag) => {
  if (!el) return "";
  const match = Array.from(el.children || []).find((c) => c.tagName === tag);
  return match?.textContent?.trim() ?? "";
};

// The course's own name.
//
// Not `getElementsByTagName("name")[0]`: the GPX schema orders children
// metadata → wpt* → rte* → trk*, so on a file with waypoints and no
// <metadata><name> that returns the *first aid station's* name. Direct-child
// lookups only, so a <name> nested in a waypoint can never be picked up.
function readCourseName(xmlDoc, file) {
  const first = (tag) => xmlDoc.getElementsByTagName(tag)[0];
  const fromMetadata = childText(first("metadata"), "name");
  const fromTrack = childText(first("trk"), "name");
  const fromRoute = childText(first("rte"), "name");
  return (
    fromMetadata ||
    fromTrack ||
    fromRoute ||
    file.name.replace(/\.(gpx|tcx)$/i, "")
  );
}

// Raw <wpt> elements, in document order — the order matters downstream, where it
// breaks out-and-back ties that geometry alone can't.
export function parseWaypoints(xmlDoc) {
  return Array.from(xmlDoc.getElementsByTagName("wpt"))
    .map((el) => ({
      lat: parseFloat(el.getAttribute("lat")),
      lon: parseFloat(el.getAttribute("lon")),
      ele: childText(el, "ele") ? parseFloat(childText(el, "ele")) : null,
      name: childText(el, "name"),
      desc: childText(el, "desc"),
      sym: childText(el, "sym"),
      type: childText(el, "type"),
    }))
    .filter((w) => !isNaN(w.lat) && !isNaN(w.lon));
}

// Parse the file into a DOM. The parser is injectable so the module can be
// exercised outside a browser, where DOMParser doesn't exist.
async function readXml(file, { parser } = {}) {
  const text = await file.text();
  const dom = parser ?? new DOMParser();
  const xmlDoc = dom.parseFromString(text, "application/xml");
  if (xmlDoc.getElementsByTagName("parsererror").length) {
    throw new ParseError("errors.unreadableFile");
  }
  return xmlDoc;
}

// Track points, whichever way this file spells them. Some organisers publish a
// course as <rte>/<rtept> rather than a track; those points carry the same
// attributes, so the same mapper reads them.
function readTrackPoints(xmlDoc, file) {
  const isTcx =
    file.name.toLowerCase().endsWith(".tcx") ||
    xmlDoc.getElementsByTagName("TrainingCenterDatabase").length > 0;
  if (isTcx) return parseTcxPoints(xmlDoc);
  const trkpts = parseGpxPoints(xmlDoc, "trkpt");
  return trkpts.length >= 2 ? trkpts : parseGpxPoints(xmlDoc, "rtept");
}

function pointsToCumulativeDistance(points) {
  let cumM = 0;
  return points.map((p, i) => {
    if (i > 0) cumM += haversineMeters(points[i - 1].lat, points[i - 1].lon, p.lat, p.lon);
    return { ...p, cumKm: cumM / 1000 };
  });
}

// Total ascent over a noisy altitude trace.
//
// Summing every positive sample-to-sample delta — the obvious approach — measures
// the altimeter's noise rather than the course, and the error grows with the
// *sampling rate*, not the distance. On a 1 Hz recording of a course with 1000 m
// of real climbing, that sum reports roughly 8,000 m at ±1 m of noise and 28,000 m
// at ±4 m. Densely-recorded files are the worst affected, which is the opposite of
// what you'd expect.
//
// Two passes fix it. Smoothing over a fixed window of *travel* — not of samples,
// so a 1 Hz track and a sparse route file behave alike — removes per-sample
// jitter. A hysteresis threshold then ignores any excursion that never departs the
// last confirmed altitude by more than a few metres.
//
// The cost is real undulation below the noise floor: ripples of two or three
// metres are indistinguishable from altimeter drift and go uncounted. Every robust
// estimator makes that trade; the alternative is counting the drift as terrain.
const ELEV_SMOOTH_WINDOW_M = 60;
const ELEV_THRESHOLD_M = 3;

function elevationGainM(points) {
  const valid = points.filter((p) => p.ele != null && Number.isFinite(p.ele));
  if (valid.length < 2) return 0;

  // Centred moving average, as a two-pointer sweep over the distance window.
  const halfKm = ELEV_SMOOTH_WINDOW_M / 2000;
  const smoothed = [];
  let lo = 0;
  let hi = 0;
  let sum = 0;
  for (let i = 0; i < valid.length; i++) {
    while (hi < valid.length && valid[hi].cumKm <= valid[i].cumKm + halfKm) sum += valid[hi++].ele;
    while (valid[lo].cumKm < valid[i].cumKm - halfKm) sum -= valid[lo++].ele;
    smoothed.push(sum / (hi - lo));
  }

  // Only a departure of ELEV_THRESHOLD_M from the last confirmed altitude counts
  // as a real move, so jitter around a plateau contributes nothing.
  let gain = 0;
  let ref = smoothed[0];
  for (const e of smoothed) {
    if (Math.abs(e - ref) >= ELEV_THRESHOLD_M) {
      if (e > ref) gain += e - ref;
      ref = e;
    }
  }
  return Math.round(gain);
}

function resampleToKmSplits(points, intervalKm) {
  if (points.length < 2) return [];
  const hasTime = points.every((p) => p.time != null);
  const splits = [];
  let nextTarget = intervalKm;
  let lastSplitKm = 0;
  let lastSplitTime = points[0].time;

  for (let i = 1; i < points.length; i++) {
    if (points[i].cumKm >= nextTarget || i === points.length - 1) {
      const km = Math.round(points[i].cumKm * 10) / 10;
      const elevM = Number.isFinite(points[i].ele) ? Math.round(points[i].ele) : null;
      let pace = null;
      if (hasTime && points[i].time != null && lastSplitTime != null) {
        const segKm = points[i].cumKm - lastSplitKm;
        const segMin = (points[i].time - lastSplitTime) / 60000;
        if (segKm > 0) pace = Math.round((segMin / segKm) * 100) / 100;
      }
      splits.push({ km, pace, elevM, timeMs: points[i].time, lat: points[i].lat, lon: points[i].lon });
      lastSplitKm = points[i].cumKm;
      lastSplitTime = points[i].time;
      nextTarget = points[i].cumKm + intervalKm;
    }
  }
  return splits;
}

// Upper bound on track points kept for the course map. A raw GPX can carry tens
// of thousands of points; past ~1500 the extra detail is well below one screen
// pixel but still costs payload and Leaflet render time.
const MAX_PATH_POINTS = 1500;

// Perpendicular distance from p to the segment a→b, in degree-space scaled so
// longitude shrinks with latitude (good enough for a simplification metric over
// a single course's extent).
function perpDistance(p, a, b) {
  const kx = Math.cos((a.lat * Math.PI) / 180);
  const px = (p.lon - a.lon) * kx;
  const py = p.lat - a.lat;
  const bx = (b.lon - a.lon) * kx;
  const by = b.lat - a.lat;
  const lenSq = bx * bx + by * by;
  if (lenSq === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq));
  return Math.hypot(px - t * bx, py - t * by);
}

// Ramer–Douglas–Peucker. Chosen over a fixed stride because a stride cuts the
// corners off switchbacks — exactly the parts of a course worth seeing.
function rdpKeep(points, tolerance) {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (hi - lo < 2) continue;
    let worst = 0;
    let idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDistance(points[i], points[lo], points[hi]);
      if (d > worst) { worst = d; idx = i; }
    }
    if (idx !== -1 && worst > tolerance) {
      keep[idx] = 1;
      stack.push([lo, idx], [idx, hi]);
    }
  }
  return keep;
}

// The course geometry the map draws: [{ lat, lon, km }], simplified to the point
// budget while keeping cumulative distance on every retained point so segment
// boundaries (which are expressed in km) can be cut out of it.
export function buildCoursePath(points) {
  if (points.length < 2) return [];
  const toPoint = (p) => ({
    lat: Math.round(p.lat * 1e5) / 1e5, // ~1 m — finer than the map can show
    lon: Math.round(p.lon * 1e5) / 1e5,
    km: Math.round(p.cumKm * 1000) / 1000,
  });

  if (points.length <= MAX_PATH_POINTS) return points.map(toPoint);

  // Grow the tolerance until the simplified track fits the budget. Seeded from
  // the course's bounding box so it converges in a few passes at any scale.
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const extent = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons));
  let tolerance = extent / 20000 || 1e-6;
  let keep = rdpKeep(points, tolerance);
  let kept = keep.reduce((n, k) => n + k, 0);
  for (let pass = 0; kept > MAX_PATH_POINTS && pass < 12; pass++) {
    tolerance *= 1.8;
    keep = rdpKeep(points, tolerance);
    kept = keep.reduce((n, k) => n + k, 0);
  }
  return points.filter((_, i) => keep[i]).map(toPoint);
}

export async function parseRouteFile(file, sport, options) {
  const xmlDoc = await readXml(file, options);
  const rawPoints = readTrackPoints(xmlDoc, file);
  if (rawPoints.length < 2) throw new ParseError("errors.noTrackPoints");

  const points = pointsToCumulativeDistance(rawPoints);
  const totalKm = points[points.length - 1].cumKm;
  const intervalKm = splitIntervalKm(sport);
  const allSplits = resampleToKmSplits(points, intervalKm);

  const elevationGain = elevationGainM(points);

  const hasTime = rawPoints.every((p) => p.time != null);

  // Resolved against the full-resolution points, not buildCoursePath's output:
  // simplification drops vertices along straight runs, which would quantise every
  // station's kilometre to whatever happened to survive.
  const waypoints = resolveWaypoints(parseWaypoints(xmlDoc), points);

  return {
    name: readCourseName(xmlDoc, file),
    distanceKm: Math.round(totalKm * 100) / 100,
    elevationM: elevationGain,
    hasTime,
    splits: allSplits.filter((s) => s.km > 0),
    path: buildCoursePath(points),
    waypoints,
    startLat: rawPoints[0].lat,
    startLon: rawPoints[0].lon,
  };
}

export async function parseTrackFile(file, sport, options) {
  const xmlDoc = await readXml(file, options);
  const rawPoints = readTrackPoints(xmlDoc, file);

  if (rawPoints.length < 2) {
    throw new ParseError("errors.noTrackPoints");
  }

  const points = pointsToCumulativeDistance(rawPoints);
  const totalKm = points[points.length - 1].cumKm;
  const intervalKm = splitIntervalKm(sport);
  const splits = resampleToKmSplits(points, intervalKm);

  const hasTime = rawPoints.every((p) => p.time != null);
  let finishTime = "";
  if (hasTime) {
    finishTime = fmtClock((rawPoints[rawPoints.length - 1].time - rawPoints[0].time) / 60000);
  }

  const elevationGain = elevationGainM(points);

  return {
    name: readCourseName(xmlDoc, file),
    distanceKm: Math.round(totalKm * 100) / 100,
    elevationM: elevationGain,
    finishTime,
    splits: splits.filter((s) => s.pace != null && s.km > 0),
    hasTime,
    startLat: rawPoints[0].lat,
    startLon: rawPoints[0].lon,
    startTimeMs: rawPoints[0].time,
    endTimeMs: rawPoints[rawPoints.length - 1].time,
  };
}
