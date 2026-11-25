import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, SPORT_OPTIONS, isCyclingSport } from "../constants.js";
import { parseRouteFile } from "../utils/gpx.js";
import { MAX_PROMOTABLE } from "../utils/waypoints.js";
import { sanitizeAidStations } from "../utils/aidStations.js";
import { geocodeLocation } from "../utils/weather.js";
import { forecastWeather, estimateTargetTime, buildRacePlan, minutesToClock } from "../utils/racePlan.js";
import { fuelingBenchmarks, personalizeFueling } from "../utils/fueling.js";
import { parseClockToMinutes, fmtDate } from "../utils/time.js";
import { Field, TextInput, Select, FormSectionTitle, LocationAutocomplete, inputStyle } from "./ui.jsx";
import { fuelNoteText, errorText } from "../i18n/render.js";
import { suggestAllBags } from "../utils/dropBags.js";
import { isUltra } from "../utils/schedule.js";
import ElevationProfile from "./ElevationProfile.jsx";
import CourseMap from "./CourseMap.jsx";
import FuelItemPicker from "./FuelItemPicker.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { estimateFinishTime } from "../lib/coachApi.js";

let stationSeq = 0;
const uid = () => `as-${Date.now()}-${stationSeq++}`;

// One place defining a station's shape, so a row typed by hand and a row lifted
// out of a course file carry the same ultra fields (stop, sleep, cutoff, bag).
const newStation = (patch) => ({
  id: uid(), km: "", name: "", water: true, food: true,
  stopMinutes: "", sleepMinutes: "", crewAccess: false, cutoff: "", dropBag: null,
  ...patch,
});

// Aid stations a parsed course file supplied, in the shape the form's station
// list uses. sanitizeAidStations already handles range-clipping, dedup and
// default naming, so an imported station goes through exactly the same
// validation as a typed one — the `ambiguous` flag is re-attached afterwards
// because sanitizing drops fields it doesn't know about.
function stationsFromParsed(parsed) {
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
function describeWaypointImport(t, parsed, stations, seeded) {
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const total = parsed.waypoints?.length ?? 0;
  if (total === 0) return "";

  if (stations.length === 0) return P("form.waypoints.foundNone", { count: total });

  const unsure = stations.filter((s) => s.ambiguous).length;
  const lead = P(seeded ? "form.waypoints.seeded" : "form.waypoints.offered", { count: stations.length });
  const caveat = unsure > 0 ? P("form.waypoints.ambiguousCaveat", { count: unsure }) : "";
  return lead + caveat;
}

// Compact on/off pill used for the water / food refill flags on each aid station.
function StationToggle({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, fontWeight: 600,
        width: 42, padding: "5px 0", borderRadius: 3, cursor: "pointer",
        border: `1px solid ${on ? T.brassDim : T.line}`,
        background: on ? `${T.brass}1F` : "transparent",
        color: on ? T.brass : T.inkDim,
      }}
    >
      {on ? "YES" : "NO"}
    </button>
  );
}

