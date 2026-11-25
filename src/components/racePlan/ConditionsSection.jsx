import { useState } from "react";
import { useTranslation } from "react-i18next";
import { T, FONT_BODY, FONT_MONO } from "../../constants.js";
import { geocodeLocation } from "../../utils/weather.js";
import { forecastWeather } from "../../utils/racePlan.js";
import { fmtDate } from "../../utils/time.js";
import { errorText } from "../../i18n/render.js";
import { Field, TextInput, FormSectionTitle, LocationAutocomplete } from "../ui.jsx";

/*
  Section 3 — race-day conditions. The location search is this section's own
  business; what the rest of the form needs (temperature, humidity, wind, and
  sunrise/sunset for darkness markers) is lifted through the setters.
*/
export default function ConditionsSection({ raceDate, tempC, setTempC, humidity, setHumidity, wind, setWind, onSun }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [weatherStatus, setWeatherStatus] = useState(null);
  const [weatherMessage, setWeatherMessage] = useState("");

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
    onSun({ sunrise: forecast.sunrise ?? null, sunset: forecast.sunset ?? null });
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

  const statusColor = { done: T.green, simulated: T.brass, error: T.ember, loading: T.inkDim };

  return (
    <>
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
    </>
  );
}
