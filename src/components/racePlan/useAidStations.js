import { useState, useMemo } from "react";
import { isCyclingSport } from "../../constants.js";
import { MAX_PROMOTABLE } from "../../utils/waypoints.js";
import { uid, newStation, stationsFromParsed } from "./stations.js";

/*
  The aid-station list and every way it can change: typed rows, the course
  file's own stations, promoted waypoints, auto-spacing, and drags on the
  elevation profile. `P` is the plan-namespace translator, needed only for the
  replace-confirmation prompt.
*/
export default function useAidStations({ gpxData, sport, ultraByCourse, targetMinutes, P }) {
  const [aidStations, setAidStations] = useState([]);

  // Waypoints the file classified as aid stations, in the shape the form uses.
  // sanitizeAidStations already handles range-clipping, dedup and default naming,
  // so importing reuses the same validation an athlete's typing goes through.
  const fileStations = useMemo(() => stationsFromParsed(gpxData), [gpxData]);

  // Everything else in the file — cols, parking, viewpoints, and anything whose
  // naming we simply don't recognise. Offered for manual promotion rather than
  // dropped, so an organiser with an unusual vocabulary costs a click.
  const otherWaypoints = useMemo(() => {
    if (!gpxData?.waypoints) return [];
    return gpxData.waypoints
      .filter((w) => !w.isStation)
      .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
      .slice(0, MAX_PROMOTABLE);
  }, [gpxData]);

  function addStation() {
    setAidStations((prev) => [...prev, newStation({})]);
  }
  function updateStation(idx, patch) {
    setAidStations((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function removeStation(idx) {
    setAidStations((prev) => prev.filter((_, i) => i !== idx));
  }
  function autoSpaceStations() {
    if (!gpxData) return;
    const spacing = isCyclingSport(sport) ? 25 : 8;
    const next = [];
    for (let km = spacing; km < gpxData.distanceKm - 0.5; km += spacing) {
      next.push(newStation({ km: Math.round(km * 10) / 10 }));
    }
    // Seed plausible stop times on an ultra so the athlete edits numbers rather
    // than inventing them: 5 minutes normally, 15 once fatigue and real food
    // enter the picture. Estimated from the target pace, before any plan exists.
    if (ultraByCourse && targetMinutes > 0) {
      const perKm = targetMinutes / gpxData.distanceKm;
      for (const s of next) s.stopMinutes = s.km * perKm >= 480 ? 15 : 5;
    }
    setAidStations(next);
  }

  // Replace the list with what the file supplied. Guarded when the athlete has
  // already put work in — an import must never silently destroy typed input.
  function importFileStations() {
    if (fileStations.length === 0) return;
    if (aidStations.length > 0 && !window.confirm(P("form.waypoints.replaceConfirm", { count: fileStations.length, current: aidStations.length }))) return;
    setAidStations(fileStations.map((s) => ({ ...s, id: uid() })));
  }

  const isPromoted = (w) => aidStations.some((s) => Math.abs(parseFloat(s.km) - w.km) < 0.01);

  function togglePromoted(w) {
    setAidStations((prev) =>
      isPromoted(w)
        ? prev.filter((s) => Math.abs(parseFloat(s.km) - w.km) >= 0.01)
        : [...prev, newStation({ km: w.km, name: w.name || "" })].sort(
            (a, b) => (parseFloat(a.km) || 0) - (parseFloat(b.km) || 0)
          )
    );
  }

  // Profile-driven mutations (by station id), kept sorted by km for tidy rows.
  function addStationAtKm(km) {
    setAidStations((prev) => [...prev, newStation({ km })].sort((a, b) => (parseFloat(a.km) || 0) - (parseFloat(b.km) || 0)));
  }
  function moveStation(id, km) {
    setAidStations((prev) => prev.map((s) => (s.id === id ? { ...s, km } : s)));
  }
  function removeStationById(id) {
    setAidStations((prev) => prev.filter((s) => s.id !== id));
  }

  return {
    aidStations, setAidStations, fileStations, otherWaypoints,
    addStation, updateStation, removeStation, autoSpaceStations, importFileStations,
    isPromoted, togglePromoted, addStationAtKm, moveStation, removeStationById,
  };
}
