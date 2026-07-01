import { isCyclingSport } from "../constants.js";

const EARTH_RADIUS_M = 6371000;

// Chart/split sampling cadence: running races get a point every km,
// cycling races every 5 km (cycling covers far more ground, so 1 km
// splits would crowd the analysis chart with little added signal).
export function splitIntervalKm(sport) {
  return isCyclingSport(sport) ? 5 : 1;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function parseGpxPoints(xmlDoc) {
  const trkpts = Array.from(xmlDoc.getElementsByTagName("trkpt"));
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

function pointsToCumulativeDistance(points) {
  let cumM = 0;
  return points.map((p, i) => {
    if (i > 0) cumM += haversineMeters(points[i - 1].lat, points[i - 1].lon, p.lat, p.lon);
    return { ...p, cumKm: cumM / 1000 };
  });
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
      const elevM = points[i].ele != null ? Math.round(points[i].ele) : null;
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

export async function parseRouteFile(file, sport) {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "application/xml");
  if (xmlDoc.getElementsByTagName("parsererror").length) {
    throw new Error("Could not read this file — make sure it's a valid GPX or TCX export.");
  }
  const isTcx = file.name.toLowerCase().endsWith(".tcx") || xmlDoc.getElementsByTagName("TrainingCenterDatabase").length > 0;
  const rawPoints = isTcx ? parseTcxPoints(xmlDoc) : parseGpxPoints(xmlDoc);
  if (rawPoints.length < 2) throw new Error("No track points found in this file.");

  const points = pointsToCumulativeDistance(rawPoints);
  const totalKm = points[points.length - 1].cumKm;
  const intervalKm = splitIntervalKm(sport);
  const allSplits = resampleToKmSplits(points, intervalKm);

  const elevations = points.map((p) => p.ele).filter((e) => e != null);
  let elevationGain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) elevationGain += diff;
  }

  const nameEl = xmlDoc.getElementsByTagName("name")[0];
  const name = nameEl?.textContent?.trim() || file.name.replace(/\.(gpx|tcx)$/i, "");
  const hasTime = rawPoints.every((p) => p.time != null);

  return {
    name,
    distanceKm: Math.round(totalKm * 100) / 100,
    elevationM: Math.round(elevationGain),
    hasTime,
    splits: allSplits.filter((s) => s.km > 0),
    startLat: rawPoints[0].lat,
    startLon: rawPoints[0].lon,
  };
}

export async function parseTrackFile(file, sport) {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "application/xml");
  if (xmlDoc.getElementsByTagName("parsererror").length) {
    throw new Error("Could not read this file — make sure it's a valid GPX or TCX export.");
  }

  const isTcx = file.name.toLowerCase().endsWith(".tcx") || xmlDoc.getElementsByTagName("TrainingCenterDatabase").length > 0;
  const rawPoints = isTcx ? parseTcxPoints(xmlDoc) : parseGpxPoints(xmlDoc);

  if (rawPoints.length < 2) {
    throw new Error("No track points found in this file.");
  }

  const points = pointsToCumulativeDistance(rawPoints);
  const totalKm = points[points.length - 1].cumKm;
  const intervalKm = splitIntervalKm(sport);
  const splits = resampleToKmSplits(points, intervalKm);

  const hasTime = rawPoints.every((p) => p.time != null);
  let finishTime = "";
  if (hasTime) {
    const totalMin = (rawPoints[rawPoints.length - 1].time - rawPoints[0].time) / 60000;
    const h = Math.floor(totalMin / 60);
    const m = Math.floor(totalMin % 60);
    const s = Math.round((totalMin * 60) % 60);
    finishTime = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  const elevations = points.map((p) => p.ele).filter((e) => e != null);
  let elevationGain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) elevationGain += diff;
  }

  const nameEl = xmlDoc.getElementsByTagName("name")[0];
  const name = nameEl?.textContent?.trim() || file.name.replace(/\.(gpx|tcx)$/i, "");

  return {
    name,
    distanceKm: Math.round(totalKm * 100) / 100,
    elevationM: Math.round(elevationGain),
    finishTime,
    splits: splits.filter((s) => s.pace != null && s.km > 0),
    hasTime,
    startLat: rawPoints[0].lat,
    startLon: rawPoints[0].lon,
    startTimeMs: rawPoints[0].time,
    endTimeMs: rawPoints[rawPoints.length - 1].time,
  };
}
