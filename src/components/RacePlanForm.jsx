import { useState, useEffect, useMemo } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, SPORT_OPTIONS, isCyclingSport } from "../constants.js";
import { parseRouteFile } from "../utils/gpx.js";
import { geocodeLocation } from "../utils/weather.js";
import { forecastWeather, estimateTargetTime, buildRacePlan, minutesToClock } from "../utils/racePlan.js";
import { fuelingBenchmarks, personalizeFueling } from "../utils/fueling.js";
import { parseClockToMinutes, fmtDate } from "../utils/time.js";
import { Field, TextInput, Select, FormSectionTitle, LocationAutocomplete, inputStyle } from "./ui.jsx";
import ElevationProfile from "./ElevationProfile.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { estimateFinishTime } from "../lib/coachApi.js";

let stationSeq = 0;
const uid = () => `as-${Date.now()}-${stationSeq++}`;

// Compact on/off pill used for the water / food refill flags on each aid station.
function StationToggle({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.5, fontWeight: 600,
        width: 42, padding: "5px 0", borderRadius: 3, cursor: "pointer",
        border: `1px solid ${on ? T.brassDim : T.line}`,
        background: on ? "rgba(201,162,75,0.12)" : "transparent",
        color: on ? T.brass : T.inkDim,
      }}
    >
      {on ? "YES" : "NO"}
    </button>
  );
}

