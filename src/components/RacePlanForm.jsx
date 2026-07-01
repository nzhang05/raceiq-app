import { useState, useEffect, useMemo } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, SPORT_OPTIONS, isCyclingSport } from "../constants.js";
import { parseRouteFile } from "../utils/gpx.js";
import { geocodeLocation } from "../utils/weather.js";
import { forecastWeather, estimateTargetTime, buildRacePlan } from "../utils/racePlan.js";
import { parseClockToMinutes, fmtDate } from "../utils/time.js";
import { Field, TextInput, Select, FormSectionTitle, LocationAutocomplete } from "./ui.jsx";

const APIKEY_STORAGE_KEY = "raceiq:apikey";

async function estimateWithClaude(apiKey, gpxData, sport, plannedTempC, races) {
  const sorted = [...races].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const isCycling = isCyclingSport(sport);

  const historyText = sorted.map(r => {
    const min = parseClockToMinutes(r.finishTime);
    const pace = min / r.distanceKm;
    const paceStr = isCycling
      ? `${(r.distanceKm / (min / 60)).toFixed(1)} km/h`
      : `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, "0")} min/km`;
    return `- ${r.date || "unknown date"}: ${r.distanceKm} km, +${r.elevationM ?? 0}m elev, ${r.finishTime} (${paceStr}), ~${r.tempC ?? "?"}°C`;
  }).join("\n");

  const elevDensity = gpxData.distanceKm > 0 ? (gpxData.elevationM / gpxData.distanceKm).toFixed(1) : "?";

  const prompt = `You are a sports performance analyst estimating a finish time for an endurance athlete.

PAST ${sport.toUpperCase()} RACES (chronological, all selected by the athlete as reference):
${historyText || "None."}

UPCOMING RACE:
- Distance: ${gpxData.distanceKm} km
- Elevation: +${gpxData.elevationM}m (${elevDensity} m/km density)
- Temp: ${plannedTempC}°C
- Course: ${gpxData.name || "unknown"}

Instructions:
1. If there are 2+ races, assess whether there is a meaningful improvement trend (pace improving race to race at comparable distances/elevation). If yes, project that trend forward. If the trend is noisy or inconsistent, anchor to the best performance instead.
2. Adjust for the distance difference using the Riegel exponent (1.06 for running, 1.0 for cycling).
3. Add ~1 min per 100m of elevation gain above the reference race's elevation.
4. Apply a small heat penalty if temp > 20°C.
5. Be realistic — do not over-extrapolate a trend beyond what the data supports.

Return ONLY valid JSON: {"estimatedMinutes": <number>, "reasoning": "<one concise sentence explaining the key factor — trend, best result, or course adjustment>"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `API error ${res.status}`);
  }
  const json = await res.json();
  const text = json.content?.[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Claude response");
  const parsed = JSON.parse(match[0]);
  if (typeof parsed.estimatedMinutes !== "number") throw new Error("Missing estimatedMinutes");
  return { minutes: parsed.estimatedMinutes, reasoning: parsed.reasoning || "" };
}

export default function RacePlanForm({ allRaces, onPlanGenerated, onCancel }) {
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

    const apiKey = (() => { try { return localStorage.getItem(APIKEY_STORAGE_KEY); } catch { return null; } })();

    if (apiKey && selectedRaces.length > 0) {
      setEstimateSource("loading");
      setDerivedNote("");
      estimateWithClaude(apiKey, gpxData, sport, plannedTempC, selectedRaces)
        .then(({ minutes, reasoning }) => {
          const h = Math.floor(minutes / 60);
          const m = Math.floor(minutes % 60);
          const s = Math.round((minutes * 60) % 60);
          const clock = h > 0
            ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
            : `${m}:${String(s).padStart(2, "0")}`;
          setDerivedClock(clock);
          setTargetClock(clock);
          setDerivedNote(reasoning);
          setEstimateSource("ai");
        })
        .catch(() => applyDeterministic());
    } else {
      applyDeterministic();
    }
  }, [gpxData, sport, tempC, selectedRaces]);

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
    const plan = buildRacePlan(gpxData, sport, weather, targetMinutes, racesForPlan);
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
