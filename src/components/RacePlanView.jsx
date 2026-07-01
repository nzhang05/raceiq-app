import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../constants.js";
import { Recommendation } from "./ui.jsx";

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

export default function RacePlanView({ plan, onBack, onLogRace, onAskCoach }) {
  const { course, targetClock, pacing, nutrition, recommendations, referenceRace, weather, raceDate } = plan;

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
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
          Pacing Plan
        </div>
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
      </div>

      {/* Nutrition Plan */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
          Nutrition Plan
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "18px 20px" }}>
            {[
              { label: "Carbs/hr", value: nutrition.carbsPerHr },
              { label: "Sodium/hr", value: `${nutrition.sodiumMgHr} mg` },
              { label: "Fluids/hr", value: `${nutrition.fluidsMlHr} ml` },
              ...(nutrition.caffeineMg ? [{ label: "Caffeine", value: `${nutrition.caffeineMg} mg` }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: `1px solid ${T.line}33` }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>{label.toUpperCase()}</span>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.6 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.6, color: T.inkDim, marginBottom: 8 }}>RATIONALE</div>
            {nutrition.rationale}
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
