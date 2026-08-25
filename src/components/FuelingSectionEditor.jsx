import { T, FONT_MONO, FONT_BODY } from "../constants.js";
import { inputStyle } from "./ui.jsx";
import ElevationProfile from "./ElevationProfile.jsx";

// Presentational editor for by-section fuelling. Boundaries are placed on the
// reused elevation profile (when the race has elevation) and/or edited as km in
// the grid; nutrition is entered per section as either a per-hour rate or a
// section total. State + boundary ops live in the parent (AddRaceForm).
export default function FuelingSectionEditor({
  splits, distanceKm, elevationM, hasElev,
  entryMode, setEntryMode,
  sections, rollup,
  onAddBoundary, onMoveBoundary, onRemoveBoundary, onUpdateSection, onAddSection,
}) {
  const amount = entryMode === "amount";
  const units = amount ? { c: "g", s: "mg", f: "ml" } : { c: "g/hr", s: "mg/hr", f: "ml/hr" };
  const boundaryMarkers = sections.slice(0, -1).map((sec) => ({ id: sec.id, km: parseFloat(sec.toKm) }));
  const GRID = "0.9fr 0.6fr 0.8fr 0.8fr 0.8fr 0.7fr 28px";

  const modeBtn = (mode, label) => (
    <button
      type="button"
      onClick={() => setEntryMode(mode)}
      style={{
        fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "6px 12px", borderRadius: 3, cursor: "pointer",
        border: `1px solid ${entryMode === mode ? T.brass : T.line}`,
        background: entryMode === mode ? `${T.brass}1F` : "transparent",
        color: entryMode === mode ? T.brass : T.inkDim,
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      {hasElev ? (
        <div style={{ marginBottom: 14 }}>
          <ElevationProfile
            splits={splits}
            distanceKm={distanceKm}
            elevationM={elevationM}
            stations={boundaryMarkers}
            onAdd={onAddBoundary}
            onMove={onMoveBoundary}
            onRemove={onRemoveBoundary}
          />
        </div>
      ) : (
        <div style={{ marginBottom: 14, fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim }}>
          No per-split elevation on this race — set section boundaries by km in the grid below.
        </div>
      )}

      {/* Entry mode toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.inkDim }}>ENTER AS</span>
        {modeBtn("rate", "RATE / HR")}
        {modeBtn("amount", "TOTAL AMOUNT")}
        {amount && (
          <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.inkDim }}>
            Totals per section, converted to a rate using each section's elapsed time.
          </span>
        )}
      </div>

      {/* Grid header */}
      <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>
        <div>SECTION</div><div>TO KM</div><div>CARBS ({units.c})</div><div>SODIUM ({units.s})</div><div>FLUIDS ({units.f})</div><div>CAFF (mg)</div><div />
      </div>

      {sections.map((sec, i) => {
        const isLast = i === sections.length - 1;
        return (
          <div key={sec.id} style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, padding: "9px 0", borderBottom: `1px solid ${T.line}22`, alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.brass }}>S{i + 1}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 1 }}>from {sec.fromKm}</div>
            </div>
            {isLast ? (
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.inkDim }}>{sec.toKm}</div>
            ) : (
              <input
                type="number" step="0.1" value={sec.toKm}
                onChange={(e) => onMoveBoundary(sec.id, parseFloat(e.target.value))}
                style={{ ...inputStyle, padding: "6px 7px" }}
              />
            )}
            <input type="number" value={sec.carbs} onChange={(e) => onUpdateSection(sec.id, { carbs: e.target.value })} style={{ ...inputStyle, padding: "6px 7px" }} />
            <input type="number" value={sec.sodium} onChange={(e) => onUpdateSection(sec.id, { sodium: e.target.value })} style={{ ...inputStyle, padding: "6px 7px" }} />
            <input type="number" value={sec.fluids} onChange={(e) => onUpdateSection(sec.id, { fluids: e.target.value })} style={{ ...inputStyle, padding: "6px 7px" }} />
            <input type="number" value={sec.caffeine} onChange={(e) => onUpdateSection(sec.id, { caffeine: e.target.value })} style={{ ...inputStyle, padding: "6px 7px" }} />
            <button
              type="button"
              onClick={() => !isLast && onRemoveBoundary(sec.id)}
              disabled={isLast}
              aria-label="Merge section into the next"
              title={isLast ? "" : "Merge into next section"}
              style={{ background: "none", border: "none", color: isLast ? T.line : T.ember, cursor: isLast ? "default" : "pointer", fontFamily: FONT_MONO, fontSize: 15, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAddSection}
        style={{ background: "none", border: `1px dashed ${T.line}`, borderRadius: 3, color: T.inkDim, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "8px 14px", marginTop: 8 }}
      >
        + ADD SECTION
      </button>

      {/* Live roll-up */}
      <div style={{ marginTop: 14, padding: "10px 14px", background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, fontFamily: FONT_MONO, fontSize: 11.5, color: T.ink }}>
        <span style={{ color: T.inkDim, letterSpacing: 0.5 }}>ROLLS UP TO </span>
        {rollup.carbsPerHr} g/hr · {rollup.sodiumPerHr} mg/hr · {rollup.fluidsPerHr} ml/hr · {rollup.caffeine} mg caffeine
      </div>
    </div>
  );
}
