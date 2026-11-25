import { useTranslation } from "react-i18next";
import { T, FONT_BODY, FONT_MONO } from "../../constants.js";
import { inputStyle } from "../ui.jsx";
import FuelItemPicker from "../FuelItemPicker.jsx";

// Compact on/off pill used for the water / food refill flags on each aid station.
export function StationToggle({ on, onClick }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{
        fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, fontWeight: 600,
        width: 42, padding: "5px 0", borderRadius: 3, cursor: "pointer",
        border: `1px solid ${on ? T.brassDim : T.line}`,
        background: on ? `${T.brass}1F` : "transparent",
        color: on ? T.brass : T.inkDim,
      }}
    >
      {t(on ? "form.toggleYes" : "form.toggleNo", { ns: "plan" })}
    </button>
  );
}

// Small labelled number/text cell used inside the expanded station panel.
function MiniField({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.1, color: T.inkDim, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

/*
  One aid station.

  Collapsed it is the original compact row — km, name, water, food — so a road
  marathon sees exactly what it saw before. Expanding reveals the ultra fields:
  stop time, sleep, cutoff, crew access and the drop bag. Nine fields per station
  in a flat grid would be unusable; this keeps data entry proportional to the
  race being planned.
*/
export default function StationRow({ station, index, distanceKm, showUltra, expanded, onToggleExpand, onUpdate, onRemove, suggestions }) {
  const { t } = useTranslation();
  const P = (key, opts) => t(key, { ns: "plan", ...opts });
  const kmNum = parseFloat(station.km);
  const outOfRange = distanceKm && !isNaN(kmNum) && (kmNum <= 0 || kmNum >= distanceKm);
  const bag = station.dropBag;
  // inputStyle is content-box; inside the panel's narrow columns that overflows,
  // so the panel's own inputs opt into border-box.
  const panelInput = { ...inputStyle, padding: "7px 8px", boxSizing: "border-box" };
  const cols = showUltra ? "70px 1fr auto auto auto 32px" : "80px 1fr auto auto 32px";

  // Compact summary of what's configured underneath, so the athlete can scan the
  // collapsed list and see where the long stops and the bags are.
  const badges = [
    station.stopMinutes > 0 ? P("form.ultra.badgeStop", { minutes: station.stopMinutes }) : null,
    station.sleepMinutes > 0 ? P("form.ultra.badgeSleep") : null,
    bag ? P("form.ultra.badgeBag") : null,
    station.crewAccess ? P("form.ultra.badgeCrew") : null,
    station.cutoff ? P("form.ultra.badgeCutoff", { cutoff: station.cutoff }) : null,
  ].filter(Boolean);

  function bumpBagItem(key, delta) {
    const items = { ...(bag?.items ?? {}) };
    items[key] = Math.max(0, (items[key] || 0) + delta);
    if (items[key] === 0) delete items[key];
    onUpdate({ dropBag: { ...(bag ?? { gear: [], notes: "" }), items } });
  }
  function updateGear(i, value) {
    const gear = [...(bag?.gear ?? [])];
    gear[i] = value;
    onUpdate({ dropBag: { ...bag, gear } });
  }
  function addGear(value = "") {
    onUpdate({ dropBag: { ...(bag ?? { items: {}, notes: "" }), gear: [...(bag?.gear ?? []), value] } });
  }
  function removeGear(i) {
    onUpdate({ dropBag: { ...bag, gear: (bag?.gear ?? []).filter((_, j) => j !== i) } });
  }
  function acceptSuggestion(s) {
    if (s.kind === "item") bumpBagItem(s.itemKey, s.qty);
    else addGear(P(s.key));
  }

  return (
    <div style={{ borderBottom: `1px solid ${T.line}33` }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 10, padding: "9px 12px", alignItems: "center" }}>
        <input
          type="number"
          value={station.km}
          // Editing the distance is the athlete resolving the ambiguity,
          // so the flag — and its warning border — retires with the edit.
          onChange={(e) => onUpdate({ km: e.target.value, ambiguous: false })}
          placeholder="km"
          title={station.ambiguous ? P("form.waypoints.ambiguousTitle") : ""}
          style={{ ...inputStyle, padding: "7px 8px", borderColor: outOfRange ? T.ember : station.ambiguous ? T.brass : T.line }}
        />
        <div>
          <input
            value={station.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={P("point.aid", { n: index + 1 })}
            style={{ ...inputStyle, padding: "7px 8px" }}
          />
          {showUltra && badges.length > 0 && !expanded && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {badges.map((b) => (
                <span key={b} style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.1, color: T.brass, background: "rgba(201,162,75,0.1)", borderRadius: 2, padding: "1px 5px" }}>{b}</span>
              ))}
            </div>
          )}
        </div>
        <StationToggle on={station.water} onClick={() => onUpdate({ water: !station.water })} />
        <StationToggle on={station.food} onClick={() => onUpdate({ food: !station.food })} />
        {showUltra && (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.5, padding: "6px 9px", borderRadius: 3, border: `1px solid ${expanded ? T.brassDim : T.line}`, background: "transparent", color: expanded ? T.brass : T.inkDim, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {expanded ? P("form.ultra.collapse") : P("form.ultra.expand")}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={P("form.removeStation")}
          style={{ background: "none", border: "none", color: T.ember, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 16, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      </div>

      {showUltra && expanded && (
        <div style={{ padding: "4px 12px 16px", background: "rgba(0,0,0,0.15)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            <MiniField label={P("form.ultra.stop")}>
              <input type="number" min="0" value={station.stopMinutes ?? ""} onChange={(e) => onUpdate({ stopMinutes: e.target.value })} placeholder="0" style={panelInput} />
            </MiniField>
            <MiniField label={P("form.ultra.sleep")}>
              <input type="number" min="0" value={station.sleepMinutes ?? ""} onChange={(e) => onUpdate({ sleepMinutes: e.target.value })} placeholder="0" style={panelInput} />
            </MiniField>
            <MiniField label={P("form.ultra.cutoff")}>
              <input value={station.cutoff ?? ""} onChange={(e) => onUpdate({ cutoff: e.target.value })} placeholder="HH:MM" style={panelInput} />
            </MiniField>
            <MiniField label={P("form.ultra.crew")}>
              <StationToggle on={station.crewAccess === true} onClick={() => onUpdate({ crewAccess: !station.crewAccess })} />
            </MiniField>
          </div>

          {station.sleepMinutes > 0 && station.sleepMinutes > (station.stopMinutes || 0) && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: T.ember, marginBottom: 12 }}>
              {P("form.ultra.sleepExceedsStop")}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: bag ? 12 : 0 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.1, color: T.inkDim }}>{P("form.ultra.dropBag")}</span>
            <StationToggle on={!!bag} onClick={() => onUpdate({ dropBag: bag ? null : { items: {}, gear: [], notes: "" } })} />
          </div>

          {bag && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
              <FuelItemPicker quantities={bag.items} onBump={bumpBagItem} dense />
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.1, color: T.inkDim, marginBottom: 6 }}>{P("form.ultra.gear")}</div>
                {(bag.gear ?? []).map((line, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input value={line} onChange={(e) => updateGear(i, e.target.value)} placeholder={P("form.ultra.gearPlaceholder")} style={{ ...panelInput, padding: "6px 8px", flex: 1, minWidth: 0 }} />
                    <button type="button" onClick={() => removeGear(i)} aria-label={P("form.ultra.removeGear")} style={{ background: "none", border: "none", color: T.ember, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 15, padding: 0 }}>×</button>
                  </div>
                ))}
                <button type="button" onClick={() => addGear()} style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.5, padding: "5px 9px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.ink, cursor: "pointer" }}>
                  {P("form.ultra.addGear")}
                </button>

                <input
                  value={bag.notes ?? ""}
                  onChange={(e) => onUpdate({ dropBag: { ...bag, notes: e.target.value } })}
                  placeholder={P("form.ultra.notesPlaceholder")}
                  style={{ ...panelInput, marginTop: 10 }}
                />

                {/* Derived suggestions — one tap to accept, never auto-inserted. */}
                {suggestions?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: 0.1, color: T.inkDim, marginBottom: 6 }}>{P("form.ultra.suggested")}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => acceptSuggestion(s)}
                          title={s.values ? P(s.key, s.values) : ""}
                          style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.4, padding: "5px 9px", borderRadius: 3, border: `1px dashed ${T.brassDim}`, background: "transparent", color: T.brass, cursor: "pointer" }}
                        >
                          + {s.kind === "item" ? P("form.ultra.suggestItem", { qty: s.qty, item: P(`fuelItem.${s.itemKey}`) }) : P(s.key)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
