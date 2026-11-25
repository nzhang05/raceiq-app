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

/*
  The whole row is a mouse target, but for keyboard and screen readers the
  row's controls are three real buttons side by side — open (the race name),
  select-for-compare and delete — rather than buttons nested inside a
  role="button", which assistive tech can't operate reliably.
*/
function RaceListRow({ race, onOpen, onDelete, onToggleSelect, isSelected, index }) {
  const { t } = useTranslation();
  const isCustom = race.id.startsWith("custom-");
  return (
    <div
      onClick={() => onOpen(race.id)}
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
      <button
        type="button"
        role="checkbox"
        aria-checked={isSelected}
        aria-label={t("raceList.selectAria", { name: race.name })}
        className="select-cb rl-cb"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(race.id); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "none", border: "none", padding: 3, margin: -3 }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: 5, flexShrink: 0,
          border: `1.5px solid ${isSelected ? T.brass : T.inkDim}`,
          background: isSelected ? T.brass : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isSelected && <span aria-hidden="true" style={{ color: T.bg, fontSize: 11, lineHeight: 1, fontWeight: 700 }}>✓</span>}
        </div>
      </button>

      <div className="rl-name" style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden="true" style={{ color: T.inkDim, display: "flex" }}><SportIcon sport={race.sport} /></span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(race.id); }}
            style={{ all: "unset", cursor: "pointer", minWidth: 0, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {race.name}
          </button>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.inkDim, marginTop: 2 }}>
          {fmtDate(race.date)} · {t(`sport.${race.sport}`)}
        </div>
      </div>

      <div className="rl-dist" style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>
        {race.distanceKm}<span style={{ color: T.inkDim }}> km</span>
        <div style={{ fontSize: 11, color: T.inkDim, marginTop: 1 }}>+{race.elevationM} m</div>
      </div>

      <div className="rl-finish" style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 500, color: T.paper }}>{race.finishTime}</div>

      <div className="rl-cond" style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>
        {race.tempC}°C
        <div style={{ fontSize: 11, color: T.inkDim, marginTop: 1 }}>{t("raceList.humidityShort", { pct: race.humidity })}</div>
      </div>

      <div className="rl-shape" aria-hidden="true" style={{ display: "flex", alignItems: "center" }}>
        <RowSparkline race={race} />
      </div>

      <div className="rl-verdict">
        <Pill color={verdictColor(race.verdict)}>{t(`verdict.${verdictKey(race.verdict)}`)}</Pill>
      </div>

      <div className="rl-del" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isCustom && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              // Visible on touch screens now, so one stray tap mustn't lose a race.
              if (window.confirm(t("raceList.deleteConfirm", { name: race.name }))) onDelete(race.id);
            }}
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

// A signed-in athlete with nothing logged yet. Says what the app does with a
// race and offers both ways in, rather than an empty table.
function FirstRaceEmptyState({ onAddRace, onPlanRace }) {
  const { t } = useTranslation();
  return (
    <div style={{ background: T.surface, border: `1px dashed ${T.line}`, borderRadius: R.lg, padding: "40px 28px", textAlign: "center" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: T.paper, marginBottom: 8 }}>{t("raceList.first.title")}</div>
      <p style={{ fontFamily: FONT_BODY, fontSize: 15, color: T.ink, lineHeight: 1.6, maxWidth: 460, margin: "0 auto 22px" }}>{t("raceList.first.body")}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Button onClick={onAddRace}>{t("raceList.addRace")}</Button>
        <Button variant="secondary" onClick={onPlanRace}>{t("nav.planRace")}</Button>
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

  if (races.length === 0) {
    return (
      <div>
        <h1 className="page-title" style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 700, margin: "0 0 24px", color: T.paper, letterSpacing: -0.6 }}>
          {t("raceList.title")}
        </h1>
        <FirstRaceEmptyState onAddRace={onAddRace} onPlanRace={onPlanRace} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 700, margin: 0, color: T.paper, letterSpacing: -0.6 }}>
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

      <div role="group" aria-label={t("raceList.filterAria")} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {SPORTS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={sport === s}
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

      <div className="race-list-head" aria-hidden="true" style={{ display: "grid", gridTemplateColumns: ROW_COLS, gap: 14, padding: "0 18px 10px", fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 500, color: T.inkDim }}>
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
        <div className="compare-bar" role="region" aria-label={t("raceList.compare")} style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: T.surfaceHi, border: `1px solid ${T.line}`, borderRadius: R.pill, padding: "10px 12px 10px 22px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 10px 34px rgba(20,26,33,0.16)" }}>
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
