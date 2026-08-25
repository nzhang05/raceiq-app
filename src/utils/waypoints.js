// Turning GPX waypoints into aid stations.
//
// A course file marks aid stations as <wpt> elements carrying a position, a name
// and sometimes a description — never a distance. Two things have to happen before
// they can seed the plan form: each waypoint has to be resolved to a kilometre on
// the course, and it has to be sorted from the parking lots, cols and photo spots
// that share the same element type.
//
// Everything here is pure — no DOM — so it runs under plain Node in tests. The
// <wpt> extraction itself lives in gpx.js.

import { haversineMeters } from "./geo.js";

// A waypoint further than this from the course isn't a course feature: it's the
// start-village parking, the hotel, the bag drop. Loose enough to survive an
// organiser pinning a station to the building rather than the road.
const SNAP_M = 150;

// Two near-approaches closer together than this are the same place seen twice
// (adjacent segments), not a genuine out-and-back ambiguity.
const AMBIGUITY_MIN_KM_APART = 2;

// How far an organiser's stated distance may sit from our haversine-derived one
// before we stop believing it names this waypoint. GPS-summed distance routinely
// runs a percent or two under the official measure over an ultra.
const HINT_TOLERANCE_KM = 3;

// Accent- and case-insensitive form, so `Ravitaillement` and `ravitaillement`
// and `RAVITO` all collapse to one comparable string.
export function normalizeText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// An explicit distance stated by the organiser: "km 8.2", "8,2 km", "KM8".
// Returns kilometres, or null. Deliberately narrow — it must not fire on a
// cutoff time ("19h30") or an altitude ("1200m").
export function parseKmHint(text) {
  const s = normalizeText(text);
  const m =
    s.match(/(\d+(?:[.,]\d+)?)\s*km\b/) ||      // "8.2 km"
    s.match(/\bkm\s*[.:]?\s*(\d+(?:[.,]\d+)?)/); // "km 8.2", "KM8"
  if (!m) return null;
  const km = parseFloat(m[1].replace(",", "."));
  return isNaN(km) ? null : km;
}

// Whole-token match, so `cp` hits "CP3" and "CP 3" but not "Alpcross".
function hasToken(haystack, token) {
  return new RegExp(`(?:^|[^a-z0-9])${token}(?:[^a-z0-9]|$)`).test(haystack);
}

const FULL_AID = [
  "aid station", "aid", "ravitaillement", "ravito", "feed zone", "feed",
  "refreshment", "checkpoint", "check point", "base vie", "refuge",
];
const WATER_ONLY = [
  "water only", "water", "point d'eau", "point deau", "eau", "fontaine",
  "spring", "source",
];
const NOT_A_STATION = [
  "parking", "navette", "shuttle", "depart", "start", "arrivee", "finish",
  "hotel", "gare", "viewpoint", "photo", "summit", "sommet", "col",
];

const matchesAny = (hay, list) => list.some((k) => (k.length <= 3 ? hasToken(hay, k) : hay.includes(k)));

// Classify a waypoint into { isStation, water, food, confidence }.
//
// Two ordering subtleties, both learned from real files:
//
// - Water-only is judged from the *name and symbol only*, not the description.
//   A full aid station's description routinely reads "eau, sucré, salé", and
//   matching that would demote it to water-only — the exact opposite of what it
//   says. But a waypoint *named* "Point d'eau" is water-only regardless of what
//   its description mentions.
// - An exclusion never beats a positive aid match. Plenty of real stations sit on
//   a col and are named for it ("Ravito Col de la Forclaz"); the terrain word is
//   only evidence of a terrain marker when nothing else identifies the waypoint.
export function classifyWaypoint(wpt) {
  const nameSym = normalizeText(`${wpt.name || ""} ${wpt.sym || ""} ${wpt.type || ""}`);
  const all = `${nameSym} ${normalizeText(wpt.desc)}`;

  const nameWater = matchesAny(nameSym, WATER_ONLY);
  const nameAid = matchesAny(nameSym, FULL_AID);

  if (nameWater && !nameAid) {
    return { isStation: true, water: true, food: false, confidence: "keyword" };
  }
  if (matchesAny(all, FULL_AID)) {
    return { isStation: true, water: true, food: true, confidence: "keyword" };
  }
  if (matchesAny(all, WATER_ONLY)) {
    return { isStation: true, water: true, food: false, confidence: "keyword" };
  }
  if (matchesAny(all, NOT_A_STATION)) {
    return { isStation: false, water: false, food: false, confidence: "keyword" };
  }
  return { isStation: false, water: false, food: false, confidence: "unknown" };
}

