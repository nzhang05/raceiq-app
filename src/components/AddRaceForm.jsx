import { useState, useMemo, useEffect } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, SPORT_OPTIONS, SURFACES } from "../constants.js";
import { parseClockToMinutes, fmtDate } from "../utils/time.js";
import { enrichRace } from "../utils/ratings.js";
import { parseTrackFile } from "../utils/gpx.js";
import { fetchHistoricalWeather, fetchWeatherAlongCourse, geocodeLocation } from "../utils/weather.js";
import { Field, TextInput, Select, FormSectionTitle, LocationAutocomplete } from "./ui.jsx";
import FuelingSectionEditor from "./FuelingSectionEditor.jsx";
import { sectionsToRates, rollUpSections, seedThirdsSections } from "../utils/fuelingSections.js";

const EMPTY_SPLIT_ROWS = 4;

function blankSplit() {
  return { km: "", pace: "", tempC: "", elevM: "" };
}

const fnum = (v) => (v === "" || v == null ? 0 : parseFloat(v) || 0);
const round1 = (n) => Math.round(n * 10) / 10;
let fuelSeq = 0;
const fsUid = () => `fs-${Date.now()}-${fuelSeq++}`;

export default function AddRaceForm({ onSave, onCancel, initialRace = null }) {
  const paceToStr = (p) => `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}`;
  const editing = initialRace != null;

  const [name, setName] = useState(initialRace?.name ?? "");
  const [sport, setSport] = useState(initialRace?.sport ?? SPORT_OPTIONS[0]);
  const [date, setDate] = useState(initialRace?.date ?? new Date().toISOString().slice(0, 10));
  const [distanceKm, setDistanceKm] = useState(initialRace ? String(initialRace.distanceKm) : "");
  const [elevationM, setElevationM] = useState(initialRace ? String(initialRace.elevationM || "") : "");
  const [surface, setSurface] = useState(initialRace?.surface ?? SURFACES[0]);
  const [finishTime, setFinishTime] = useState(initialRace?.finishTime ?? "");
  const [placement, setPlacement] = useState(initialRace ? String(initialRace.placement || "") : "");
  const [field, setField] = useState(initialRace ? String(initialRace.field || "") : "");
  const [tempC, setTempC] = useState(initialRace ? String(initialRace.tempC || "") : "");
  const [humidity, setHumidity] = useState(initialRace ? String(initialRace.humidity || "") : "");
  const [wind, setWind] = useState(initialRace ? String(initialRace.wind || "") : "");
  const [carbsPerHr, setCarbsPerHr] = useState(initialRace ? String(initialRace.fueling?.carbsPerHr || "") : "");
  const [sodiumPerHr, setSodiumPerHr] = useState(initialRace ? String(initialRace.fueling?.sodiumPerHr || "") : "");
  const [fluidsPerHr, setFluidsPerHr] = useState(initialRace ? String(initialRace.fueling?.fluidsPerHr || "") : "");
  const [caffeine, setCaffeine] = useState(initialRace ? String(initialRace.fueling?.caffeine || "") : "");

  // By-section fuelling — the default for new races; edits respect the saved mode.
  const [fuelMode, setFuelMode] = useState(
    initialRace ? (initialRace.fueling?.inputMode === "sections" ? "sections" : "overall") : "sections"
  );
  const [entryMode, setEntryMode] = useState("amount");
  const [fuelSections, setFuelSections] = useState(() =>
    initialRace?.fueling?.inputMode === "sections" && initialRace.fueling.sections?.length
      ? initialRace.fueling.sections.map((s, i) => ({
          id: `fs-init-${i}`,
          fromKm: s.fromKm,
          toKm: s.toKm,
          carbs: s.carbsPerHr != null ? String(s.carbsPerHr) : "",
          sodium: s.sodiumPerHr != null ? String(s.sodiumPerHr) : "",
          fluids: s.fluidsPerHr != null ? String(s.fluidsPerHr) : "",
          caffeine: s.caffeineMg != null ? String(s.caffeineMg) : "",
        }))
      : []
  );
  const [splitRows, setSplitRows] = useState(
    initialRace?.splits?.length
      ? initialRace.splits.map((s) => ({
          km: String(s.km),
          pace: paceToStr(s.pace),
          tempC: s.tempC != null ? String(s.tempC) : "",
          elevM: s.elevM != null ? String(s.elevM) : "",
        }))
      : Array.from({ length: EMPTY_SPLIT_ROWS }, blankSplit)
  );
  // Numeric splits (for the fuelling profile + section-time roll-up).
  const parsedSplits = useMemo(
    () => splitRows
      .filter((r) => r.km !== "" && r.pace !== "")
      .map((r) => ({ km: parseFloat(r.km), pace: parseClockToMinutes(r.pace), elevM: r.elevM !== "" ? parseFloat(r.elevM) : null }))
      .sort((a, b) => a.km - b.km),
    [splitRows]
  );
  const hasSplitElev = parsedSplits.some((s) => s.elevM != null);
  const fuelRollup = useMemo(
    () => rollUpSections(sectionsToRates(fuelSections, parsedSplits, entryMode), parsedSplits),
    [fuelSections, parsedSplits, entryMode]
  );

  // Keep the final section's end pinned to the current distance.
  useEffect(() => {
    const d = Number(distanceKm) || 0;
    if (fuelMode !== "sections" || d <= 0 || fuelSections.length === 0) return;
    setFuelSections((prev) => {
      const last = prev[prev.length - 1];
      if (round1(fnum(last.toKm)) === round1(d)) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...last, toKm: round1(d) };
      return next;
    });
  }, [distanceKm, fuelMode]);

  // Seed sections (thirds of the race) once a distance is known — covers both the
  // default sections mode on a fresh form and a GPX import that fills in distance.
  useEffect(() => {
    if (fuelMode !== "sections" || fuelSections.length > 0) return;
    const d = Number(distanceKm) || 0;
    if (d > 0) {
      setFuelSections(seedThirdsSections(d, { carbs: carbsPerHr, sodium: sodiumPerHr, fluids: fluidsPerHr }));
    }
  }, [fuelMode, distanceKm, fuelSections.length]);

  function enableSections() {
    setFuelMode("sections");
  }

  function addFuelBoundary(km) {
    setFuelSections((prev) => {
      const i = prev.findIndex((s) => fnum(s.fromKm) < km && km < fnum(s.toKm));
      if (i === -1) return prev;
      const sec = prev[i];
      const at = round1(km);
      const first = { ...sec, toKm: at };
      const second = { ...sec, id: fsUid(), fromKm: at, toKm: sec.toKm };
      return [...prev.slice(0, i), first, second, ...prev.slice(i + 1)];
    });
  }
  function moveFuelBoundary(id, km) {
    if (isNaN(km)) return;
    setFuelSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i === -1 || i === prev.length - 1) return prev;
      const lo = fnum(prev[i].fromKm) + 0.1;
      const hi = fnum(prev[i + 1].toKm) - 0.1;
      const k = round1(Math.max(lo, Math.min(hi, km)));
      const next = [...prev];
      next[i] = { ...next[i], toKm: k };
      next[i + 1] = { ...next[i + 1], fromKm: k };
      return next;
    });
  }
  function removeFuelBoundary(id) {
    setFuelSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i === -1 || i === prev.length - 1) return prev;
      const merged = { ...prev[i], toKm: prev[i + 1].toKm };
      return [...prev.slice(0, i), merged, ...prev.slice(i + 2)];
    });
  }
  function updateFuelSection(id, patch) {
    setFuelSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addFuelSection() {
    setFuelSections((prev) => {
      if (prev.length === 0) return prev;
      // Split the widest section at its midpoint.
      let widest = 0;
      for (let i = 1; i < prev.length; i++) {
        if (fnum(prev[i].toKm) - fnum(prev[i].fromKm) > fnum(prev[widest].toKm) - fnum(prev[widest].fromKm)) widest = i;
      }
      const sec = prev[widest];
      const mid = round1((fnum(sec.fromKm) + fnum(sec.toKm)) / 2);
      if (mid <= fnum(sec.fromKm) || mid >= fnum(sec.toKm)) return prev;
      const first = { ...sec, toKm: mid };
      const second = { ...sec, id: fsUid(), fromKm: mid, toKm: sec.toKm };
      return [...prev.slice(0, widest), first, second, ...prev.slice(widest + 1)];
    });
  }

  const [error, setError] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [weatherStatus, setWeatherStatus] = useState(null);
  const [weatherMessage, setWeatherMessage] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const showElevCol = sport !== "Road Running";
  const race_sport_lower = sport.toLowerCase();

  async function handleLocationWeatherLookup() {
    if (!locationQuery.trim()) return;
    setWeatherStatus("loading");
    setWeatherMessage("");
    try {
      const place = selectedPlace ?? await geocodeLocation(locationQuery.trim());
      const raceDate = date ? new Date(`${date}T12:00:00Z`).getTime() : Date.now();
      const weather = await fetchHistoricalWeather(place.lat, place.lon, raceDate, raceDate);
      setTempC(String(weather.tempC));
      if (weather.humidity != null) setHumidity(String(weather.humidity));
      if (weather.wind != null) setWind(String(weather.wind));
      const precipNote = weather.precipMm > 0.2 ? ` Recorded ${weather.precipMm}mm of precipitation that day.` : "";
      if (weather.simulated || place.simulated) {
        setWeatherStatus("simulated");
        setWeatherMessage(`SIMULATED — this preview can't reach the weather service from here, so this is a placeholder estimate, not a real lookup for ${locationQuery.trim()}: ${weather.tempC}°C, ${weather.humidity ?? "—"}% humidity, ${weather.wind ?? "—"} km/h wind.${precipNote} Outside this preview, the real lookup will run automatically.`);
      } else {
        setWeatherStatus("done");
        setWeatherMessage(`Conditions for ${place.label} on ${fmtDate(date)} (midday, since no exact start time is available): ${weather.tempC}°C, ${weather.humidity ?? "—"}% humidity, ${weather.wind ?? "—"} km/h wind.${precipNote} Adjust below if your start time was earlier or later in the day.`);
      }
    } catch (err) {
      setWeatherStatus("error");
      setWeatherMessage(err.message || "Couldn't look up weather for that location — enter conditions manually below.");
    }
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus("loading");
    setImportMessage("");
    setWeatherStatus(null);
    setWeatherMessage("");
    try {
      const parsed = await parseTrackFile(file, sport);
      if (!parsed.splits.length) {
        throw new Error("This file has GPS points but no timestamps, so RaceIQ can't compute pace from it. Try a file exported with time data, or enter splits manually.");
      }
      setName((prev) => prev || parsed.name);
      setDistanceKm(String(parsed.distanceKm));
      if (parsed.elevationM) setElevationM(String(parsed.elevationM));
      if (parsed.finishTime) setFinishTime(parsed.finishTime);
      if (parsed.startTimeMs) setDate(new Date(parsed.startTimeMs).toISOString().slice(0, 10));
      setSplitRows(
        parsed.splits.map((s) => ({
          km: String(s.km),
          pace: `${Math.floor(s.pace)}:${String(Math.round((s.pace % 1) * 60)).padStart(2, "0")}`,
          tempC: "",
          elevM: s.elevM != null ? String(s.elevM) : "",
        }))
      );
      setImportStatus("done");
      setImportMessage(`Imported ${parsed.splits.length} splits over ${parsed.distanceKm} km. Review below, then add placement and fueling to finish.`);

      if (parsed.startLat != null && parsed.startLon != null && parsed.startTimeMs != null) {
        setWeatherStatus("loading");
        try {
          const startWeather = await fetchHistoricalWeather(parsed.startLat, parsed.startLon, parsed.startTimeMs, parsed.endTimeMs);
          setTempC(String(startWeather.tempC));
          if (startWeather.humidity != null) setHumidity(String(startWeather.humidity));
          if (startWeather.wind != null) setWind(String(startWeather.wind));

          const splitsWithTemp = await fetchWeatherAlongCourse(parsed.splits);
          setSplitRows(
            splitsWithTemp.map((s) => ({
              km: String(s.km),
              pace: `${Math.floor(s.pace)}:${String(Math.round((s.pace % 1) * 60)).padStart(2, "0")}`,
              tempC: s.mappedTempC != null ? String(s.mappedTempC) : "",
              elevM: s.elevM != null ? String(s.elevM) : "",
            }))
          );

          const precipNote = startWeather.precipMm > 0.2 ? ` Recorded ${startWeather.precipMm}mm of precipitation around race time.` : "";
          const sampleCount = splitsWithTemp.filter(s => s.lat != null).length;
          if (startWeather.simulated) {
            setWeatherStatus("simulated");
            setWeatherMessage(`SIMULATED — can't reach the weather service from here, so these are placeholder estimates: ${startWeather.tempC}°C at start, ${startWeather.humidity ?? "—"}% humidity, ${startWeather.wind ?? "—"} km/h wind. Per-split temperatures use a diurnal model.${precipNote} Outside this preview, real geo-sampled conditions will be fetched.`);
          } else {
            setWeatherStatus("done");
            setWeatherMessage(`Fetched conditions at ${sampleCount} locations along the course and interpolated per-split temperatures — capturing elevation and geographic variation, not just time of day. Start: ${startWeather.tempC}°C, ${startWeather.humidity ?? "—"}% humidity, ${startWeather.wind ?? "—"} km/h wind.${precipNote}`);
          }
        } catch (werr) {
          setWeatherStatus("error");
          setWeatherMessage(werr.message || "Couldn't fetch historical weather for this race — enter conditions manually below.");
        }
      } else {
        setWeatherStatus("skipped");
        setWeatherMessage("This file doesn't have GPS coordinates and timestamps together, so weather couldn't be looked up automatically. Enter conditions manually below.");
      }
    } catch (err) {
      setImportStatus("error");
      setImportMessage(err.message || "Something went wrong reading that file.");
    } finally {
      e.target.value = "";
    }
  }

  function updateSplit(i, field, value) {
    setSplitRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addSplitRow() {
    setSplitRows((rows) => [...rows, blankSplit()]);
  }

  function removeSplitRow(i) {
    setSplitRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  function handleSubmit() {
    if (!name.trim()) return setError("Give the race a name.");
    if (!distanceKm || Number(distanceKm) <= 0) return setError("Enter a distance greater than zero.");
    if (!finishTime.trim()) return setError("Enter a finish time, like 3:24:51 or 38:42.");

    const splits = splitRows
      .filter((r) => r.km !== "" && r.pace !== "")
      .map((r) => ({
        km: parseFloat(r.km),
        pace: parseClockToMinutes(r.pace),
        tempC: r.tempC !== "" ? parseFloat(r.tempC) : parseFloat(tempC) || 18,
        elevM: r.elevM !== "" ? parseFloat(r.elevM) : null,
      }))
      .sort((a, b) => a.km - b.km);

    if (splits.length < 2) {
      return setError("Add at least two splits so RaceIQ can read your pacing pattern.");
    }

    setError("");

    const raw = {
      id: initialRace?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      sport,
      date,
      distanceKm: Number(distanceKm),
      elevationM: Number(elevationM) || 0,
      surface,
      finishTime: finishTime.trim(),
      placement: Number(placement) || splits.length,
      field: Number(field) || Number(placement) || splits.length,
      tempC: Number(tempC) || splits[splits.length - 1].tempC,
      humidity: Number(humidity) || 50,
      wind: Number(wind) || 0,
      splits,
      fueling:
        fuelMode === "sections" && fuelSections.length
          ? {
              inputMode: "sections",
              sections: sectionsToRates(fuelSections, splits, entryMode),
              // scalar roll-up fields are filled by enrichRace
              carbsPerHr: 0,
              sodiumPerHr: 0,
              fluidsPerHr: 0,
              caffeine: 0,
            }
          : {
              inputMode: "overall",
              carbsPerHr: Number(carbsPerHr) || 0,
              sodiumPerHr: Number(sodiumPerHr) || 0,
              fluidsPerHr: Number(fluidsPerHr) || 0,
              caffeine: Number(caffeine) || 0,
            },
    };

    onSave(enrichRace(raw));
  }

  const statusBanner = (status, message) => {
    const styles = {
      done: { bg: `${T.green}14`, border: T.greenDim, color: T.green },
      simulated: { bg: `${T.brass}1A`, border: T.brassDim, color: T.brass },
      error: { bg: `${T.ember}14`, border: T.emberDim, color: T.ember },
      skipped: { bg: `${T.ember}14`, border: T.emberDim, color: T.ember },
    };
    const s = styles[status];
    if (!s) return null;
    return (
      <div style={{ marginBottom: 16, padding: "10px 16px", background: s.bg, border: `1px solid ${s.border}`, borderRadius: 3, color: s.color, fontFamily: FONT_BODY, fontSize: 13.5 }}>
        {status === "simulated" && <strong style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>SIMULATED — </strong>}
        {message.replace(/^SIMULATED — /, "")}
      </div>
    );
  };

  return (
    <div>
      <button onClick={onCancel} style={{ background: "none", border: "none", color: T.inkDim, fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, cursor: "pointer", padding: 0, marginBottom: 28 }}>
        ← BACK TO RACE RESUME
      </button>

      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass, marginBottom: 6 }}>
        {editing ? "EDIT RACE" : "ADD RACE"}
      </div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600, margin: "0 0 8px", color: T.paper }}>
        {editing ? "Edit race data" : "Enter race data"}
      </h1>
      <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.inkDim, marginBottom: 8, maxWidth: 600 }}>
        Add what you have. RaceIQ derives your percentile, score, and verdict from these numbers, and writes the debrief from your splits and conditions.
      </div>

      <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "18px 20px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, color: T.paper, marginBottom: 4 }}>Import a GPX or TCX file</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, maxWidth: 440 }}>
            Export the activity from Strava, Garmin Connect, Coros, or Polar Flow as GPX, then drop it here. RaceIQ reads it in your browser — nothing is uploaded anywhere — and fills in distance, splits, pace, and elevation automatically.
          </div>
        </div>
        <label style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, color: T.bg, background: T.brass, border: "none", borderRadius: 3, padding: "11px 18px", cursor: "pointer", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
          {importStatus === "loading" ? "READING…" : "CHOOSE FILE"}
          <input type="file" accept=".gpx,.tcx" onChange={handleFileImport} style={{ display: "none" }} disabled={importStatus === "loading"} />
        </label>
      </div>
      {importStatus === "done" && (
        <div style={{ marginBottom: 24, padding: "10px 16px", background: `${T.green}14`, border: `1px solid ${T.greenDim}`, borderRadius: 3, color: T.green, fontFamily: FONT_BODY, fontSize: 13.5 }}>
          {importMessage}
        </div>
      )}
      {importStatus === "error" && (
        <div style={{ marginBottom: 24, padding: "10px 16px", background: `${T.ember}14`, border: `1px solid ${T.emberDim}`, borderRadius: 3, color: T.ember, fontFamily: FONT_BODY, fontSize: 13.5 }}>
          {importMessage}
        </div>
      )}

      <FormSectionTitle>Race details</FormSectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Race name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Brandywine Valley Marathon" />
        </Field>
        <Field label="Sport">
          <Select value={sport} onChange={(e) => setSport(e.target.value)} options={SPORT_OPTIONS} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Distance (km)"><TextInput type="number" step="0.1" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="42.2" /></Field>
        <Field label="Elevation gain (m)"><TextInput type="number" value={elevationM} onChange={(e) => setElevationM(e.target.value)} placeholder="310" /></Field>
        <Field label="Surface"><Select value={surface} onChange={(e) => setSurface(e.target.value)} options={SURFACES} /></Field>
      </div>

      <FormSectionTitle>Result</FormSectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Finish time" hint="H:MM:SS or MM:SS"><TextInput value={finishTime} onChange={(e) => setFinishTime(e.target.value)} placeholder="3:24:51" /></Field>
        <Field label="Placement"><TextInput type="number" value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="142" /></Field>
        <Field label="Field size"><TextInput type="number" value={field} onChange={(e) => setField(e.target.value)} placeholder="1850" /></Field>
      </div>

      <FormSectionTitle>Conditions</FormSectionTitle>

      {weatherStatus !== "done" && weatherStatus !== "simulated" && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Field label="Race location">
                <LocationAutocomplete
                  value={locationQuery}
                  onChange={(e) => { setLocationQuery(e.target.value); setSelectedPlace(null); }}
                  onSelect={(place) => { setLocationQuery(place.label); setSelectedPlace(place); }}
                  placeholder="Philadelphia, PA"
                />
              </Field>
            </div>
            <button
              onClick={handleLocationWeatherLookup}
              disabled={!locationQuery.trim() || weatherStatus === "loading"}
              style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, color: T.bg, background: locationQuery.trim() ? T.brass : T.line, border: "none", borderRadius: 3, padding: "10px 16px", cursor: locationQuery.trim() ? "pointer" : "default", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {weatherStatus === "loading" ? "LOOKING UP…" : "LOOK UP WEATHER"}
            </button>
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.inkDim, marginTop: 4 }}>City or race venue — used to look up recorded weather for the date above</div>
        </div>
      )}
      {statusBanner(weatherStatus, weatherMessage)}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Temperature (°C)"><TextInput type="number" value={tempC} onChange={(e) => setTempC(e.target.value)} placeholder="27" /></Field>
        <Field label="Humidity (%)"><TextInput type="number" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder="71" /></Field>
        <Field label="Wind (km/h)"><TextInput type="number" value={wind} onChange={(e) => setWind(e.target.value)} placeholder="14" /></Field>
      </div>

      <FormSectionTitle>Fueling</FormSectionTitle>

      {/* Overall vs by-section mode toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["overall", "OVERALL AVERAGE"], ["sections", "BY SECTION"]].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => (mode === "sections" ? enableSections() : setFuelMode("overall"))}
            style={{
              fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "7px 13px", borderRadius: 3, cursor: "pointer",
              border: `1px solid ${fuelMode === mode ? T.brass : T.line}`,
              background: fuelMode === mode ? `${T.brass}1F` : "transparent",
              color: fuelMode === mode ? T.brass : T.inkDim,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {fuelMode === "overall" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <Field label="Carbs (g/hr)"><TextInput type="number" value={carbsPerHr} onChange={(e) => setCarbsPerHr(e.target.value)} placeholder="52" /></Field>
          <Field label="Sodium (mg/hr)"><TextInput type="number" value={sodiumPerHr} onChange={(e) => setSodiumPerHr(e.target.value)} placeholder="280" /></Field>
          <Field label="Fluids (ml/hr)"><TextInput type="number" value={fluidsPerHr} onChange={(e) => setFluidsPerHr(e.target.value)} placeholder="480" /></Field>
          <Field label="Caffeine (mg total)"><TextInput type="number" value={caffeine} onChange={(e) => setCaffeine(e.target.value)} placeholder="80" /></Field>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginBottom: 14, lineHeight: 1.5 }}>
            Log fuelling by section of the race so RaceIQ can line up a fuel drop-off with where your pace faded.
            {fuelSections.length === 0
              ? " Enter a distance above (or import a GPX) and RaceIQ will lay out sections to fill in."
              : parsedSplits.length < 2 && " Add at least two splits below so section times can be computed for the totals."}
          </div>
          {fuelSections.length > 0 && (
            <FuelingSectionEditor
              splits={parsedSplits}
              distanceKm={Number(distanceKm) || 0}
              elevationM={Number(elevationM) || 0}
              hasElev={hasSplitElev}
              entryMode={entryMode}
              setEntryMode={setEntryMode}
              sections={fuelSections}
              rollup={fuelRollup}
              onAddBoundary={addFuelBoundary}
              onMoveBoundary={moveFuelBoundary}
              onRemoveBoundary={removeFuelBoundary}
              onUpdateSection={updateFuelSection}
              onAddSection={addFuelSection}
            />
          )}
        </div>
      )}

      <FormSectionTitle>Splits</FormSectionTitle>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginBottom: 14 }}>
        Enter at least two checkpoints. Pace is minutes per km (or per mile — just stay consistent). Leave a split's temperature blank to use the overall race temperature above.
        {showElevCol && (
          <> Add elevation at each checkpoint and RaceIQ will compute grade-adjusted pace — raw pace on a climb isn't comparable to raw pace on the flat, so this is what the debrief and chart will use for {race_sport_lower}.</>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showElevCol ? "0.6fr 0.7fr 0.6fr 0.6fr 32px" : "0.7fr 0.8fr 0.7fr 32px", gap: 10, marginBottom: 8 }}>
        {(showElevCol
          ? ["KM / CHECKPOINT", "PACE (MM:SS)", "ELEV (M)", "TEMP °C (OPT.)", ""]
          : ["KM / CHECKPOINT", "PACE (MM:SS)", "TEMP °C (OPTIONAL)", ""]
        ).map((h) => (
          <div key={h} style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>{h}</div>
        ))}
      </div>
      {splitRows.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: showElevCol ? "0.6fr 0.7fr 0.6fr 0.6fr 32px" : "0.7fr 0.8fr 0.7fr 32px", gap: 10, marginBottom: 8 }}>
          <TextInput type="number" step="0.1" value={row.km} onChange={(e) => updateSplit(i, "km", e.target.value)} placeholder={i === 0 ? "5" : ""} />
          <TextInput value={row.pace} onChange={(e) => updateSplit(i, "pace", e.target.value)} placeholder={i === 0 ? "4:42" : ""} />
          {showElevCol && <TextInput type="number" value={row.elevM} onChange={(e) => updateSplit(i, "elevM", e.target.value)} placeholder={i === 0 ? "120" : ""} />}
          <TextInput type="number" value={row.tempC} onChange={(e) => updateSplit(i, "tempC", e.target.value)} />
          <button onClick={() => removeSplitRow(i)} aria-label="Remove split" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 3, color: T.inkDim, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 13 }}>×</button>
        </div>
      ))}
      <button onClick={addSplitRow} style={{ background: "none", border: `1px dashed ${T.line}`, borderRadius: 3, color: T.inkDim, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.4, padding: "8px 14px", marginTop: 4, marginBottom: 8 }}>
        + ADD SPLIT
      </button>

      {error && (
        <div style={{ marginTop: 18, padding: "12px 16px", background: `${T.ember}14`, border: `1px solid ${T.emberDim}`, borderRadius: 3, color: T.ember, fontFamily: FONT_BODY, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 28, paddingTop: 24, borderTop: `1px solid ${T.line}` }}>
        <button onClick={handleSubmit} style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.6, color: T.bg, background: T.brass, border: "none", borderRadius: 3, padding: "12px 22px", cursor: "pointer", fontWeight: 600 }}>
          {editing ? "UPDATE RACE & REGENERATE DEBRIEF" : "SAVE RACE & GENERATE DEBRIEF"}
        </button>
        <button onClick={onCancel} style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.6, color: T.inkDim, background: "none", border: `1px solid ${T.line}`, borderRadius: 3, padding: "12px 22px", cursor: "pointer" }}>
          CANCEL
        </button>
      </div>
    </div>
  );
}
