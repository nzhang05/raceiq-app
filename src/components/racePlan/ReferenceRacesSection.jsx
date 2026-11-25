import { useTranslation } from "react-i18next";
import { T, FONT_BODY, FONT_MONO } from "../../constants.js";
import { fmtDate } from "../../utils/time.js";
import { FormSectionTitle } from "../ui.jsx";

/* Section 2 — the past races the plan learns pace and fueling from. */
export default function ReferenceRacesSection({ sport, candidateRaces, selectedRaceIds, selectedRaces, allSelected, toggleRace, toggleAll }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });

  return (
    <>
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
                      {checked && <span style={{ color: T.bg, fontSize: 12.5, lineHeight: 1, fontFamily: FONT_MONO }}>✓</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: checked ? T.paper : T.inkDim }}>{race.name}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: T.inkDim, marginTop: 2 }}>{fmtDate(race.date)} · {race.distanceKm} km</div>
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: checked ? T.paper : T.inkDim, textAlign: "right" }}>
                    {race.finishTime}
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: T.inkDim, textAlign: "right" }}>
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
    </>
  );
}
