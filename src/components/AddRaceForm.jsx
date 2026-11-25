import { useTranslation } from "react-i18next";
import { errorText } from "../i18n/render.js";
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
  const { t } = useTranslation();
  const A = (key, opts) => t(`addRace.${key}`, opts);
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
      const precipNote = weather.precipMm > 0.2 ? A("weather.precip", { mm: weather.precipMm }) : "";
      if (weather.simulated || place.simulated) {
        setWeatherStatus("simulated");
        setWeatherMessage(A("weather.simulatedManual", {
          place: locationQuery.trim(), tempC: weather.tempC,
          humidity: weather.humidity ?? "—", wind: weather.wind ?? "—", precipNote,
        }));
      } else {
        setWeatherStatus("done");
        setWeatherMessage(A("weather.done", {
          place: place.label, date: fmtDate(date), tempC: weather.tempC,
          humidity: weather.humidity ?? "—", wind: weather.wind ?? "—", precipNote,
        }));
      }
    } catch (err) {
      setWeatherStatus("error");
      setWeatherMessage(errorText(t, err, "addRace.weather.error"));
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
        throw new Error(t("errors.noTimestamps", { ns: "plan" }));
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
      setImportMessage(A("import.done", { count: parsed.splits.length, km: parsed.distanceKm }));

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

          const precipNote = startWeather.precipMm > 0.2 ? A("weather.precipRaceTime", { mm: startWeather.precipMm }) : "";
          const sampleCount = splitsWithTemp.filter(s => s.lat != null).length;
          if (startWeather.simulated) {
            setWeatherStatus("simulated");
            setWeatherMessage(A("weather.simulatedImport", {
              tempC: startWeather.tempC, humidity: startWeather.humidity ?? "—",
              wind: startWeather.wind ?? "—", precipNote,
            }));
          } else {
            setWeatherStatus("done");
            setWeatherMessage(A("weather.geoSampled", {
              count: sampleCount, tempC: startWeather.tempC,
              humidity: startWeather.humidity ?? "—", wind: startWeather.wind ?? "—", precipNote,
            }));
          }
        } catch (werr) {
          setWeatherStatus("error");
          setWeatherMessage(errorText(t, werr, "addRace.weather.importError"));
        }
      } else {
        setWeatherStatus("skipped");
        setWeatherMessage(A("weather.skipped"));
      }
    } catch (err) {
      setImportStatus("error");
      setImportMessage(errorText(t, err, "addRace.import.error"));
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
    if (!name.trim()) return setError(A("errorName"));
    if (!distanceKm || Number(distanceKm) <= 0) return setError(A("errorDistance"));
    if (!finishTime.trim()) return setError(A("errorFinishTime"));

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
      return setError(A("errorSplits"));
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
        {t("compare.back")}
      </button>

      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass, marginBottom: 6 }}>
        {A(editing ? "eyebrowEdit" : "eyebrowAdd")}
      </div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600, margin: "0 0 8px", color: T.paper }}>
        {A(editing ? "titleEdit" : "titleAdd")}
      </h1>
      <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.inkDim, marginBottom: 8, maxWidth: 600 }}>
        {A("intro")}
      </div>

      <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "18px 20px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, color: T.paper, marginBottom: 4 }}>{A("import.title")}</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, maxWidth: 440 }}>
            {A("import.body")}
          </div>
        </div>
        <label style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, color: T.bg, background: T.brass, border: "none", borderRadius: 3, padding: "11px 18px", cursor: "pointer", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
          {A(importStatus === "loading" ? "import.reading" : "import.chooseFile")}
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

      <FormSectionTitle>{A("section.details")}</FormSectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label={A("name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={A("namePlaceholder")} />
        </Field>
        <Field label={A("sport")}>
          <Select value={sport} onChange={(e) => setSport(e.target.value)} options={SPORT_OPTIONS.map((v) => ({ value: v, label: t(`sport.${v}`) }))} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label={A("date")}><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={A("distance")}><TextInput type="number" step="0.1" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="42.2" /></Field>
        <Field label={A("elevation")}><TextInput type="number" value={elevationM} onChange={(e) => setElevationM(e.target.value)} placeholder="310" /></Field>
        <Field label={A("surface")}><Select value={surface} onChange={(e) => setSurface(e.target.value)} options={SURFACES.map((v) => ({ value: v, label: t(`surface.${v}`) }))} /></Field>
      </div>

      <FormSectionTitle>{A("section.result")}</FormSectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label={A("finishTime")} hint={A("finishTimeHint")}><TextInput value={finishTime} onChange={(e) => setFinishTime(e.target.value)} placeholder="3:24:51" /></Field>
        <Field label={A("placement")}><TextInput type="number" value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="142" /></Field>
        <Field label={A("fieldSize")}><TextInput type="number" value={field} onChange={(e) => setField(e.target.value)} placeholder="1850" /></Field>
      </div>

      <FormSectionTitle>{A("section.conditions")}</FormSectionTitle>

      {weatherStatus !== "done" && weatherStatus !== "simulated" && (
        <div style={{ marginBottom: 16 }}>
          <div className="weather-lookup" style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Field label={A("location")}>
                <LocationAutocomplete
                  value={locationQuery}
                  onChange={(e) => { setLocationQuery(e.target.value); setSelectedPlace(null); }}
                  onSelect={(place) => { setLocationQuery(place.label); setSelectedPlace(place); }}
                  placeholder={A("locationPlaceholder")}
                />
              </Field>
            </div>
            <button
              onClick={handleLocationWeatherLookup}
              disabled={!locationQuery.trim() || weatherStatus === "loading"}
              style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, color: T.bg, background: locationQuery.trim() ? T.brass : T.line, border: "none", borderRadius: 3, padding: "10px 16px", cursor: locationQuery.trim() ? "pointer" : "default", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {A(weatherStatus === "loading" ? "lookingUp" : "lookUpWeather")}
            </button>
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.inkDim, marginTop: 4 }}>{A("locationHint")}</div>
        </div>
      )}
      {statusBanner(weatherStatus, weatherMessage)}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label={A("temp")}><TextInput type="number" value={tempC} onChange={(e) => setTempC(e.target.value)} placeholder="27" /></Field>
        <Field label={A("humidity")}><TextInput type="number" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder="71" /></Field>
        <Field label={A("wind")}><TextInput type="number" value={wind} onChange={(e) => setWind(e.target.value)} placeholder="14" /></Field>
      </div>

      <FormSectionTitle>{A("section.fueling")}</FormSectionTitle>

      {/* Overall vs by-section mode toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["overall", A("fuelModeOverall")], ["sections", A("fuelModeSections")]].map(([mode, label]) => (
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
          <Field label={A("carbs")}><TextInput type="number" value={carbsPerHr} onChange={(e) => setCarbsPerHr(e.target.value)} placeholder="52" /></Field>
          <Field label={A("sodium")}><TextInput type="number" value={sodiumPerHr} onChange={(e) => setSodiumPerHr(e.target.value)} placeholder="280" /></Field>
          <Field label={A("fluids")}><TextInput type="number" value={fluidsPerHr} onChange={(e) => setFluidsPerHr(e.target.value)} placeholder="480" /></Field>
          <Field label={A("caffeine")}><TextInput type="number" value={caffeine} onChange={(e) => setCaffeine(e.target.value)} placeholder="80" /></Field>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginBottom: 14, lineHeight: 1.5 }}>
            {A("sectionsIntro")}
            {fuelSections.length === 0
              ? A("sectionsNeedDistance")
              : parsedSplits.length < 2 && A("sectionsNeedSplits")}
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

      <FormSectionTitle>{A("section.splits")}</FormSectionTitle>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, marginBottom: 14 }}>
        {A("splitsIntro")}
        {showElevCol && A("splitsElevNote", { sport: t(`sport.${sport}`).toLowerCase() })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showElevCol ? "0.6fr 0.7fr 0.6fr 0.6fr 32px" : "0.7fr 0.8fr 0.7fr 32px", gap: 10, marginBottom: 8 }}>
        {(showElevCol
          ? [A("colCheckpoint"), A("colPace"), A("colElev"), A("colTempShort"), ""]
          : [A("colCheckpoint"), A("colPace"), A("colTemp"), ""]
        ).map((h) => (
          <div key={h} style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>{h}</div>
        ))}
      </div>
      {splitRows.map((row, i) => {
        // The column headers above are visual only; each cell carries its own
        // name, e.g. "Pace · split 3".
        const cell = (col) => A("splitCellAria", { col, n: i + 1 });
        return (
        <div key={i} style={{ display: "grid", gridTemplateColumns: showElevCol ? "0.6fr 0.7fr 0.6fr 0.6fr 32px" : "0.7fr 0.8fr 0.7fr 32px", gap: 10, marginBottom: 8 }}>
          <TextInput aria-label={cell(A("colCheckpoint"))} type="number" step="0.1" value={row.km} onChange={(e) => updateSplit(i, "km", e.target.value)} placeholder={i === 0 ? "5" : ""} />
          <TextInput aria-label={cell(A("colPace"))} value={row.pace} onChange={(e) => updateSplit(i, "pace", e.target.value)} placeholder={i === 0 ? "4:42" : ""} />
          {showElevCol && <TextInput aria-label={cell(A("colElev"))} type="number" value={row.elevM} onChange={(e) => updateSplit(i, "elevM", e.target.value)} placeholder={i === 0 ? "120" : ""} />}
          <TextInput aria-label={cell(A("colTemp"))} type="number" value={row.tempC} onChange={(e) => updateSplit(i, "tempC", e.target.value)} />
          <button type="button" onClick={() => removeSplitRow(i)} aria-label={`${A("removeSplit")} ${i + 1}`} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 3, color: T.inkDim, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 13 }}>×</button>
        </div>
        );
      })}
      <button type="button" onClick={addSplitRow} style={{ background: "none", border: `1px dashed ${T.line}`, borderRadius: 3, color: T.inkDim, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.4, padding: "8px 14px", marginTop: 4, marginBottom: 8 }}>
        {A("addSplit")}
      </button>

      {error && (
        <div style={{ marginTop: 18, padding: "12px 16px", background: `${T.ember}14`, border: `1px solid ${T.emberDim}`, borderRadius: 3, color: T.ember, fontFamily: FONT_BODY, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 28, paddingTop: 24, borderTop: `1px solid ${T.line}` }}>
        <button onClick={handleSubmit} style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.6, color: T.bg, background: T.brass, border: "none", borderRadius: 3, padding: "12px 22px", cursor: "pointer", fontWeight: 600 }}>
          {A(editing ? "update" : "save")}
        </button>
        <button onClick={onCancel} style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.6, color: T.inkDim, background: "none", border: `1px solid ${T.line}`, borderRadius: 3, padding: "12px 22px", cursor: "pointer" }}>
          {A("cancel")}
        </button>
      </div>
    </div>
  );
}
