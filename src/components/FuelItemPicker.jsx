import { useTranslation } from "react-i18next";
import { T, FONT_BODY, FONT_MONO } from "../constants.js";
import { FUEL_ITEMS } from "../utils/fuelKit.js";

function stepperStyle(active, size) {
  return {
    width: size, height: size, borderRadius: 3, cursor: "pointer",
    border: `1px solid ${active ? T.brassDim : T.line}`,
    background: "transparent", color: active ? T.brass : T.inkDim,
    fontFamily: FONT_MONO, fontSize: size > 22 ? 15 : 13, lineHeight: 1, padding: 0,
  };
}

/*
  The +/− quantity list over FUEL_ITEMS, shared by the whole-race kit builder in
  RacePlanView and the per-station drop-bag editor in RacePlanForm.

  `dense` drops the per-unit macro line and tightens the rows — a drop bag is
  edited inside an already-busy station row, where the macros are noise.
*/
export default function FuelItemPicker({ quantities, onBump, dense = false }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const size = dense ? 22 : 26;

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
      {FUEL_ITEMS.map((item, i) => {
        const qty = quantities?.[item.key] || 0;
        const macro = [
          item.carbs ? `${item.carbs}g` : null,
          item.sodiumMg ? `${item.sodiumMg}mg Na` : null,
          item.fluidMl ? `${item.fluidMl}ml` : null,
        ].filter(Boolean).join(" · ");
        const name = P(`fuelItem.${item.key}`);
        return (
          <div
            key={item.key}
            style={{
              display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10,
              padding: dense ? "6px 10px" : "10px 14px",
              borderBottom: i < FUEL_ITEMS.length - 1 ? `1px solid ${T.line}33` : "none",
              background: qty > 0 ? "rgba(201,162,75,0.05)" : "transparent",
            }}
          >
            <div>
              <div style={{ fontFamily: FONT_BODY, fontSize: dense ? 13 : 14, color: qty > 0 ? T.paper : T.ink }}>{name}</div>
              {!dense && <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.inkDim, marginTop: 2 }}>{macro || "—"}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={() => onBump(item.key, -1)} aria-label={P("view.kit.removeOne", { item: name })} style={stepperStyle(qty > 0, size)}>−</button>
              <span style={{ fontFamily: FONT_MONO, fontSize: dense ? 13 : 14, color: qty > 0 ? T.brass : T.inkDim, minWidth: 18, textAlign: "center" }}>{qty}</span>
              <button type="button" onClick={() => onBump(item.key, 1)} aria-label={P("view.kit.addOne", { item: name })} style={stepperStyle(true, size)}>+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
