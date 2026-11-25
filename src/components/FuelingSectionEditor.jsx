import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          {t("fuelSections.noElevation")}
        </div>
      )}

      {/* Entry mode toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.inkDim }}>{t("fuelSections.enterAs")}</span>
        {modeBtn("rate", t("fuelSections.modeRate"))}
        {modeBtn("amount", t("fuelSections.modeAmount"))}
        {amount && (
          <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.inkDim }}>
            {t("fuelSections.amountNote")}
          </span>
        )}
      </div>

      {/* Grid header */}
      <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>
        <div>{t("fuelSections.colSection")}</div><div>{t("fuelSections.colToKm")}</div><div>{t("fuelSections.colCarbs", { unit: units.c })}</div><div>{t("fuelSections.colSodium", { unit: units.s })}</div><div>{t("fuelSections.colFluids", { unit: units.f })}</div><div>{t("fuelSections.colCaffeine")}</div><div />
      </div>

      {sections.map((sec, i) => {
        const isLast = i === sections.length - 1;
        // Each cell is named "<column> · S<n>", since the visual column header
        // isn't programmatically tied to the inputs in this CSS grid.
        const cell = (col) => t("fuelSections.cellAria", { col, n: i + 1 });
        return (
          <div key={sec.id} style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, padding: "9px 0", borderBottom: `1px solid ${T.line}22`, alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.brass }}>S{i + 1}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 1 }}>{t("fuelSections.fromKm", { km: sec.fromKm })}</div>
            </div>
            {isLast ? (
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.inkDim }}>{sec.toKm}</div>
            ) : (
              <input
                type="number" step="0.1" value={sec.toKm}
                onChange={(e) => onMoveBoundary(sec.id, parseFloat(e.target.value))}
                aria-label={cell(t("fuelSections.colToKm"))}
                style={{ ...inputStyle, padding: "6px 7px" }}
              />
            )}
            <input type="number" aria-label={cell(t("fuelSections.colCarbs", { unit: units.c }))} value={sec.carbs} onChange={(e) => onUpdateSection(sec.id, { carbs: e.target.value })} style={{ ...inputStyle, padding: "6px 7px" }} />
            <input type="number" aria-label={cell(t("fuelSections.colSodium", { unit: units.s }))} value={sec.sodium} onChange={(e) => onUpdateSection(sec.id, { sodium: e.target.value })} style={{ ...inputStyle, padding: "6px 7px" }} />
            <input type="number" aria-label={cell(t("fuelSections.colFluids", { unit: units.f }))} value={sec.fluids} onChange={(e) => onUpdateSection(sec.id, { fluids: e.target.value })} style={{ ...inputStyle, padding: "6px 7px" }} />
            <input type="number" aria-label={cell(t("fuelSections.colCaffeine"))} value={sec.caffeine} onChange={(e) => onUpdateSection(sec.id, { caffeine: e.target.value })} style={{ ...inputStyle, padding: "6px 7px" }} />
            <button
              type="button"
              onClick={() => !isLast && onRemoveBoundary(sec.id)}
              disabled={isLast}
              aria-label={t("fuelSections.mergeAria")}
              title={isLast ? "" : t("fuelSections.mergeTitle")}
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
        {t("fuelSections.addSection")}
      </button>

      {/* Live roll-up */}
      <div style={{ marginTop: 14, padding: "10px 14px", background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, fontFamily: FONT_MONO, fontSize: 11.5, color: T.ink }}>
        <span style={{ color: T.inkDim, letterSpacing: 0.5 }}>{t("fuelSections.rollsUpTo")}</span>
        {t("fuelSections.rollup", { carbs: rollup.carbsPerHr, sodium: rollup.sodiumPerHr, fluids: rollup.fluidsPerHr, caffeine: rollup.caffeine })}
      </div>
    </div>
  );
}