// Small labelled number/text cell used inside the expanded station panel.
function MiniField({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.6, color: T.inkDim, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

/*
  One aid station.

  Collapsed it is the original compact row — km, name, water, food — so a road
  marathon sees exactly what it saw before. Expanding reveals the ultra fields:
  stop time, sleep, cutoff, crew access and the drop bag. Nine fields per station
  in a flat grid would be unusable; this keeps data entry proportional to the
  race being planned.
*/
function StationRow({ station, index, distanceKm, showUltra, expanded, onToggleExpand, onUpdate, onRemove, suggestions }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const kmNum = parseFloat(station.km);
  const outOfRange = distanceKm && !isNaN(kmNum) && (kmNum <= 0 || kmNum >= distanceKm);
  const bag = station.dropBag;
  // inputStyle is content-box; inside the panel's narrow columns that overflows,
  // so the panel's own inputs opt into border-box.
  const panelInput = { ...inputStyle, padding: "7px 8px", boxSizing: "border-box" };
  const cols = showUltra ? "70px 1fr auto auto auto 32px" : "80px 1fr auto auto 32px";

  // Compact summary of what's configured underneath, so the athlete can scan the
  // collapsed list and see where the long stops and the bags are.
  const badges = [
    station.stopMinutes > 0 ? P("form.ultra.badgeStop", { minutes: station.stopMinutes }) : null,
    station.sleepMinutes > 0 ? P("form.ultra.badgeSleep") : null,
    bag ? P("form.ultra.badgeBag") : null,
    station.crewAccess ? P("form.ultra.badgeCrew") : null,
    station.cutoff ? P("form.ultra.badgeCutoff", { cutoff: station.cutoff }) : null,
  ].filter(Boolean);

  function bumpBagItem(key, delta) {
    const items = { ...(bag?.items ?? {}) };
    items[key] = Math.max(0, (items[key] || 0) + delta);
    if (items[key] === 0) delete items[key];
    onUpdate({ dropBag: { ...(bag ?? { gear: [], notes: "" }), items } });
  }
  function updateGear(i, value) {
    const gear = [...(bag?.gear ?? [])];
    gear[i] = value;
    onUpdate({ dropBag: { ...bag, gear } });
  }
  function addGear(value = "") {
    onUpdate({ dropBag: { ...(bag ?? { items: {}, notes: "" }), gear: [...(bag?.gear ?? []), value] } });
  }
  function removeGear(i) {
    onUpdate({ dropBag: { ...bag, gear: (bag?.gear ?? []).filter((_, j) => j !== i) } });
  }
  function acceptSuggestion(s) {
    if (s.kind === "item") bumpBagItem(s.itemKey, s.qty);
    else addGear(P(s.key));
  }

  return (
    <div style={{ borderBottom: `1px solid ${T.line}33` }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 10, padding: "9px 12px", alignItems: "center" }}>
        <input
          type="number"
          value={station.km}
          // Editing the distance is the athlete resolving the ambiguity,
          // so the flag — and its warning border — retires with the edit.
          onChange={(e) => onUpdate({ km: e.target.value, ambiguous: false })}
          placeholder="km"
          title={station.ambiguous ? P("form.waypoints.ambiguousTitle") : ""}
          style={{ ...inputStyle, padding: "7px 8px", borderColor: outOfRange ? T.ember : station.ambiguous ? T.brass : T.line }}
        />
        <div>
          <input
            value={station.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={P("point.aid", { n: index + 1 })}
            style={{ ...inputStyle, padding: "7px 8px" }}
          />
          {showUltra && badges.length > 0 && !expanded && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {badges.map((b) => (
                <span key={b} style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.4, color: T.brass, background: "rgba(201,162,75,0.1)", borderRadius: 2, padding: "1px 5px" }}>{b}</span>
              ))}
            </div>
          )}
        </div>
        <StationToggle on={station.water} onClick={() => onUpdate({ water: !station.water })} />
        <StationToggle on={station.food} onClick={() => onUpdate({ food: !station.food })} />
        {showUltra && (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.5, padding: "6px 9px", borderRadius: 3, border: `1px solid ${expanded ? T.brassDim : T.line}`, background: "transparent", color: expanded ? T.brass : T.inkDim, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {expanded ? P("form.ultra.collapse") : P("form.ultra.expand")}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={P("form.removeStation")}
          style={{ background: "none", border: "none", color: T.ember, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 16, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      </div>

      {showUltra && expanded && (
        <div style={{ padding: "4px 12px 16px", background: "rgba(0,0,0,0.15)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            <MiniField label={P("form.ultra.stop")}>
              <input type="number" min="0" value={station.stopMinutes ?? ""} onChange={(e) => onUpdate({ stopMinutes: e.target.value })} placeholder="0" style={panelInput} />
            </MiniField>
            <MiniField label={P("form.ultra.sleep")}>
              <input type="number" min="0" value={station.sleepMinutes ?? ""} onChange={(e) => onUpdate({ sleepMinutes: e.target.value })} placeholder="0" style={panelInput} />
            </MiniField>
            <MiniField label={P("form.ultra.cutoff")}>
              <input value={station.cutoff ?? ""} onChange={(e) => onUpdate({ cutoff: e.target.value })} placeholder="HH:MM" style={panelInput} />
            </MiniField>
            <MiniField label={P("form.ultra.crew")}>
              <StationToggle on={station.crewAccess === true} onClick={() => onUpdate({ crewAccess: !station.crewAccess })} />
            </MiniField>
          </div>

          {station.sleepMinutes > 0 && station.sleepMinutes > (station.stopMinutes || 0) && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.ember, marginBottom: 12 }}>
              {P("form.ultra.sleepExceedsStop")}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: bag ? 12 : 0 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.6, color: T.inkDim }}>{P("form.ultra.dropBag")}</span>
            <StationToggle on={!!bag} onClick={() => onUpdate({ dropBag: bag ? null : { items: {}, gear: [], notes: "" } })} />
          </div>

          {bag && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
              <FuelItemPicker quantities={bag.items} onBump={bumpBagItem} dense />
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.6, color: T.inkDim, marginBottom: 6 }}>{P("form.ultra.gear")}</div>
                {(bag.gear ?? []).map((line, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input value={line} onChange={(e) => updateGear(i, e.target.value)} placeholder={P("form.ultra.gearPlaceholder")} style={{ ...panelInput, padding: "6px 8px", flex: 1, minWidth: 0 }} />
                    <button type="button" onClick={() => removeGear(i)} aria-label={P("form.ultra.removeGear")} style={{ background: "none", border: "none", color: T.ember, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 15, padding: 0 }}>×</button>
                  </div>
                ))}
                <button type="button" onClick={() => addGear()} style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.5, padding: "5px 9px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.ink, cursor: "pointer" }}>
                  {P("form.ultra.addGear")}
                </button>

                <input
                  value={bag.notes ?? ""}
                  onChange={(e) => onUpdate({ dropBag: { ...bag, notes: e.target.value } })}
                  placeholder={P("form.ultra.notesPlaceholder")}
                  style={{ ...panelInput, marginTop: 10 }}
                />

                {/* Derived suggestions — one tap to accept, never auto-inserted. */}
                {suggestions?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.6, color: T.inkDim, marginBottom: 6 }}>{P("form.ultra.suggested")}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => acceptSuggestion(s)}
                          title={s.values ? P(s.key, s.values) : ""}
                          style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.4, padding: "5px 9px", borderRadius: 3, border: `1px dashed ${T.brassDim}`, background: "transparent", color: T.brass, cursor: "pointer" }}
                        >
                          + {s.kind === "item" ? P("form.ultra.suggestItem", { qty: s.qty, item: P(`fuelItem.${s.itemKey}`) }) : P(s.key)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RacePlanForm({ allRaces, onPlanGenerated, onCancel }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const { user, profile } = useAuth();
  const [sport, setSport] = useState(SPORT_OPTIONS[0]);
  const [raceDate, setRaceDate] = useState(new Date().toISOString().slice(0, 10));
  const [gpxData, setGpxData] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState("");

  // Reference races
  const candidateRaces = useMemo(
    () => allRaces.filter((r) => r.sport === sport && r.finishTime && r.distanceKm > 0),
    [allRaces, sport]
  );
  const [selectedRaceIds, setSelectedRaceIds] = useState(() => new Set(allRaces.filter(r => r.sport === SPORT_OPTIONS[0] && r.finishTime && r.distanceKm > 0).map(r => r.id)));

  // When sport changes, select all candidates of the new sport
  useEffect(() => {
    setSelectedRaceIds(new Set(candidateRaces.map((r) => r.id)));
  }, [sport]);

  const selectedRaces = useMemo(
    () => candidateRaces.filter((r) => selectedRaceIds.has(r.id)),
    [candidateRaces, selectedRaceIds]
  );

  function toggleRace(id) {
    setSelectedRaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = candidateRaces.length > 0 && candidateRaces.every((r) => selectedRaceIds.has(r.id));

  function toggleAll() {
    if (allSelected) setSelectedRaceIds(new Set());
    else setSelectedRaceIds(new Set(candidateRaces.map((r) => r.id)));
  }

  // Weather
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [weatherStatus, setWeatherStatus] = useState(null);
  const [weatherMessage, setWeatherMessage] = useState("");
  const [tempC, setTempC] = useState("");
  const [humidity, setHumidity] = useState("");
  const [wind, setWind] = useState("");
  // Sunrise/sunset for the race date, from the same forecast call. Drives the
  // darkness markers; stays null when the lookup was skipped or unavailable.
  const [forecastSun, setForecastSun] = useState({ sunrise: null, sunset: null });

  // Target time
  const [targetClock, setTargetClock] = useState("");
  const [derivedClock, setDerivedClock] = useState("");
  const [derivedNote, setDerivedNote] = useState("");
  const [estimateSource, setEstimateSource] = useState(null); // null | "ai" | "fallback" | "loading"

  // Fueling — optional manual overrides. Blank = use the value RaceIQ derives from
  // the reference races (shown as the placeholder).
  const [fuelCarbs, setFuelCarbs] = useState("");
  const [fuelSodium, setFuelSodium] = useState("");
  const [fuelFluids, setFuelFluids] = useState("");
  const [fuelCaffeine, setFuelCaffeine] = useState("");

  // What RaceIQ would use with no manual input — drives the placeholders and the
  // per-field provenance hints below.
  const derivedFueling = useMemo(() => {
    const mins = parseClockToMinutes(targetClock);
    if (!mins) return null;
    const benchmark = fuelingBenchmarks(minutesToClock(mins));
    const t = tempC !== "" ? parseFloat(tempC) : 18;
    return personalizeFueling({ benchmark, history: selectedRaces, targetMinutes: mins, tempC: t, manual: {} });
  }, [targetClock, tempC, selectedRaces]);

  function fuelHint(metric) {
    if (!derivedFueling) return P("form.fuelHint.needTarget");
    const src = derivedFueling.sources[metric];
    if (src === "history") return P("form.fuelHint.history", { count: derivedFueling.basedOnRaces });
    return P("form.fuelHint.generic");
  }

  // Aid stations & carry capacity
  const [aidStations, setAidStations] = useState([]);
  const [carryCapacity, setCarryCapacity] = useState("");
  const [showOtherWaypoints, setShowOtherWaypoints] = useState(false);
  const [expandedStation, setExpandedStation] = useState(null);
  // Race start time-of-day. Without it there are no wall-clock ETAs, so the
  // whole schedule/crew-sheet layer stays switched off.
  const [startTime, setStartTime] = useState("");

  // Ultra fields show themselves for long races and hide behind a link for short
  // ones; `showUltraOverride` is the athlete pulling rank either way.
  const [showUltraOverride, setShowUltraOverride] = useState(null);
  const targetMinutes = useMemo(() => parseClockToMinutes(targetClock) || 0, [targetClock]);
  const ultraByCourse = isUltra(gpxData?.distanceKm, targetMinutes);
  const showUltra = showUltraOverride ?? ultraByCourse;

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

  // Generated point names (Start / Finish / Aid N) are rendered here rather than
  // inside the pure planning modules — see src/utils/aidStations.js.
  const pointLabels = useMemo(() => ({
    start: P("point.start"),
    finish: P("point.finish"),
    aid: (n) => P("point.aid", { n }),
  }), [t]);

  const carryCapacityMl = carryCapacity !== "" ? parseFloat(carryCapacity) : null;
  const manualFueling = useMemo(() => ({
    carbsPerHr: fuelCarbs !== "" ? parseFloat(fuelCarbs) : null,
    sodiumPerHr: fuelSodium !== "" ? parseFloat(fuelSodium) : null,
    fluidsPerHr: fuelFluids !== "" ? parseFloat(fuelFluids) : null,
    caffeineMg: fuelCaffeine !== "" ? parseFloat(fuelCaffeine) : null,
  }), [fuelCarbs, fuelSodium, fuelFluids, fuelCaffeine]);

  const plannedWeather = useMemo(() => ({
    tempC: parseFloat(tempC) || 18,
    humidity: parseFloat(humidity) || null,
    wind: parseFloat(wind) || null,
    sunrise: forecastSun.sunrise,
    sunset: forecastSun.sunset,
  }), [tempC, humidity, wind, forecastSun]);

  const racesForPlan = selectedRaces.length > 0 ? selectedRaces : allRaces;

  const planOptions = useMemo(() => ({
    aidStations,
    carryCapacityMl,
    manualFueling,
    pointLabels,
    startTimeOfDay: startTime || null,
  }), [aidStations, carryCapacityMl, manualFueling, pointLabels, startTime]);

  /*
    A throwaway plan built from what's on screen, purely to power the drop-bag
    suggestions. buildRacePlan is pure and does no I/O, so running it as the
    athlete edits is cheap — and it's the only way the editor can know that the
    leg out of Station 4 runs in the dark before the plan is built.
  */
  const bagSuggestions = useMemo(() => {
    if (!gpxData || !targetMinutes || !showUltra) return new Map();
    try {
      const preview = buildRacePlan(gpxData, sport, plannedWeather, targetMinutes, racesForPlan, planOptions);
      return suggestAllBags({
        stations: sanitizeAidStations(aidStations, gpxData.distanceKm, pointLabels),
        carryPlan: preview.carryPlan,
        schedule: preview.schedule,
      });
    } catch {
      return new Map();
    }
  }, [gpxData, targetMinutes, showUltra, sport, plannedWeather, racesForPlan, planOptions, aidStations, pointLabels]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!gpxData) return;
    const plannedTempC = tempC !== "" ? parseFloat(tempC) : 15;
    const weather = tempC !== "" ? { tempC: plannedTempC } : null;
    const racesForEstimate = selectedRaces.length > 0 ? selectedRaces : allRaces;

    function applyDeterministic() {
      const result = estimateTargetTime(gpxData, sport, weather, racesForEstimate);
      setDerivedClock(result.clock);
      setTargetClock(result.clock);
      if (selectedRaces.length === 0) {
        setDerivedNote(P("form.genericPaceNote", { pace: P(isCyclingSport(sport) ? "form.genericPaceRide" : "form.genericPaceRun") }));
      } else {
        const ref = [...selectedRaces].sort((a, b) => {
          const aPace = parseClockToMinutes(a.finishTime) / a.distanceKm;
          const bPace = parseClockToMinutes(b.finishTime) / b.distanceKm;
          return aPace - bPace;
        })[0];
        setDerivedNote(P("form.referenceNote", { name: ref.name, finishTime: ref.finishTime, refKm: ref.distanceKm, courseKm: gpxData.distanceKm }));
      }
      setEstimateSource("fallback");
    }

    // The AI estimate runs server-side (see api/claude.js) and needs a signed-in
    // athlete. Any failure — signed out, unconfigured, rate limited, offline —
    // falls back to the deterministic estimate rather than surfacing an error.
    if (user && selectedRaces.length > 0) {
      setEstimateSource("loading");
      setDerivedNote("");
      estimateFinishTime({
        course: gpxData,
        sport,
        tempC: plannedTempC,
        races: selectedRaces,
        isCycling: isCyclingSport(sport),
        profile,
      })
        .then(({ estimatedMinutes, reasoning }) => {
          setDerivedClock(minutesToClock(estimatedMinutes));
          setTargetClock(minutesToClock(estimatedMinutes));
          setDerivedNote(reasoning || "");
          setEstimateSource("ai");
        })
        .catch(() => applyDeterministic());
    } else {
      applyDeterministic();
    }
  }, [gpxData, sport, tempC, selectedRaces, user, profile]);

  async function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus("loading");
    setImportMessage("");
    setGpxData(null);
    try {
      const parsed = await parseRouteFile(file, sport);
      setGpxData(parsed);
      setShowOtherWaypoints(false);

      // Seed the station list only when there's nothing to lose. If the athlete
      // has already entered stations, the IMPORT button in Section 6 offers the
      // swap explicitly instead.
      const stations = stationsFromParsed(parsed);
      const seeded = stations.length > 0 && aidStations.length === 0;
      if (seeded) setAidStations(stations);

      setImportStatus("done");
      setImportMessage(
        P("form.loaded", { distanceKm: parsed.distanceKm, elevationM: parsed.elevationM }) +
          (!parsed.hasTime ? P("form.routeOnlyNote") : "") +
          describeWaypointImport(t, parsed, stations, seeded)
      );
    } catch (err) {
      setImportStatus("error");
      setImportMessage(errorText(t, err, "plan:form.parseError"));
    }
  }

  async function handleWeatherLookup() {
    if (!locationQuery.trim()) return;
    setWeatherStatus("loading");
    setWeatherMessage("");
    try {
      const place = selectedPlace ?? await geocodeLocation(locationQuery.trim());
      const forecast = await forecastWeather(place.lat, place.lon, raceDate);
      if (forecast.tempC != null) setTempC(String(forecast.tempC));
      if (forecast.humidity != null) setHumidity(String(forecast.humidity));
      if (forecast.wind != null) setWind(String(forecast.wind));
      setForecastSun({ sunrise: forecast.sunrise ?? null, sunset: forecast.sunset ?? null });
      if (forecast.simulated || place.simulated) {
        setWeatherStatus("simulated");
        setWeatherMessage(`SIMULATED — can't reach the forecast service from here; conditions are estimated.`);
      } else {
        setWeatherStatus("done");
        setWeatherMessage(P("form.forecastNote", {
          place: place.label,
          date: fmtDate(raceDate),
          tempC: forecast.tempC,
          windPart: forecast.wind != null ? P("form.forecastWindPart", { wind: forecast.wind }) : "",
        }));
      }
    } catch (err) {
      setWeatherStatus("error");
      setWeatherMessage(errorText(t, err, "plan:form.weatherError"));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!gpxData) { setError(P("form.errorNoCourse")); return; }
    if (!targetClock.trim()) { setError(P("form.errorNoTarget")); return; }
    setError("");
    setSubmitting(true);
    const plan = buildRacePlan(gpxData, sport, plannedWeather, parseClockToMinutes(targetClock), racesForPlan, planOptions);
    plan.raceDate = raceDate;
    onPlanGenerated(plan);
  }

  const statusColor = { done: T.green, simulated: T.brass, error: T.ember, loading: T.inkDim };
  const importColor = { done: T.green, error: T.ember, loading: T.inkDim };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 600, margin: "0 0 6px", color: T.paper }}>
          {P("form.title")}
        </h1>
        <p style={{ fontFamily: FONT_BODY, fontSize: 15, color: T.inkDim, margin: 0, lineHeight: 1.5 }}>
          {P("form.intro")}
        </p>
      </div>

      {/* Section 1 — Course */}
      <FormSectionTitle>{P("form.section.course")}</FormSectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label={P("form.sport")}>
          <Select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            options={SPORT_OPTIONS.map((v) => ({ value: v, label: t(`sport.${v}`) }))}
          />
        </Field>
        <Field label={P("form.raceDate")}>
          <input
            type="date"
            aria-label={P("form.raceDate")}
            value={raceDate}
            onChange={(e) => setRaceDate(e.target.value)}
            style={{ width: "100%", fontFamily: FONT_MONO, fontSize: 13, color: T.paper, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 3, padding: "9px 10px", outline: "none", colorScheme: "dark" }}
            onFocus={(e) => (e.target.style.borderColor = T.brass)}
            onBlur={(e) => (e.target.style.borderColor = T.line)}
          />
        </Field>
        <Field label={P("form.startTime")} hint={P("form.startTimeHint")}>
          <TextInput value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="e.g. 05:00" />
        </Field>
      </div>

      <Field label={P("form.upload")}>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "14px 16px", border: `1px dashed ${importStatus === "done" ? T.green : T.line}`, borderRadius: 4, background: T.bg2, transition: "border-color 150ms" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>{P("form.chooseFile")}</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: gpxData ? T.paper : T.inkDim }}>
            {gpxData ? gpxData.name : P("form.noFile")}
          </span>
          <input type="file" accept=".gpx,.tcx" onChange={handleFileImport} style={{ display: "none" }} />
        </label>
      </Field>

      {importMessage && (
        <div style={{ marginTop: 8, fontFamily: FONT_BODY, fontSize: 13, color: importColor[importStatus] ?? T.ink, lineHeight: 1.5 }}>
          {importMessage}
        </div>
      )}

      {gpxData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 }}>
          {[
            { label: P("form.stat.distance"), value: `${gpxData.distanceKm} km` },
            { label: P("form.stat.elevation"), value: `+${gpxData.elevationM}m` },
            { label: P("form.stat.profile"), value: P(`form.stat.${gpxData.elevationM > 500 ? "hilly" : gpxData.elevationM > 150 ? "rolling" : "flat"}`) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "10px 14px" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.inkDim, marginBottom: 4 }}>{label.toUpperCase()}</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Section 2 — Reference Races */}
      <FormSectionTitle>{P("form.section.referenceRaces")}</FormSectionTitle>

      {candidateRaces.length === 0 ? (
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, padding: "14px 0" }}>
          {P("form.noPastRaces", { sport: t(`sport.${sport}`) })}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim }}>
              {P("form.selectedCount", { selected: selectedRaces.length, total: candidateRaces.length })}
            </span>
            <button
              type="button"
              onClick={toggleAll}
              style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "5px 10px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.inkDim, cursor: "pointer" }}
            >
              {P(allSelected ? "form.deselectAll" : "form.selectAll")}
            </button>
          </div>

          <div style={{ border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
            {candidateRaces.map((race, i) => {
              const checked = selectedRaceIds.has(race.id);
              return (
                <div
                  key={race.id}
                  onClick={() => toggleRace(race.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "28px 1fr auto auto",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 14px",
                    cursor: "pointer",
                    background: checked ? `${T.brass}0D` : "transparent",
                    borderBottom: i < candidateRaces.length - 1 ? `1px solid ${T.line}` : "none",
                    transition: "background 100ms",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 2, border: `1.5px solid ${checked ? T.brass : T.inkDim}`,
                      background: checked ? T.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {checked && <span style={{ color: T.bg, fontSize: 11, lineHeight: 1, fontFamily: FONT_MONO }}>✓</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: checked ? T.paper : T.inkDim }}>{race.name}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 2 }}>{fmtDate(race.date)} · {race.distanceKm} km</div>
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: checked ? T.paper : T.inkDim, textAlign: "right" }}>
                    {race.finishTime}
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, textAlign: "right" }}>
                    {P("form.percentileShort", { pct: race.percentile })}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedRaces.length === 0 && (
            <div style={{ marginTop: 8, fontFamily: FONT_BODY, fontSize: 13, color: T.ember }}>
              {P("form.noneSelected")}
            </div>
          )}
        </>
      )}

      {/* Section 3 — Conditions */}
      <FormSectionTitle>{P("form.section.conditions")}</FormSectionTitle>

      <Field label={P("form.location")}>
        <div style={{ display: "flex", gap: 8 }}>
          <LocationAutocomplete
            value={locationQuery}
            onChange={(e) => { setLocationQuery(e.target.value); setSelectedPlace(null); }}
            onSelect={(place) => { setLocationQuery(place.label); setSelectedPlace(place); }}
            placeholder={P("form.locationPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleWeatherLookup())}
          />
          <button
            type="button"
            onClick={handleWeatherLookup}
            disabled={weatherStatus === "loading"}
            style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "9px 14px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.ink, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {weatherStatus === "loading" ? "..." : P("form.lookUp")}
          </button>
        </div>
      </Field>

      {weatherMessage && (
        <div style={{ marginTop: 6, marginBottom: 12, fontFamily: FONT_BODY, fontSize: 13, color: statusColor[weatherStatus] ?? T.ink, lineHeight: 1.5 }}>
          {weatherMessage}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 12 }}>
        <Field label={P("form.temp")}>
          <TextInput type="number" value={tempC} onChange={(e) => setTempC(e.target.value)} placeholder="e.g. 18" />
        </Field>
        <Field label={P("form.humidity")}>
          <TextInput type="number" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder="e.g. 60" />
        </Field>
        <Field label={P("form.wind")}>
          <TextInput type="number" value={wind} onChange={(e) => setWind(e.target.value)} placeholder="e.g. 10" />
        </Field>
      </div>

      {/* Section 4 — Target Time */}
      <FormSectionTitle>{P("form.section.targetTime")}</FormSectionTitle>

      {(derivedClock || estimateSource === "loading") && (
        <div style={{ background: T.bg2, border: `1px solid ${estimateSource === "ai" ? T.brassDim : T.line}`, borderRadius: 4, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.inkDim }}>{P("form.estimate")}</span>
            {estimateSource === "ai" && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.brass, background: `${T.brass}1F`, border: `1px solid ${T.brassDim}`, borderRadius: 2, padding: "1px 6px" }}>{P("form.estimateAi")}</span>
            )}
            {estimateSource === "loading" && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>{P("form.estimateThinking")}</span>
            )}
          </div>
          {estimateSource === "loading"
            ? <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: T.inkDim }}>—</div>
            : <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: T.brass }}>{derivedClock}</div>
          }
          {derivedNote && estimateSource !== "loading" && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim, marginTop: 6, lineHeight: 1.5 }}>{derivedNote}</div>
          )}
        </div>
      )}

      <Field label={P("form.targetLabel")} hint={P("form.targetHint")}>
        <TextInput
          value={targetClock}
          onChange={(e) => setTargetClock(e.target.value)}
          placeholder={P("form.targetPlaceholder")}
        />
      </Field>

      {/* Section 5 — Fueling */}
      <FormSectionTitle>{P("form.section.fueling")}</FormSectionTitle>

      <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 14px", lineHeight: 1.5 }}>
        {P("form.fuelingIntro", {
          defaultsPart: derivedFueling?.basedOnRaces ? "" : P("form.fuelingIntroDefaults"),
        })}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label={P("form.carbs")} hint={fuelHint("carbs")}>
          <TextInput type="number" value={fuelCarbs} onChange={(e) => setFuelCarbs(e.target.value)} placeholder={derivedFueling?.carbsTargetNum != null ? String(derivedFueling.carbsTargetNum) : "—"} />
        </Field>
        <Field label={P("form.sodium")} hint={fuelHint("sodium")}>
          <TextInput type="number" value={fuelSodium} onChange={(e) => setFuelSodium(e.target.value)} placeholder={derivedFueling?.sodiumMgHr != null ? String(derivedFueling.sodiumMgHr) : "—"} />
        </Field>
        <Field label={P("form.fluids")} hint={fuelHint("fluids")}>
          <TextInput type="number" value={fuelFluids} onChange={(e) => setFuelFluids(e.target.value)} placeholder={derivedFueling?.fluidsMlHr != null ? String(derivedFueling.fluidsMlHr) : "—"} />
        </Field>
        <Field label={P("form.caffeine")} hint={fuelHint("caffeine")}>
          <TextInput type="number" value={fuelCaffeine} onChange={(e) => setFuelCaffeine(e.target.value)} placeholder={derivedFueling?.caffeineMg != null ? String(derivedFueling.caffeineMg) : "—"} />
        </Field>
      </div>

      {derivedFueling?.notes?.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {derivedFueling.notes.map((note, i) => (
            <div key={i} style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.brass, lineHeight: 1.45 }}>{fuelNoteText(t, note)}</div>
          ))}
        </div>
      )}

      {/* Section 6 — Aid Stations */}
      <FormSectionTitle>{P("form.section.aidStations")}</FormSectionTitle>

      <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 14px", lineHeight: 1.5 }}>
        {P("form.aidIntro")}
      </p>

      {gpxData ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
          {/* Segments repaint live as stations are placed on the profile below. */}
          <CourseMap
            path={gpxData.path}
            distanceKm={gpxData.distanceKm}
            stations={aidStations}
            height={260}
          />
          <ElevationProfile
            splits={gpxData.splits}
            distanceKm={gpxData.distanceKm}
            elevationM={gpxData.elevationM}
            stations={aidStations}
            onAdd={addStationAtKm}
            onMove={moveStation}
            onRemove={removeStationById}
            colorByGradient
          />
        </div>
      ) : (
        <div style={{ marginBottom: 14, fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim }}>
          {P("form.aidNoCourse")}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={addStation}
          style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "7px 12px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.ink, cursor: "pointer" }}
        >
          {P("form.addStation")}
        </button>
        {fileStations.length > 0 && (
          <button
            type="button"
            onClick={importFileStations}
            title={P("form.waypoints.importTitle")}
            style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "7px 12px", borderRadius: 3, border: `1px solid ${T.brassDim}`, background: `${T.brass}1F`, color: T.brass, cursor: "pointer" }}
          >
            {P("form.waypoints.importButton", { count: fileStations.length })}
          </button>
        )}
        <button
          type="button"
          onClick={autoSpaceStations}
          disabled={!gpxData}
          title={P(gpxData ? "form.waypoints.autoSpaceTitle" : "form.autoSpaceDisabled")}
          style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "7px 12px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: gpxData ? T.ink : T.inkDim, cursor: gpxData ? "pointer" : "not-allowed" }}
        >
          {P("form.autoSpace")}
        </button>
      </div>

      {otherWaypoints.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setShowOtherWaypoints((v) => !v)}
            style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: 0, border: "none", background: "none", color: T.inkDim, cursor: "pointer" }}
          >
            {showOtherWaypoints ? "▾" : "▸"} {P("form.waypoints.otherToggle", { count: otherWaypoints.length })}
          </button>

          {showOtherWaypoints && (
            <div style={{ marginTop: 10, border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim, lineHeight: 1.45 }}>
                {P("form.waypoints.otherIntro")}
              </div>
              {otherWaypoints.map((w, i) => {
                const offCourse = w.km == null;
                return (
                  <label
                    key={i}
                    style={{ display: "grid", gridTemplateColumns: "24px 70px 1fr", gap: 10, padding: "8px 12px", alignItems: "center", cursor: offCourse ? "default" : "pointer", borderBottom: i < otherWaypoints.length - 1 ? `1px solid ${T.line}33` : "none" }}
                  >
                    <input
                      type="checkbox"
                      disabled={offCourse}
                      checked={!offCourse && isPromoted(w)}
                      onChange={() => togglePromoted(w)}
                      style={{ accentColor: T.brass, cursor: offCourse ? "default" : "pointer" }}
                    />
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: offCourse ? T.inkDim : T.ink }}>
                      {offCourse ? "—" : `${w.km} km`}
                    </span>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: offCourse ? T.inkDim : T.paper }}>
                      {w.name || P("form.waypoints.unnamed")}
                      {offCourse && (
                        <span style={{ color: T.inkDim }}>
                          {P("form.waypoints.offCourse", {
                            distancePart: w.distanceFromCourseM != null
                              ? P("form.waypoints.offCourseDistance", { m: w.distanceFromCourseM })
                              : "",
                          })}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {aidStations.length > 0 && (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: showUltra ? "70px 1fr auto auto auto 32px" : "80px 1fr auto auto 32px", gap: 10, padding: "9px 12px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.6, color: T.inkDim }}>
            <div>{P("form.colKm")}</div><div>{P("form.colName")}</div><div>{P("form.colWater")}</div><div>{P("form.colFood")}</div>{showUltra && <div>{P("form.colUltra")}</div>}<div />
          </div>
          {aidStations.map((station, i) => (
            <StationRow
              key={station.id ?? i}
              station={station}
              index={i}
              distanceKm={gpxData?.distanceKm}
              showUltra={showUltra}
              expanded={expandedStation === (station.id ?? i)}
              onToggleExpand={() => setExpandedStation((prev) => (prev === (station.id ?? i) ? null : station.id ?? i))}
              onUpdate={(patch) => updateStation(i, patch)}
              onRemove={() => removeStation(i)}
              suggestions={bagSuggestions.get(Math.round((parseFloat(station.km) || 0) * 100) / 100)}
            />
          ))}
        </div>
      )}

      {/* Ultra options are shown by default past 50 km / 6 h and revealed by
          hand otherwise — never hard-gated on distance. */}
      {aidStations.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setShowUltraOverride(!showUltra)}
            style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.5, padding: 0, border: "none", background: "none", color: T.inkDim, cursor: "pointer", textDecoration: "underline" }}
          >
            {P(showUltra ? "form.ultra.hide" : "form.ultra.show")}
          </button>
          {showUltra && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim, marginTop: 8, lineHeight: 1.5 }}>
              {P(startTime ? "form.ultra.intro" : "form.ultra.introNoStart")}
            </div>
          )}
        </div>
      )}

      {aidStations.length > 0 && (
        <div style={{ maxWidth: 220 }}>
          <Field label={P("form.carryCapacity")} hint={P("form.carryCapacityHint")}>
            <TextInput type="number" value={carryCapacity} onChange={(e) => setCarryCapacity(e.target.value)} placeholder={P("form.carryCapacityPlaceholder")} />
          </Field>
        </div>
      )}

      {error && <div style={{ marginTop: 12, fontFamily: FONT_BODY, fontSize: 14, color: T.ember }}>{error}</div>}

      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
        <button
          type="submit"
          disabled={submitting || !gpxData}
          style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, fontWeight: 600, padding: "11px 24px", borderRadius: 3, border: "none", background: gpxData ? T.brass : T.bg2, color: gpxData ? T.bg : T.inkDim, cursor: gpxData ? "pointer" : "not-allowed" }}
        >
          {submitting ? P("form.building") : P("form.build")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "11px 18px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.inkDim, cursor: "pointer" }}
        >
          CANCEL
        </button>
      </div>
    </form>
  );
}
