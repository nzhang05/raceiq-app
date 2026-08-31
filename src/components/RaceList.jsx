import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { T, R, FONT_DISPLAY, FONT_BODY, FONT_MONO, SPORTS } from "../constants.js";
import { fmtDate } from "../utils/time.js";
import { verdictColor, verdictKey } from "../utils/ratings.js";
import { Button, Pill } from "./ui.jsx";
import SeasonForm from "./SeasonForm.jsx";
import RowSparkline from "./RowSparkline.jsx";
import SportIcon from "./SportIcon.jsx";

// Mirrored by the header row in RaceList — the two grids are separate
// declarations and will desync silently if only one is edited.
const ROW_COLS = "22px 1.6fr 0.7fr 0.75fr 0.8fr 90px 112px 22px";

function RaceListRow({ race, onOpen, onDelete, onToggleSelect, isSelected, index }) {
  const { t } = useTranslation();
  const isCustom = race.id.startsWith("custom-");
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(race.id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(race.id)}
      className={`race-row${isSelected ? " is-selected" : ""}`}
      style={{
        display: "grid", gridTemplateColumns: ROW_COLS, alignItems: "center",
        minHeight: 66, width: "100%", gap: 14, padding: "12px 18px",
        background: isSelected ? `${T.brass}12` : T.surface,
        border: `1px solid ${isSelected ? `${T.brass}55` : T.line}`,
        borderRadius: R.md, marginBottom: 8, cursor: "pointer",
        textAlign: "left", color: T.paper,
        animation: `fadeIn 280ms ease both`, animationDelay: `${index * 40}ms`,
      }}
    >
      <div
        className="select-cb"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(race.id); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: 5, flexShrink: 0,
          border: `1.5px solid ${isSelected ? T.brass : T.inkDim}`,
          background: isSelected ? T.brass : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isSelected && <span style={{ color: T.bg, fontSize: 11, lineHeight: 1, fontWeight: 700 }}>✓</span>}
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: T.inkDim, display: "flex" }}><SportIcon sport={race.sport} /></span>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{race.name}</span>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim, marginTop: 2 }}>
          {fmtDate(race.date)} · {t(`sport.${race.sport}`)}
        </div>
      </div>

      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>
        {race.distanceKm}<span style={{ color: T.inkDim }}> km</span>
        <div style={{ fontSize: 11, color: T.inkDim, marginTop: 1 }}>+{race.elevationM} m</div>
      </div>

      <div style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 500, color: T.paper }}>{race.finishTime}</div>

      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>
        {race.tempC}°C
        <div style={{ fontSize: 11, color: T.inkDim, marginTop: 1 }}>{t("raceList.humidityShort", { pct: race.humidity })}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <RowSparkline race={race} />
      </div>

      <div>
        <Pill color={verdictColor(race.verdict)}>{t(`verdict.${verdictKey(race.verdict)}`)}</Pill>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isCustom && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(race.id); }}
            aria-label={t("raceList.deleteRaceAria", { name: race.name })}
            title={t("raceList.deleteRace")}
            className="delete-btn"
            style={{ background: "none", border: "none", color: T.inkDim, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 4px", borderRadius: 6 }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export default function RaceList({ races, onOpen, onAddRace, onPlanRace, onDelete, selectedIds, onToggleSelect, onCompare, onClearSelection }) {
  const { t } = useTranslation();
  const [sport, setSport] = useState("All");
  const filtered = useMemo(
    () => (sport === "All" ? races : races.filter((r) => r.sport === sport)),
    [sport, races]
  );
  // Tracks the sport chips, like the season-form card does — the sub-line
  // describes the list below it, not a total that ignores the filter.
  const totalDistanceKm = useMemo(
    () => Math.round(filtered.reduce((sum, r) => sum + r.distanceKm, 0)),
    [filtered]
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 700, margin: 0, color: T.paper, letterSpacing: -0.6 }}>
            {t("raceList.title")}
          </h1>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.inkDim, marginTop: 4 }}>
            {t("raceList.meta", { count: filtered.length, km: totalDistanceKm })} · {t("raceList.subtitle")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" onClick={onPlanRace}>{t("nav.planRace")}</Button>
          <Button onClick={onAddRace}>{t("raceList.addRace")}</Button>
        </div>
      </div>

      <SeasonForm races={filtered} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            style={{
              fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, padding: "7px 14px", borderRadius: R.pill,
              border: `1px solid ${sport === s ? `${T.brass}66` : T.line}`,
              background: sport === s ? `${T.brass}18` : "transparent",
              color: sport === s ? T.brass : T.ink, cursor: "pointer", transition: "all 140ms ease",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <SportIcon sport={s} size={14} />
              {t(`sport.${s}`)}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: ROW_COLS, gap: 14, padding: "0 18px 10px", fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 500, color: T.inkDim }}>
        <div /><div>{t("raceList.col.race")}</div><div>{t("raceList.col.distance")}</div><div>{t("raceList.col.finish")}</div><div>{t("raceList.col.conditions")}</div><div>{t("raceList.col.shape")}</div><div>{t("raceList.col.debrief")}</div><div />
      </div>

      <div>
        {filtered.map((r, i) => (
          <RaceListRow key={r.id} race={r} onOpen={onOpen} onDelete={onDelete} onToggleSelect={onToggleSelect} isSelected={selectedIds.has(r.id)} index={i} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "48px 18px", textAlign: "center", color: T.inkDim, fontFamily: FONT_BODY, fontSize: 15 }}>
            {t("raceList.empty")}
          </div>
        )}
      </div>

      {selectedIds.size >= 2 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: T.surfaceHi, border: `1px solid ${T.line}`, borderRadius: R.pill, padding: "10px 12px 10px 22px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 10px 34px rgba(20,26,33,0.16)" }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: T.ink }}>
            {t("raceList.selected", { count: selectedIds.size })}
          </span>
          {selectedIds.size > 3 && (
            <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.ember }}>{t("raceList.maxThree")}</span>
          )}
          <Button onClick={onCompare} disabled={selectedIds.size > 3} style={{ opacity: selectedIds.size > 3 ? 0.5 : 1 }}>{t("raceList.compare")}</Button>
          <button
            onClick={onClearSelection}
            style={{ fontFamily: FONT_BODY, fontSize: 13, padding: "8px 12px", borderRadius: R.pill, border: "none", background: "transparent", color: T.inkDim, cursor: "pointer" }}
          >
            {t("actions.clear")}
          </button>
        </div>
      )}
    </div>
  );
}
