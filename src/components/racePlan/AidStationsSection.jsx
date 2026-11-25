import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { T, FONT_BODY, FONT_MONO } from "../../constants.js";
import { Field, TextInput, FormSectionTitle } from "../ui.jsx";
import ElevationProfile from "../ElevationProfile.jsx";
import CourseMap from "../CourseMap.jsx";
import StationRow from "./StationRow.jsx";

/*
  Section 6 — aid stations: placed on the map and elevation profile, imported
  from the course file, auto-spaced or typed; optional ultra details per
  station; and how much fluid the athlete can carry between them.

  `stations` is the object useAidStations() returns.
*/
export default function AidStationsSection({ gpxData, stations, showUltra, setShowUltraOverride, startTime, carryCapacity, setCarryCapacity, bagSuggestions }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const {
    aidStations, fileStations, otherWaypoints,
    addStation, updateStation, removeStation, autoSpaceStations, importFileStations,
    isPromoted, togglePromoted, addStationAtKm, moveStation, removeStationById,
  } = stations;
  const [showOtherWaypoints, setShowOtherWaypoints] = useState(false);
  const [expandedStation, setExpandedStation] = useState(null);

  // A newly loaded course starts with its other-waypoints list folded away.
  useEffect(() => { setShowOtherWaypoints(false); }, [gpxData]);

  return (
    <>
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
    </>
  );
}
