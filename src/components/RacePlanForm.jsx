import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, SPORT_OPTIONS } from "../constants.js";
import { parseRouteFile } from "../utils/gpx.js";
import { sanitizeAidStations } from "../utils/aidStations.js";
import { buildRacePlan, minutesToClock } from "../utils/racePlan.js";
import { fuelingBenchmarks, personalizeFueling } from "../utils/fueling.js";
import { parseClockToMinutes } from "../utils/time.js";
import { errorText } from "../i18n/render.js";
import { suggestAllBags } from "../utils/dropBags.js";
import { isUltra } from "../utils/schedule.js";
import { useAuth } from "../context/AuthContext.jsx";
import { stationsFromParsed, describeWaypointImport } from "./racePlan/stations.js";
import useReferenceRaces from "./racePlan/useReferenceRaces.js";
import useAidStations from "./racePlan/useAidStations.js";
import useTargetEstimate from "./racePlan/useTargetEstimate.js";
import CourseSection from "./racePlan/CourseSection.jsx";
import ReferenceRacesSection from "./racePlan/ReferenceRacesSection.jsx";
import ConditionsSection from "./racePlan/ConditionsSection.jsx";
import TargetSection from "./racePlan/TargetSection.jsx";
import FuelingSection from "./racePlan/FuelingSection.jsx";
import AidStationsSection from "./racePlan/AidStationsSection.jsx";

/*
  Plan an upcoming race: six sections, one plan.

  This component owns the state that crosses sections — the parsed course,
  the conditions, the target, the fueling overrides, the aid stations — and
  turns it into a plan on submit. Each section lives in ./racePlan and only
  renders and edits its slice. Behaviour is pinned by
  src/__tests__/RacePlanForm.test.jsx, including a snapshot of the plan built.
*/
export default function RacePlanForm({ allRaces, onPlanGenerated, onCancel }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const { user, profile } = useAuth();
  const [sport, setSport] = useState(SPORT_OPTIONS[0]);
  const [raceDate, setRaceDate] = useState(new Date().toISOString().slice(0, 10));
  const [gpxData, setGpxData] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState("");

  const refs = useReferenceRaces(allRaces, sport);
  const { selectedRaces } = refs;

  // Conditions
  const [tempC, setTempC] = useState("");
  const [humidity, setHumidity] = useState("");
  const [wind, setWind] = useState("");
  // Sunrise/sunset for the race date, from the same forecast call. Drives the
  // darkness markers; stays null when the lookup was skipped or unavailable.
  const [forecastSun, setForecastSun] = useState({ sunrise: null, sunset: null });

  // Target time
  const [targetClock, setTargetClock] = useState("");
  const estimate = useTargetEstimate({ gpxData, sport, tempC, selectedRaces, allRaces, user, profile, setTargetClock, P });

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

  // Carry capacity and start time. Without a start time there are no
  // wall-clock ETAs, so the whole schedule/crew-sheet layer stays switched off.
  const [carryCapacity, setCarryCapacity] = useState("");
  const [startTime, setStartTime] = useState("");

  // Ultra fields show themselves for long races and hide behind a link for short
  // ones; `showUltraOverride` is the athlete pulling rank either way.
  const [showUltraOverride, setShowUltraOverride] = useState(null);
  const targetMinutes = useMemo(() => parseClockToMinutes(targetClock) || 0, [targetClock]);
  const ultraByCourse = isUltra(gpxData?.distanceKm, targetMinutes);
  const showUltra = showUltraOverride ?? ultraByCourse;

  const stations = useAidStations({ gpxData, sport, ultraByCourse, targetMinutes, P });
  const { aidStations, setAidStations } = stations;

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

  async function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus("loading");
    setImportMessage("");
    setGpxData(null);
    try {
      const parsed = await parseRouteFile(file, sport);
      setGpxData(parsed);

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

      <CourseSection
        sport={sport} setSport={setSport}
        raceDate={raceDate} setRaceDate={setRaceDate}
        startTime={startTime} setStartTime={setStartTime}
        gpxData={gpxData} importStatus={importStatus} importMessage={importMessage}
        onFileImport={handleFileImport}
      />

      <ReferenceRacesSection sport={sport} {...refs} />

      <ConditionsSection
        raceDate={raceDate}
        tempC={tempC} setTempC={setTempC}
        humidity={humidity} setHumidity={setHumidity}
        wind={wind} setWind={setWind}
        onSun={setForecastSun}
      />

      <TargetSection {...estimate} targetClock={targetClock} setTargetClock={setTargetClock} />

      <FuelingSection
        derivedFueling={derivedFueling}
        fuelCarbs={fuelCarbs} setFuelCarbs={setFuelCarbs}
        fuelSodium={fuelSodium} setFuelSodium={setFuelSodium}
        fuelFluids={fuelFluids} setFuelFluids={setFuelFluids}
        fuelCaffeine={fuelCaffeine} setFuelCaffeine={setFuelCaffeine}
      />

      <AidStationsSection
        gpxData={gpxData}
        stations={stations}
        showUltra={showUltra}
        setShowUltraOverride={setShowUltraOverride}
        startTime={startTime}
        carryCapacity={carryCapacity}
        setCarryCapacity={setCarryCapacity}
        bagSuggestions={bagSuggestions}
      />

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
          {P("form.cancel")}
        </button>
      </div>
    </form>
  );
}
