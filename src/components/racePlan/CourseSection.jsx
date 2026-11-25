import { useTranslation } from "react-i18next";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, SPORT_OPTIONS } from "../../constants.js";
import { Field, TextInput, Select, FormSectionTitle } from "../ui.jsx";

/* Section 1 — the course: sport, date, start time and the GPX/TCX upload. */
export default function CourseSection({ sport, setSport, raceDate, setRaceDate, startTime, setStartTime, gpxData, importStatus, importMessage, onFileImport }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const importColor = { done: T.green, error: T.ember, loading: T.inkDim };

  return (
    <>
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
          <TextInput value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder={P("form.startTimePlaceholder")} />
        </Field>
      </div>

      <Field label={P("form.upload")}>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "14px 16px", border: `1px dashed ${importStatus === "done" ? T.green : T.line}`, borderRadius: 4, background: T.bg2, transition: "border-color 150ms" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>{P("form.chooseFile")}</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: gpxData ? T.paper : T.inkDim }}>
            {gpxData ? gpxData.name : P("form.noFile")}
          </span>
          <input type="file" accept=".gpx,.tcx" onChange={onFileImport} style={{ display: "none" }} />
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
    </>
  );
}