export default function RacePlanForm({ allRaces, onPlanGenerated, onCancel }) {
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
    if (!derivedFueling) return "Enter a target time to derive this.";
    const src = derivedFueling.sources[metric];
    if (src === "history") return `Your average across ${derivedFueling.basedOnRaces} reference race${derivedFueling.basedOnRaces === 1 ? "" : "s"}.`;
    return "Research default — no history to draw from.";
  }

  // Aid stations & carry capacity
  const [aidStations, setAidStations] = useState([]);
  const [carryCapacity, setCarryCapacity] = useState("");

  function addStation() {
    setAidStations((prev) => [...prev, { id: uid(), km: "", name: "", water: true, food: true }]);
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
      next.push({ id: uid(), km: Math.round(km * 10) / 10, name: "", water: true, food: true });
    }
    setAidStations(next);
  }

  // Profile-driven mutations (by station id), kept sorted by km for tidy rows.
  function addStationAtKm(km) {
    setAidStations((prev) => [...prev, { id: uid(), km, name: "", water: true, food: true }].sort((a, b) => (parseFloat(a.km) || 0) - (parseFloat(b.km) || 0)));
  }
  function moveStation(id, km) {
    setAidStations((prev) => prev.map((s) => (s.id === id ? { ...s, km } : s)));
  }
  function removeStationById(id) {
    setAidStations((prev) => prev.filter((s) => s.id !== id));
  }

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
        setDerivedNote(`No races selected — using a generic pace of ${isCyclingSport(sport) ? "25 km/h" : "5:00/km"}.`);
      } else {
        const ref = [...selectedRaces].sort((a, b) => {
          const aPace = parseClockToMinutes(a.finishTime) / a.distanceKm;
          const bPace = parseClockToMinutes(b.finishTime) / b.distanceKm;
          return aPace - bPace;
        })[0];
        setDerivedNote(`Based on your best selected result: ${ref.name} (${ref.finishTime} over ${ref.distanceKm} km), scaled to ${gpxData.distanceKm} km.`);
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
      setImportStatus("done");
      setImportMessage(
        `Loaded ${parsed.distanceKm} km course with ${parsed.elevationM}m elevation gain.` +
          (!parsed.hasTime ? " Route-only file (no timestamps) — pacing will use flat distribution." : "")
      );
    } catch (err) {
      setImportStatus("error");
      setImportMessage(err.message || "Could not parse this file.");
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
      if (forecast.simulated || place.simulated) {
        setWeatherStatus("simulated");
        setWeatherMessage(`SIMULATED — can't reach the forecast service from here; conditions are estimated.`);
      } else {
        setWeatherStatus("done");
        setWeatherMessage(`Forecast for ${place.label} on ${fmtDate(raceDate)}: ${forecast.tempC}°C${forecast.wind != null ? `, ${forecast.wind} km/h wind` : ""}. Adjust below if needed.`);
      }
    } catch (err) {
      setWeatherStatus("error");
      setWeatherMessage(err.message || "Couldn't look up weather — enter conditions manually below.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!gpxData) { setError("Upload a GPX file first."); return; }
    if (!targetClock.trim()) { setError("Enter a target time."); return; }
    setError("");
    setSubmitting(true);
    const targetMinutes = parseClockToMinutes(targetClock);
    const weather = { tempC: parseFloat(tempC) || 18, humidity: parseFloat(humidity) || null, wind: parseFloat(wind) || null };
    const racesForPlan = selectedRaces.length > 0 ? selectedRaces : allRaces;
    const carryCapacityMl = carryCapacity !== "" ? parseFloat(carryCapacity) : null;
    const manualFueling = {
      carbsPerHr: fuelCarbs !== "" ? parseFloat(fuelCarbs) : null,
      sodiumPerHr: fuelSodium !== "" ? parseFloat(fuelSodium) : null,
      fluidsPerHr: fuelFluids !== "" ? parseFloat(fuelFluids) : null,
      caffeineMg: fuelCaffeine !== "" ? parseFloat(fuelCaffeine) : null,
    };
    const plan = buildRacePlan(gpxData, sport, weather, targetMinutes, racesForPlan, aidStations, carryCapacityMl, manualFueling);
    plan.raceDate = raceDate;
    onPlanGenerated(plan);
  }

  const statusColor = { done: T.green, simulated: T.brass, error: T.ember, loading: T.inkDim };
  const importColor = { done: T.green, error: T.ember, loading: T.inkDim };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 600, margin: "0 0 6px", color: T.paper }}>
          Plan a Race
        </h1>
        <p style={{ fontFamily: FONT_BODY, fontSize: 15, color: T.inkDim, margin: 0, lineHeight: 1.5 }}>
          Upload your course GPX to get a personalised pacing strategy, nutrition targets, and tactical tips derived from your past results.
        </p>
      </div>

      {/* Section 1 — Course */}
      <FormSectionTitle>1 — Course</FormSectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Sport">
          <Select value={sport} onChange={(e) => setSport(e.target.value)} options={SPORT_OPTIONS} />
        </Field>
        <Field label="Race Date">
          <input
            type="date"
            value={raceDate}
            onChange={(e) => setRaceDate(e.target.value)}
            style={{ width: "100%", fontFamily: FONT_MONO, fontSize: 13, color: T.paper, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 3, padding: "9px 10px", outline: "none", colorScheme: "dark" }}
            onFocus={(e) => (e.target.style.borderColor = T.brass)}
            onBlur={(e) => (e.target.style.borderColor = T.line)}
          />
        </Field>
      </div>

      <Field label="Upload GPX or TCX">
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "14px 16px", border: `1px dashed ${importStatus === "done" ? T.green : T.line}`, borderRadius: 4, background: T.bg2, transition: "border-color 150ms" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>CHOOSE FILE</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: gpxData ? T.paper : T.inkDim }}>
            {gpxData ? gpxData.name : "No file selected"}
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
            { label: "Distance", value: `${gpxData.distanceKm} km` },
            { label: "Elevation", value: `+${gpxData.elevationM}m` },
            { label: "Profile", value: gpxData.elevationM > 500 ? "Hilly" : gpxData.elevationM > 150 ? "Rolling" : "Flat" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "10px 14px" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.6, color: T.inkDim, marginBottom: 4 }}>{label.toUpperCase()}</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Section 2 — Reference Races */}
      <FormSectionTitle>2 — Reference Races</FormSectionTitle>

      {candidateRaces.length === 0 ? (
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, padding: "14px 0" }}>
          No past {sport} races in your history — the plan will use a generic pace baseline.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim }}>
              {selectedRaces.length} of {candidateRaces.length} selected
            </span>
            <button
              type="button"
              onClick={toggleAll}
              style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.5, padding: "5px 10px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.inkDim, cursor: "pointer" }}
            >
              {allSelected ? "DESELECT ALL" : "SELECT ALL"}
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
                    background: checked ? "rgba(201,162,75,0.05)" : "transparent",
                    borderBottom: i < candidateRaces.length - 1 ? `1px solid ${T.line}` : "none",
                    transition: "background 100ms",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 2, border: `1.5px solid ${checked ? T.brass : T.inkDim}`,
                      background: checked ? T.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {checked && <span style={{ color: T.bg, fontSize: 9, lineHeight: 1, fontFamily: FONT_MONO }}>✓</span>}
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
                    {race.percentile}th
                  </div>
                </div>
              );
            })}
          </div>

          {selectedRaces.length === 0 && (
            <div style={{ marginTop: 8, fontFamily: FONT_BODY, fontSize: 13, color: T.ember }}>
              No races selected — plan will fall back to a generic baseline.
            </div>
          )}
        </>
      )}

      {/* Section 3 — Conditions */}
      <FormSectionTitle>3 — Conditions</FormSectionTitle>

      <Field label="Location (for forecast)">
        <div style={{ display: "flex", gap: 8 }}>
          <LocationAutocomplete
            value={locationQuery}
            onChange={(e) => { setLocationQuery(e.target.value); setSelectedPlace(null); }}
            onSelect={(place) => { setLocationQuery(place.label); setSelectedPlace(place); }}
            placeholder="e.g. Chamonix, France"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleWeatherLookup())}
          />
          <button
            type="button"
            onClick={handleWeatherLookup}
            disabled={weatherStatus === "loading"}
            style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "9px 14px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.ink, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {weatherStatus === "loading" ? "..." : "LOOK UP"}
          </button>
        </div>
      </Field>

      {weatherMessage && (
        <div style={{ marginTop: 6, marginBottom: 12, fontFamily: FONT_BODY, fontSize: 13, color: statusColor[weatherStatus] ?? T.ink, lineHeight: 1.5 }}>
          {weatherMessage}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 12 }}>
        <Field label="Temp (°C)">
          <TextInput type="number" value={tempC} onChange={(e) => setTempC(e.target.value)} placeholder="e.g. 18" />
        </Field>
        <Field label="Humidity (%)">
          <TextInput type="number" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder="e.g. 60" />
        </Field>
        <Field label="Wind (km/h)">
          <TextInput type="number" value={wind} onChange={(e) => setWind(e.target.value)} placeholder="e.g. 10" />
        </Field>
      </div>

      {/* Section 4 — Target Time */}
      <FormSectionTitle>4 — Target Time</FormSectionTitle>

      {(derivedClock || estimateSource === "loading") && (
        <div style={{ background: T.bg2, border: `1px solid ${estimateSource === "ai" ? T.brassDim : T.line}`, borderRadius: 4, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.6, color: T.inkDim }}>ESTIMATE</span>
            {estimateSource === "ai" && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.5, color: T.brass, background: "rgba(201,162,75,0.12)", border: `1px solid ${T.brassDim}`, borderRadius: 2, padding: "1px 6px" }}>AI</span>
            )}
            {estimateSource === "loading" && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.5, color: T.inkDim }}>THINKING…</span>
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

      <Field label="Your Target (H:MM:SS)" hint="Edit to override the estimate above.">
        <TextInput
          value={targetClock}
          onChange={(e) => setTargetClock(e.target.value)}
          placeholder="e.g. 3:45:00"
        />
      </Field>

      {/* Section 5 — Fueling */}
      <FormSectionTitle>5 — Fueling</FormSectionTitle>

      <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 14px", lineHeight: 1.5 }}>
        RaceIQ derives your nutrition targets from the fueling you actually logged in the
        reference races above{derivedFueling?.basedOnRaces ? `` : ` (research defaults until you have race history)`}.
        Override any field with a rate you know works for you — leave blank to keep the derived value.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Carbs/hr (g)" hint={fuelHint("carbs")}>
          <TextInput type="number" value={fuelCarbs} onChange={(e) => setFuelCarbs(e.target.value)} placeholder={derivedFueling?.carbsTargetNum != null ? String(derivedFueling.carbsTargetNum) : "—"} />
        </Field>
        <Field label="Sodium/hr (mg)" hint={fuelHint("sodium")}>
          <TextInput type="number" value={fuelSodium} onChange={(e) => setFuelSodium(e.target.value)} placeholder={derivedFueling?.sodiumMgHr != null ? String(derivedFueling.sodiumMgHr) : "—"} />
        </Field>
        <Field label="Fluids/hr (ml)" hint={fuelHint("fluids")}>
          <TextInput type="number" value={fuelFluids} onChange={(e) => setFuelFluids(e.target.value)} placeholder={derivedFueling?.fluidsMlHr != null ? String(derivedFueling.fluidsMlHr) : "—"} />
        </Field>
        <Field label="Caffeine (mg total)" hint={fuelHint("caffeine")}>
          <TextInput type="number" value={fuelCaffeine} onChange={(e) => setFuelCaffeine(e.target.value)} placeholder={derivedFueling?.caffeineMg != null ? String(derivedFueling.caffeineMg) : "—"} />
        </Field>
      </div>

      {derivedFueling?.notes?.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {derivedFueling.notes.map((note, i) => (
            <div key={i} style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.brass, lineHeight: 1.45 }}>{note}</div>
          ))}
        </div>
      )}

      {/* Section 6 — Aid Stations */}
      <FormSectionTitle>6 — Aid Stations</FormSectionTitle>

      <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 14px", lineHeight: 1.5 }}>
        Mark where you can refill. RaceIQ works out how much food and fluid to carry
        on each leg between stations. Leave empty to skip.
      </p>

      {gpxData ? (
        <div style={{ marginBottom: 14 }}>
          <ElevationProfile
            splits={gpxData.splits}
            distanceKm={gpxData.distanceKm}
            elevationM={gpxData.elevationM}
            stations={aidStations}
            onAdd={addStationAtKm}
            onMove={moveStation}
            onRemove={removeStationById}
          />
        </div>
      ) : (
        <div style={{ marginBottom: 14, fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim }}>
          Upload a course above to place aid stations on the elevation profile.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={addStation}
          style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.5, padding: "7px 12px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.ink, cursor: "pointer" }}
        >
          + ADD STATION
        </button>
        <button
          type="button"
          onClick={autoSpaceStations}
          disabled={!gpxData}
          title={gpxData ? "" : "Upload a course first"}
          style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.5, padding: "7px 12px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: gpxData ? T.ink : T.inkDim, cursor: gpxData ? "pointer" : "not-allowed" }}
        >
          AUTO-SPACE
        </button>
      </div>

      {aidStations.length > 0 && (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr auto auto 32px", gap: 10, padding: "9px 12px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.6, color: T.inkDim }}>
            <div>KM</div><div>NAME</div><div>WATER</div><div>FOOD</div><div />
          </div>
          {aidStations.map((s, i) => {
            const kmNum = parseFloat(s.km);
            const outOfRange = gpxData && !isNaN(kmNum) && (kmNum <= 0 || kmNum >= gpxData.distanceKm);
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr auto auto 32px", gap: 10, padding: "9px 12px", alignItems: "center", borderBottom: i < aidStations.length - 1 ? `1px solid ${T.line}33` : "none" }}>
                <input
                  type="number"
                  value={s.km}
                  onChange={(e) => updateStation(i, { km: e.target.value })}
                  placeholder="km"
                  style={{ ...inputStyle, padding: "7px 8px", borderColor: outOfRange ? T.ember : T.line }}
                />
                <input
                  value={s.name}
                  onChange={(e) => updateStation(i, { name: e.target.value })}
                  placeholder={`Aid ${i + 1}`}
                  style={{ ...inputStyle, padding: "7px 8px" }}
                />
                <StationToggle on={s.water} onClick={() => updateStation(i, { water: !s.water })} />
                <StationToggle on={s.food} onClick={() => updateStation(i, { food: !s.food })} />
                <button
                  type="button"
                  onClick={() => removeStation(i)}
                  aria-label="Remove station"
                  style={{ background: "none", border: "none", color: T.ember, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 16, lineHeight: 1, padding: 0 }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {aidStations.length > 0 && (
        <div style={{ maxWidth: 220 }}>
          <Field label="Carry Capacity (ml)" hint="Fluid you can hold between stations. Legs that exceed it get flagged.">
            <TextInput type="number" value={carryCapacity} onChange={(e) => setCarryCapacity(e.target.value)} placeholder="e.g. 1000" />
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
          {submitting ? "BUILDING PLAN..." : "BUILD MY PLAN →"}
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