// Closest point on segment a→b to p, as { km, distM }. Works in degree space
// scaled so longitude shrinks with latitude to find the projection parameter,
// then measures the real distance on the sphere.
function projectOntoSegment(p, a, b) {
  const kx = Math.cos((a.lat * Math.PI) / 180);
  const ax = a.lon * kx, ay = a.lat;
  const bx = b.lon * kx, by = b.lat;
  const px = p.lon * kx, py = p.lat;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const lat = a.lat + t * (b.lat - a.lat);
  const lon = a.lon + t * (b.lon - a.lon);
  return {
    km: a.cumKm + t * (b.cumKm - a.cumKm),
    distM: haversineMeters(p.lat, p.lon, lat, lon),
  };
}

// Every distinct place on the course this waypoint comes near, best first. On a
// simple course that's one entry; on an out-and-back or a lollipop it's two or
// more, and picking between them is the caller's problem.
function nearApproaches(wpt, points) {
  const perSegment = [];
  for (let i = 1; i < points.length; i++) {
    perSegment.push(projectOntoSegment(wpt, points[i - 1], points[i]));
  }
  if (perSegment.length === 0) return [];

  // Local minima of the distance-along-course curve.
  const minima = [];
  for (let i = 0; i < perSegment.length; i++) {
    const prev = perSegment[i - 1]?.distM ?? Infinity;
    const next = perSegment[i + 1]?.distM ?? Infinity;
    if (perSegment[i].distM <= prev && perSegment[i].distM <= next) minima.push(perSegment[i]);
  }

  // Collapse minima that describe the same place, keep the best of each cluster.
  const sorted = minima.filter((m) => m.distM <= SNAP_M).sort((a, b) => a.distM - b.distM);
  const distinct = [];
  for (const m of sorted) {
    if (!distinct.some((d) => Math.abs(d.km - m.km) < AMBIGUITY_MIN_KM_APART)) distinct.push(m);
  }
  return distinct;
}

// Resolve every waypoint to a course kilometre and a classification.
//
// `points` is the full-resolution track — [{ lat, lon, cumKm }] — deliberately
// not the simplified render path, whose dropped vertices would quantise the
// result to whatever survived simplification.
//
// Waypoints are processed in document order because that order carries signal:
// organisers list stations along the course, so it breaks out-and-back ties that
// geometry alone can't.
export function resolveWaypoints(rawWaypoints, points) {
  let lastKm = 0;

  return (rawWaypoints || []).map((wpt) => {
    const classification = classifyWaypoint(wpt);
    const candidates = points.length >= 2 ? nearApproaches(wpt, points) : [];

    const base = {
      name: wpt.name || "",
      desc: wpt.desc || "",
      sym: wpt.sym || "",
      ...classification,
      km: null,
      distanceFromCourseM: null,
      ambiguous: false,
    };

    if (candidates.length === 0) {
      // Report how far off-course it was, for the "not on this course" message.
      const nearest = points.length >= 2
        ? points.reduce((best, p) => Math.min(best, haversineMeters(wpt.lat, wpt.lon, p.lat, p.lon)), Infinity)
        : null;
      return { ...base, distanceFromCourseM: nearest === Infinity ? null : Math.round(nearest) };
    }

    const hint = parseKmHint(`${wpt.name || ""} ${wpt.desc || ""}`);
    let chosen = candidates[0];
    let confidence = classification.confidence;
    let ambiguous = false;

    if (hint != null && candidates.some((c) => Math.abs(c.km - hint) <= HINT_TOLERANCE_KM)) {
      // The organiser stated the distance and it corroborates a real approach.
      // Their number is what the athlete will see in the roadbook, so use it.
      chosen = { ...candidates.reduce((a, b) => (Math.abs(a.km - hint) <= Math.abs(b.km - hint) ? a : b)), km: hint };
      confidence = "explicit";
    } else if (candidates.length > 1) {
      const forward = candidates.filter((c) => c.km >= lastKm).sort((a, b) => a.km - b.km);
      if (forward.length > 0) {
        chosen = forward[0];
      } else {
        ambiguous = true;
      }
    }

    lastKm = Math.max(lastKm, chosen.km);

    return {
      ...base,
      km: Math.round(chosen.km * 100) / 100,
      distanceFromCourseM: Math.round(chosen.distM),
      confidence,
      ambiguous,
    };
  });
}

// The most stations we'll offer for promotion in the UI. Some Komoot exports
// carry hundreds of waypoints; classification still runs on all of them.
export const MAX_PROMOTABLE = 50;
