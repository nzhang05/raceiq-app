/*
  Aid-station records for the race-plan form: their shape, and how a parsed
  course file's waypoints become them. Pure — no React — so the form, its
  hooks and tests share one definition.
*/
import { sanitizeAidStations } from "../../utils/aidStations.js";

let stationSeq = 0;
export const uid = () => `as-${Date.now()}-${stationSeq++}`;

// One place defining a station's shape, so a row typed by hand and a row lifted
// out of a course file carry the same ultra fields (stop, sleep, cutoff, bag).
export const newStation = (patch) => ({
  id: uid(), km: "", name: "", water: true, food: true,
  stopMinutes: "", sleepMinutes: "", crewAccess: false, cutoff: "", dropBag: null,
  ...patch,
});

// Aid stations a parsed course file supplied, in the shape the form's station
// list uses. sanitizeAidStations already handles range-clipping, dedup and
// default naming, so an imported station goes through exactly the same
// validation as a typed one — the `ambiguous` flag is re-attached afterwards
// because sanitizing drops fields it doesn't know about.
export function stationsFromParsed(parsed) {
  if (!parsed?.waypoints) return [];
  const found = parsed.waypoints.filter((w) => w.isStation && w.km != null);
  const ambiguousKm = new Set(found.filter((w) => w.ambiguous).map((w) => w.km));
  return sanitizeAidStations(found, parsed.distanceKm).map((s) =>
    newStation({ ...s, ambiguous: ambiguousKm.has(s.km) })
  );
}

// The sentence appended to the import message about what the file's waypoints
// yielded. Stays silent when the file had none, so the common case reads exactly
// as it did before this feature existed.
// Takes `t` rather than returning prose: the counts drive plural selection, and
// English's "it/them" and "sits/sit" agreements have no bearing on French.
export function describeWaypointImport(t, parsed, stations, seeded) {
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const total = parsed.waypoints?.length ?? 0;
  if (total === 0) return "";

  if (stations.length === 0) return P("form.waypoints.foundNone", { count: total });

  const unsure = stations.filter((s) => s.ambiguous).length;
  const lead = P(seeded ? "form.waypoints.seeded" : "form.waypoints.offered", { count: stations.length });
  const caveat = unsure > 0 ? P("form.waypoints.ambiguousCaveat", { count: unsure }) : "";
  return lead + caveat;
}
