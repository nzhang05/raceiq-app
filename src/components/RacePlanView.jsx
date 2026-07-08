import { useState, useMemo } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../constants.js";
import { Recommendation } from "./ui.jsx";
import { FUEL_ITEMS, tallyKit } from "../utils/fuelKit.js";
import { printPlan } from "../utils/planPdf.js";

function fmtPace(minPerKm) {
  if (!minPerKm || minPerKm <= 0) return "—";
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function labelColor(label) {
  if (label === "CLIMB") return T.brass;
  if (label === "DESCENT") return T.green;
  return T.inkDim;
}

function fmtDuration(min) {
  if (min == null || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} min`;
}

function stepperStyle(active) {
  return {
    width: 26, height: 26, borderRadius: 3, cursor: "pointer",
    border: `1px solid ${active ? T.brassDim : T.line}`,
    background: "transparent", color: active ? T.brass : T.inkDim,
    fontFamily: FONT_MONO, fontSize: 15, lineHeight: 1, padding: 0,
  };
}

// Tiny provenance chip on each nutrition row: where the number came from.
function SourceTag({ source }) {
  const map = {
    manual: { text: "YOU", color: T.green },
    history: { text: "HISTORY", color: T.brass },
    generic: { text: "DEFAULT", color: T.inkDim },
  };
  const s = map[source];
  if (!s) return null;
  return (
    <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: 0.5, color: s.color, border: `1px solid ${s.color}`, borderRadius: 2, padding: "1px 4px", opacity: 0.85 }}>
      {s.text}
    </span>
  );
}

function KitProgress({ label, value, target, unit }) {
  const pct = target > 0 ? Math.min(1, value / target) : value > 0 ? 1 : 0;
  const met = target > 0 && value >= target;
  const barColor = met ? T.green : T.brass;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, color: T.inkDim }}>{label.toUpperCase()}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: met ? T.green : T.paper }}>
          {value}<span style={{ color: T.inkDim }}> / {target} {unit}</span>
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: T.line, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: barColor, transition: "width 160ms ease" }} />
      </div>
    </div>
  );
}

export default function RacePlanView({ plan, onBack, onLogRace, onAskCoach }) {
  const { course, targetClock, pacing, pacingSections, nutrition, carryPlan, recommendations, referenceRace, weather, raceDate } = plan;

  const [kitQty, setKitQty] = useState({});
  const kit = useMemo(() => tallyKit(kitQty), [kitQty]);
  const bumpKit = (key, delta) =>
    setKitQty((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) + delta) }));

  // What the kit should add up to: the carry-plan race total when aid stations were
  // set, otherwise the whole-race target derived from per-hour rates × duration.
  const hours = (plan.targetMinutes ?? 0) / 60;
  const kitTargets = carryPlan?.totals ?? {
    carbsG: Math.round((nutrition.carbsTargetNum ?? 0) * hours),
    fluidsMl: Math.round((nutrition.fluidsMlHr ?? 0) * hours),
    sodiumMg: Math.round((nutrition.sodiumMgHr ?? 0) * hours),
  };

  const profileLabel = (course.elevationM || 0) > 800 ? "Mountain" : (course.elevationM || 0) > 300 ? "Hilly" : "Rolling/Flat";

  const summaryCards = [
    { label: "Target Time", value: targetClock, accent: T.brass },
    { label: "Course Profile", value: profileLabel, sub: `+${course.elevationM ?? 0}m gain`, accent: T.paper },
    { label: "Est. Conditions", value: weather?.tempC != null ? `${weather.tempC}°C` : "—", sub: weather?.wind != null ? `${weather.wind} km/h wind` : undefined, accent: T.paper },
    { label: "Based On", value: referenceRace ? referenceRace.name : "Generic pace", sub: referenceRace ? `${referenceRace.finishTime} / ${referenceRace.distanceKm}km` : undefined, accent: T.paper },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 0.7, color: T.inkDim, marginBottom: 8 }}>
          RACE PLAN · {raceDate ?? ""}
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 36, fontWeight: 600, margin: "0 0 4px", color: T.paper }}>
          {course.name}
        </h1>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.inkDim }}>
          {course.distanceKm} km · +{course.elevationM ?? 0}m
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
        {summaryCards.map(({ label, value, sub, accent }) => (
          <div key={label} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "16px 18px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.6, color: T.inkDim, marginBottom: 8 }}>{label.toUpperCase()}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: accent, lineHeight: 1.1 }}>{value}</div>
            {sub && <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 4 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Pacing Plan */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: pacingSections?.length ? 6 : 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
          Pacing Plan
        </div>

        {pacingSections?.length ? (
          <>
            <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 16px", lineHeight: 1.5 }}>
              Target pace for each section between aid stations.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.7fr 0.7fr 1.1fr 0.7fr", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.7, color: T.inkDim }}>
              <div>SECTION</div><div>DIST</div><div>GRADE %</div><div>TARGET PACE</div><div>TIME</div>
            </div>
            {pacingSections.map((sec, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 0.7fr 0.7fr 1.1fr 0.7fr", gap: 8, padding: "11px 0", borderBottom: `1px solid ${T.line}22`, alignItems: "baseline" }}>
                <div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.paper }}>{sec.fromName} → {sec.toName}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: labelColor(sec.label), marginTop: 2 }}>
                    km {sec.fromKm}–{sec.toKm} · {sec.label}{sec.elevGainM > 0 ? ` · +${sec.elevGainM}m` : ""}
                  </div>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{sec.distanceKm} km</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: sec.gradePct > 4 ? T.brass : sec.gradePct < -4 ? T.green : T.ink }}>
                  {sec.gradePct > 0 ? "+" : ""}{sec.gradePct}%
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, color: T.paper }}>
                  {fmtPace(sec.suggestedPace)}<span style={{ fontSize: 10, color: T.inkDim }}> /km</span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{fmtDuration(sec.minutes)}</div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.2fr 0.8fr", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.7, color: T.inkDim }}>
              <div>KM</div><div>ELEV (M)</div><div>GRADE %</div><div>TARGET PACE</div><div>SEGMENT</div>
            </div>
            {pacing.map((split, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.2fr 0.8fr", gap: 8, padding: "10px 0", borderBottom: `1px solid ${T.line}22`, alignItems: "center" }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.paper }}>{split.km}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{split.elevM != null ? split.elevM : "—"}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: split.gradePct > 4 ? T.brass : split.gradePct < -4 ? T.green : T.ink }}>
                  {split.gradePct > 0 ? "+" : ""}{split.gradePct}%
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, color: T.paper }}>
                  {fmtPace(split.suggestedPace)}<span style={{ fontSize: 10, color: T.inkDim }}> /km</span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.5, color: labelColor(split.label) }}>
                  {split.label}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Nutrition Plan */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
          Nutrition Plan
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "18px 20px" }}>
            {[
              { label: "Carbs/hr", value: nutrition.carbsPerHr, source: nutrition.sources?.carbs },
              { label: "Sodium/hr", value: `${nutrition.sodiumMgHr} mg`, source: nutrition.sources?.sodium },
              { label: "Fluids/hr", value: `${nutrition.fluidsMlHr} ml`, source: nutrition.sources?.fluids },
              ...(nutrition.caffeineMg ? [{ label: "Caffeine", value: `${nutrition.caffeineMg} mg`, source: nutrition.sources?.caffeine }] : []),
            ].map(({ label, value, source }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: `1px solid ${T.line}33` }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>{label.toUpperCase()}</span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <SourceTag source={source} />
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper }}>{value}</span>
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.6 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.6, color: T.inkDim, marginBottom: 8 }}>RATIONALE</div>
            {nutrition.rationale}
            {nutrition.basedOnRaces > 0 && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.brass, marginTop: 12 }}>
                Personalised from {nutrition.basedOnRaces} of your race{nutrition.basedOnRaces === 1 ? "" : "s"}.
              </div>
            )}
            {nutrition.notes?.map((note, i) => (
              <div key={i} style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim, marginTop: 8, lineHeight: 1.5 }}>{note}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Fuel & Carry Plan */}
      {carryPlan?.legs?.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: 6, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
            Fuel &amp; Carry Plan
          </div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 16px", lineHeight: 1.5 }}>
            How much to carry out of each refill point across {carryPlan.stationCount} aid
            station{carryPlan.stationCount === 1 ? "" : "s"}
            {carryPlan.carryCapacityMl ? ` · ${carryPlan.carryCapacityMl} ml carry capacity` : ""}.
          </p>

          {/* Pack at the start */}
          {carryPlan.packAtStart && (
            <div style={{ background: T.bg2, border: `1px solid ${T.brassDim}`, borderRadius: 4, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.6, color: T.brass, marginBottom: 8 }}>PACK AT THE START</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.5 }}>
                Leave the start line with{" "}
                <strong style={{ color: T.paper }}>{carryPlan.packAtStart.carbsG} g carbs</strong>
                {carryPlan.packAtStart.gels > 0 ? ` (~${carryPlan.packAtStart.gels} gel${carryPlan.packAtStart.gels === 1 ? "" : "s"})` : ""}
                {" "}and{" "}
                <strong style={{ color: T.paper }}>{carryPlan.packAtStart.fluidsMl} ml fluid</strong>
                {" "}to reach {carryPlan.packAtStart.toName} at km {carryPlan.packAtStart.toKm}.
              </div>
            </div>
          )}

          {/* Per-leg table */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.7fr 1fr 1fr", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.7, color: T.inkDim }}>
            <div>LEG</div><div>DIST</div><div>TIME</div><div>CARRY CARBS</div><div>CARRY FLUID</div>
          </div>
          {carryPlan.legs.map((leg, i) => (
            <div key={i} style={{ padding: "12px 0", borderBottom: `1px solid ${T.line}22` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.7fr 1fr 1fr", gap: 8, alignItems: "baseline" }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.paper }}>
                  {leg.fromName} → {leg.toName}
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.inkDim, display: "block", marginTop: 2 }}>
                    km {leg.fromKm}–{leg.toKm}
                  </span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{leg.legKm} km</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{fmtDuration(leg.minutes)}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.paper }}>
                  {leg.carbsG} g
                  {leg.gels > 0 && <span style={{ fontSize: 10, color: T.inkDim }}> · {leg.gels} gel{leg.gels === 1 ? "" : "s"}</span>}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: leg.overCapacity ? T.ember : T.paper }}>
                  {leg.fluidsMl} ml
                  <span style={{ fontSize: 10, color: T.inkDim }}> · {leg.sodiumMg} mg Na</span>
                </div>
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: leg.overCapacity ? T.ember : T.inkDim, marginTop: 6, lineHeight: 1.45 }}>
                {leg.note}
              </div>
            </div>
          ))}

          {/* Totals */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.7fr 1fr 1fr", gap: 8, padding: "12px 0 0", alignItems: "baseline" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.inkDim }}>RACE TOTAL</div>
            <div />
            <div />
            <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, color: T.brass }}>{carryPlan.totals.carbsG} g</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, color: T.brass }}>
              {carryPlan.totals.fluidsMl} ml
              <span style={{ fontSize: 10, color: T.inkDim }}> · {carryPlan.totals.sodiumMg} mg Na</span>
            </div>
          </div>
        </div>
      )}

      {/* Build Your Kit */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: 6, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
          Build Your Kit
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 16px", lineHeight: 1.5 }}>
          Assemble what you'll actually carry and check it against your targets.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }}>
          {/* Item picker */}
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
            {FUEL_ITEMS.map((item, i) => {
              const qty = kitQty[item.key] || 0;
              const macro = [
                item.carbs ? `${item.carbs}g` : null,
                item.sodiumMg ? `${item.sodiumMg}mg Na` : null,
                item.fluidMl ? `${item.fluidMl}ml` : null,
              ].filter(Boolean).join(" · ");
              return (
                <div key={item.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < FUEL_ITEMS.length - 1 ? `1px solid ${T.line}33` : "none", background: qty > 0 ? "rgba(201,162,75,0.05)" : "transparent" }}>
                  <div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: qty > 0 ? T.paper : T.ink }}>{item.label}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.inkDim, marginTop: 2 }}>{macro || "—"}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => bumpKit(item.key, -1)} aria-label={`Remove one ${item.label}`} style={stepperStyle(qty > 0)}>−</button>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: qty > 0 ? T.brass : T.inkDim, minWidth: 18, textAlign: "center" }}>{qty}</span>
                    <button onClick={() => bumpKit(item.key, 1)} aria-label={`Add one ${item.label}`} style={stepperStyle(true)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tally vs targets */}
          <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "16px 18px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.6, color: T.inkDim, marginBottom: 12 }}>
              KIT VS TARGET{carryPlan ? " (RACE TOTAL)" : ""}
            </div>
            <KitProgress label="Carbs" value={kit.totals.carbsG} target={kitTargets.carbsG} unit="g" />
            <KitProgress label="Fluids" value={kit.totals.fluidsMl} target={kitTargets.fluidsMl} unit="ml" />
            <KitProgress label="Sodium" value={kit.totals.sodiumMg} target={kitTargets.sodiumMg} unit="mg" />
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
              {kit.totals.count > 0 ? `${kit.totals.count} item${kit.totals.count === 1 ? "" : "s"} packed` : "Add items to start building your kit."}
            </div>
          </div>
        </div>
      </div>

      {/* Tactical Recommendations */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: 4, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
          Tactical Recommendations
        </div>
        {recommendations.map((rec, i) => (
          <Recommendation key={i} index={i + 1} action={rec.action} why={rec.why} />
        ))}
      </div>

      {/* Footer CTAs */}
      <div style={{ display: "flex", gap: 12, paddingTop: 24, borderTop: `1px solid ${T.line}`, flexWrap: "wrap" }}>
        <button
          onClick={onLogRace}
          style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, fontWeight: 600, padding: "11px 22px", borderRadius: 3, border: "none", background: T.brass, color: T.bg, cursor: "pointer" }}
        >
          LOG THIS RACE AFTER →
        </button>
        <button
          onClick={() => printPlan(plan, kit)}
          style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "11px 18px", borderRadius: 3, border: `1px solid ${T.brassDim}`, background: "rgba(201,162,75,0.1)", color: T.brass, cursor: "pointer" }}
        >
          ↓ DOWNLOAD PDF
        </button>
        <button
          onClick={onAskCoach}
          style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "11px 18px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.ink, cursor: "pointer" }}
        >
          ASK RACEIQ
        </button>
        <button
          onClick={onBack}
          style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "11px 18px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.inkDim, cursor: "pointer" }}
        >
          ← BACK TO HISTORY
        </button>
      </div>
    </div>
  );
}
