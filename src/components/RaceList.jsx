import { useState, useMemo } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, SPORTS } from "../constants.js";
import { fmtDate } from "../utils/time.js";
import { verdictColor, verdictLabel } from "../utils/ratings.js";

const ROW_COLS = "28px 1.2fr 0.7fr 0.55fr 0.5fr 0.55fr 0.45fr 0.6fr 28px";

function RaceListRow({ race, onOpen, onDelete, onToggleSelect, isSelected, index }) {
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
        minHeight: 68, width: "100%", gap: 12, padding: "14px 18px",
        background: isSelected ? "rgba(201,162,75,0.05)" : "transparent",
        borderBottom: `1px solid ${T.line}`, cursor: "pointer",
        textAlign: "left", color: T.paper,
        animation: `fadeIn 280ms ease both`, animationDelay: `${index * 45}ms`,
      }}
    >
      <div
        className="select-cb"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(race.id); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: 2, flexShrink: 0,
          border: `1.5px solid ${isSelected ? T.brass : T.inkDim}`,
          background: isSelected ? T.brass : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isSelected && <span style={{ color: T.bg, fontSize: 9, lineHeight: 1, fontFamily: FONT_MONO }}>✓</span>}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 16, letterSpacing: 0.2 }}>{race.name}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 3 }}>
          {fmtDate(race.date)} · {race.sport}
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>
        {race.distanceKm} km
        <div style={{ fontSize: 10, color: T.inkDim }}>+{race.elevationM}m</div>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600 }}>{race.finishTime}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink, lineHeight: 1.4 }}>
        {race.placement}<span style={{ color: T.inkDim }}>/{race.field}</span>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{race.percentile}th pct</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>
        {race.tempC}°C
        <div style={{ fontSize: 10, color: T.inkDim }}>{race.humidity}% hum</div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.6, color: verdictColor(race.verdict), justifySelf: "start" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: verdictColor(race.verdict), display: "inline-block", flexShrink: 0 }} />
        {verdictLabel(race.verdict)}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isCustom && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(race.id); }}
            aria-label={`Delete ${race.name}`}
            title="Delete race"
            className="delete-btn"
            style={{ background: "none", border: "none", color: T.ember, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 3 }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export default function RaceList({ races, onOpen, onAddRace, onPlanRace, onDelete, selectedIds, onToggleSelect, onCompare, onClearSelection }) {
  const [sport, setSport] = useState("All");
  const filtered = useMemo(
    () => (sport === "All" ? races : races.filter((r) => r.sport === sport)),
    [sport, races]
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 600, margin: 0, color: T.paper, letterSpacing: 0.2 }}>
          Race History
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onPlanRace}
            style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "9px 16px", borderRadius: 3, border: `1px solid ${T.brassDim}`, background: "transparent", color: T.brass, cursor: "pointer", fontWeight: 600 }}
          >
            PLAN A RACE
          </button>
          <button
            onClick={onAddRace}
            style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "9px 16px", borderRadius: 3, border: "none", background: T.brass, color: T.bg, cursor: "pointer", fontWeight: 600 }}
          >
            + ADD RACE
          </button>
        </div>
      </div>

      {(() => {
        const totalDist = Math.round(races.reduce((s, r) => s + r.distanceKm, 0));
        const strengthCount = races.filter((r) => r.verdict === "strength").length;
        const limiterCount = races.filter((r) => r.verdict === "limiter").length;
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Races Logged", value: races.length, bg: T.bg2, border: T.line, accent: T.paper },
              { label: "Total Distance", value: `${totalDist}km`, bg: T.bg2, border: T.line, accent: T.paper },
              { label: "Strength Tags", value: strengthCount, bg: T.greenDim, border: T.green + "40", accent: T.green },
              { label: "Limiter Tags", value: limiterCount, bg: T.emberDim, border: T.ember + "40", accent: T.ember },
            ].map(({ label, value, bg, border, accent }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: "16px 20px" }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.6, color: T.inkDim, marginBottom: 10 }}>{label.toUpperCase()}</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600, color: accent, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            style={{
              fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "7px 12px", borderRadius: 3,
              border: `1px solid ${sport === s ? T.brass : T.line}`,
              background: sport === s ? "rgba(201,162,75,0.12)" : "transparent",
              color: sport === s ? T.brass : T.inkDim, cursor: "pointer",
            }}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: ROW_COLS, gap: 12, padding: "0 18px 10px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.8, color: T.inkDim }}>
        <div /><div>RACE</div><div>DISTANCE</div><div>FINISH</div><div>PLACE</div><div>RESULT</div><div>CONDITIONS</div><div>DEBRIEF</div><div />
      </div>

      <div>
        {filtered.map((r, i) => (
          <RaceListRow key={r.id} race={r} onOpen={onOpen} onDelete={onDelete} onToggleSelect={onToggleSelect} isSelected={selectedIds.has(r.id)} index={i} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "40px 18px", color: T.inkDim, fontFamily: FONT_BODY, fontSize: 15 }}>
            No races logged in this sport yet. Import a race to start building your resume.
          </div>
        )}
      </div>

      {selectedIds.size >= 2 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, background: T.bg2, borderTop: `1px solid ${T.line}`, padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, boxShadow: "0 -4px 24px rgba(0,0,0,0.4)" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink, letterSpacing: 0.5 }}>
            {selectedIds.size} RACES SELECTED
          </span>
          <button
            onClick={onCompare}
            disabled={selectedIds.size > 3}
            style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, fontWeight: 600, padding: "9px 20px", borderRadius: 3, border: "none", background: T.brass, color: T.bg, cursor: "pointer" }}
          >
            COMPARE →
          </button>
          <button
            onClick={onClearSelection}
            style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "9px 14px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.inkDim, cursor: "pointer" }}
          >
            × CLEAR
          </button>
          {selectedIds.size > 3 && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ember }}>Max 3 races</span>
          )}
        </div>
      )}
    </div>
  );
}
