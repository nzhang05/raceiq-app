import { useMemo } from "react";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../constants.js";
import { fmtDate } from "../utils/time.js";
import { parseClockToMinutes } from "../utils/time.js";
import { verdictColor, verdictLabel } from "../utils/ratings.js";
import { fuelingBenchmarks } from "../utils/fueling.js";
import { buildDebrief } from "../utils/analysis.js";
import PaceHeatStrip from "./PaceHeatStrip.jsx";
import { Finding, Recommendation } from "./ui.jsx";

export default function RaceDebrief({ race, onBack, onAskCoach, onEdit }) {
  const { strengths, limiters, recs } = useMemo(() => buildDebrief(race), [race]);
  const allFindings = [
    ...strengths.map((s) => ({ ...s, kind: "strength" })),
    ...limiters.map((s) => ({ ...s, kind: "limiter" })),
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.inkDim, fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
          ← BACK TO RACE RESUME
        </button>
        {onEdit && (
          <button onClick={onEdit} style={{ background: "none", border: `1px solid ${T.line}`, color: T.inkDim, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, cursor: "pointer", padding: "6px 14px", borderRadius: 3 }}>
            EDIT RACE
          </button>
        )}
      </div>

      <div style={{ marginBottom: 8, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass }}>RACE DEBRIEF</div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 600, margin: "0 0 6px", color: T.paper, letterSpacing: 0.1, maxWidth: 760 }}>{race.name}</h1>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: T.inkDim, marginBottom: 28 }}>
        {fmtDate(race.date)} · {race.sport} · {race.distanceKm} km · +{race.elevationM}m
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "FINISH TIME", value: race.finishTime, sub: null, accent: T.paper, bg: T.bg2, border: T.line },
          { label: "PLACEMENT", value: `${race.placement}/${race.field}`, sub: `${race.percentile}th pct`, accent: T.paper, bg: T.bg2, border: T.line },
          { label: "RACEIQ SCORE", value: race.rating, sub: `${race.ratingDelta >= 0 ? "+" : ""}${race.ratingDelta}`, accent: T.brass, bg: "rgba(201,162,75,0.07)", border: T.brassDim },
          { label: "CONDITIONS", value: `${race.tempC}°C`, sub: `${race.humidity}% hum`, accent: T.paper, bg: T.bg2, border: T.line },
        ].map(({ label, value, sub, accent, bg, border }, i) => (
          <div key={label} className="stat-enter" style={{ animationDelay: `${i * 80}ms`, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: "16px 20px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.8, color: T.inkDim, marginBottom: 10 }}>{label}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: accent, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 6 }}>{sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ background: race.verdict === "strength" ? T.greenDim : race.verdict === "limiter" ? T.emberDim : T.brassDim, border: `1px solid ${verdictColor(race.verdict)}60`, borderRadius: 4, padding: "16px 20px", marginBottom: 36 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1, color: verdictColor(race.verdict), marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: verdictColor(race.verdict), display: "inline-block", flexShrink: 0 }} />
          {verdictLabel(race.verdict)}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 20, lineHeight: 1.45, color: T.paper, maxWidth: 640 }}>{race.headline}</div>
      </div>

      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 4 }}>Pace against temperature</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 16, maxWidth: 600 }}>
          Solid line is your pace, dashed is course temp. Shaded area is elevation.
        </div>
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "16px 12px 8px" }}>
          <PaceHeatStrip race={race} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 6 }}>Findings</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 10 }}>What the data shows, in order of impact on the result.</div>
          <div>
            {allFindings.map((f, i) => <Finding key={i} kind={f.kind} title={f.title} body={f.body} />)}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 6 }}>Fueling log</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 16 }}>
            {race.fueling.inputMode === "sections" && race.fueling.sections?.length
              ? "What you took in, by section of the race."
              : "What you took in during the race."}
          </div>
          {race.fueling.inputMode === "sections" && race.fueling.sections?.length ? (
            <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "14px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 0.8fr 0.8fr", gap: 8, paddingBottom: 8, borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 0.5, color: T.inkDim }}>
                <div>SECTION</div><div>CARBS</div><div>NA</div><div>FLUID</div>
              </div>
              {(() => {
                const bench = fuelingBenchmarks(race.finishTime);
                return race.fueling.sections.map((s, i) => {
                  const low = bench.needsCarbs && s.carbsPerHr < bench.carbsLow;
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 0.8fr 0.8fr", gap: 8, padding: "9px 0", borderBottom: i < race.fueling.sections.length - 1 ? `1px solid ${T.line}33` : "none", alignItems: "baseline", fontFamily: FONT_MONO, fontSize: 12.5 }}>
                      <span style={{ color: T.ink }}>km {s.fromKm}–{s.toKm}</span>
                      <span style={{ color: low ? T.ember : T.paper }}>{s.carbsPerHr} g/hr</span>
                      <span style={{ color: T.ink }}>{s.sodiumPerHr}</span>
                      <span style={{ color: T.ink }}>{s.fluidsPerHr}</span>
                    </div>
                  );
                });
              })()}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim }}>
                RACE AVG · {race.fueling.carbsPerHr} g/hr carbs · {race.fueling.caffeine} mg caffeine
              </div>
            </div>
          ) : (
            <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: 20 }}>
              {[
                ["Carbohydrate", `${race.fueling.carbsPerHr} g/hr`],
                ["Sodium", `${race.fueling.sodiumPerHr} mg/hr`],
                ["Fluids", `${race.fueling.fluidsPerHr} ml/hr`],
                ["Caffeine", `${race.fueling.caffeine} mg total`],
              ].map(([k, v], i) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 3 ? `1px solid ${T.line}` : "none", fontFamily: FONT_MONO, fontSize: 13 }}>
                  <span style={{ color: T.inkDim }}>{k.toUpperCase()}</span>
                  <span style={{ color: T.paper }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, color: T.paper, marginBottom: 10 }}>Fueling context</div>
            {(() => {
              const bench = fuelingBenchmarks(race.finishTime);
              if (!bench.needsCarbs) {
                return (
                  <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.55 }}>
                    At this duration ({Math.round(parseClockToMinutes(race.finishTime))} min), exogenous carbohydrate is{" "}
                    <span style={{ color: T.brass }}>not required</span> — glycogen stores are sufficient. Water is the main priority.
                  </div>
                );
              }
              return (
                <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.55 }}>
                  For {Math.round(parseClockToMinutes(race.finishTime))}-minute efforts, the evidence-backed carbohydrate target is{" "}
                  <span style={{ color: T.brass }}>{bench.carbsLabel}</span>
                  {bench.peerAvg != null && (
                    <> (athletes at your level in {race.sport.toLowerCase()} average <span style={{ color: T.brass }}>{bench.peerAvg}g/hr</span>)</>
                  )}
                  . {bench.rationale}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 44, paddingTop: 8 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 6 }}>Recommendations for next time</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 4 }}>Specific, evidence-backed changes — not general advice.</div>
        <div>
          {recs.map((r, i) => <Recommendation key={i} index={i + 1} action={r.action} why={r.why} />)}
        </div>
      </div>

      <div style={{ marginTop: 40, padding: "22px 24px", background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 15, color: T.ink }}>
          Have a follow-up question about this race? Ask the AI Coach — <span style={{ color: T.paper }}>"Why did I bonk?"</span> or{" "}
          <span style={{ color: T.paper }}>"Am I improving?"</span>
        </div>
        <button onClick={onAskCoach} style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, color: T.bg, background: T.brass, border: "none", borderRadius: 3, padding: "10px 18px", cursor: "pointer", flexShrink: 0 }}>
          ASK THE COACH
        </button>
      </div>
    </div>
  );
}
