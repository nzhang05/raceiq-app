import { useMemo } from "react";
import { T, R, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../constants.js";
import { fmtDate } from "../utils/time.js";
import { parseClockToMinutes } from "../utils/time.js";
import { verdictColor, verdictLabel } from "../utils/ratings.js";
import { fuelingBenchmarks } from "../utils/fueling.js";
import { buildDebrief } from "../utils/analysis.js";
import { useNarrative } from "../hooks/useNarrative.js";
import PaceHeatStrip from "./PaceHeatStrip.jsx";
import { Finding, Recommendation, Card, Button, Pill } from "./ui.jsx";

function SectionHeader({ title, sub, note }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, letterSpacing: -0.3, color: T.paper }}>{title}</div>
        {note && <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 0.5, color: T.inkDim }}>{note}</span>}
      </div>
      {sub && <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginTop: 4, maxWidth: 620 }}>{sub}</div>}
    </div>
  );
}

export default function RaceDebrief({ race, allRaces, plan, onBack, onAskCoach, onEdit }) {
  const { strengths, limiters, recs } = useMemo(() => buildDebrief(race), [race]);

  // Memoised because the hook re-requests whenever this identity changes.
  const args = useMemo(
    () => ({ race, races: allRaces ?? [], plan: plan ?? null }),
    [race, allRaces, plan],
  );
  const { narrative, status } = useNarrative("debrief", args);

  // The rule-engine findings render immediately and stand on their own. The
  // full analysis — which also sees the raw splits, this athlete's other races,
  // and the pre-race plan — replaces them when it arrives.
  const allFindings = narrative?.findings?.length
    ? narrative.findings
    : [
        ...strengths.map((s) => ({ ...s, kind: "strength" })),
        ...limiters.map((s) => ({ ...s, kind: "limiter" })),
      ];
  const shownRecs = narrative?.recommendations?.length ? narrative.recommendations : recs;
  const headline = narrative?.headline || race.headline;
  const analysisNote = status === "loading" ? "ANALYSING…" : status === "ready" ? "AI ANALYSIS" : null;
  const vColor = verdictColor(race.verdict);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.inkDim, fontFamily: FONT_BODY, fontSize: 13.5, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
          ← Back to races
        </button>
        {onEdit && (
          <Button variant="secondary" onClick={onEdit} style={{ padding: "8px 16px", fontSize: 13 }}>Edit race</Button>
        )}
      </div>

      {/* Narrative lead — the "why" comes first */}
      <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: T.brass, marginBottom: 10 }}>Race debrief</div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 700, margin: "0 0 8px", color: T.paper, letterSpacing: -0.7, maxWidth: 760 }}>{race.name}</h1>
      <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 22 }}>
        {fmtDate(race.date)} · {race.sport} · {race.distanceKm} km · +{race.elevationM} m
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 32 }}>
        <div style={{ width: 3, alignSelf: "stretch", background: vColor, borderRadius: 2, flexShrink: 0 }} />
        <div>
          <div style={{ marginBottom: 12 }}><Pill color={vColor}>{verdictLabel(race.verdict)}</Pill></div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 25, fontWeight: 500, lineHeight: 1.32, color: T.paper, maxWidth: 680, letterSpacing: -0.3 }}>{headline}</div>
        </div>
      </div>

      {/* Key figures */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 44 }}>
        {[
          { label: "Finish time", value: race.finishTime, sub: null, accent: T.paper, hero: false },
          { label: "Placement", value: `${race.placement}/${race.field}`, sub: `${race.percentile}th percentile`, accent: T.paper, hero: false },
          { label: "RaceIQ score", value: race.rating, sub: `${race.ratingDelta >= 0 ? "+" : ""}${race.ratingDelta}`, accent: T.brass, hero: true },
          { label: "Conditions", value: `${race.tempC}°C`, sub: `${race.humidity}% humidity`, accent: T.paper, hero: false },
        ].map(({ label, value, sub, accent, hero }, i) => (
          <div key={label} className="stat-enter" style={{ animationDelay: `${i * 70}ms`, background: hero ? `${T.brass}12` : T.surface, border: `1px solid ${hero ? `${T.brass}33` : T.line}`, borderRadius: R.lg, padding: "18px 20px" }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500, color: T.inkDim, marginBottom: 12 }}>{label}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1, letterSpacing: -0.5 }}>{value}</div>
            {sub && <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: T.inkDim, marginTop: 8 }}>{sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 48 }}>
        <SectionHeader title="Pace against temperature" sub="Solid line is your pace, dashed is course temperature, shaded area is elevation." />
        <Card style={{ padding: "18px 14px 10px" }}>
          <PaceHeatStrip race={race} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 44, marginBottom: 8 }}>
        <div>
          <SectionHeader title="Findings" sub="What the data shows, in order of impact on the result." note={analysisNote} />
          <div>
            {allFindings.map((f, i) => (
              <Finding key={i} kind={f.kind} title={f.title} body={f.body} evidence={f.evidence} />
            ))}
          </div>
        </div>

        <div>
          <SectionHeader
            title="Fueling log"
            sub={race.fueling.inputMode === "sections" && race.fueling.sections?.length
              ? "What you took in, by section of the race."
              : "What you took in during the race."}
          />
          {race.fueling.inputMode === "sections" && race.fueling.sections?.length ? (
            <Card style={{ padding: "16px 18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 0.8fr 0.8fr", gap: 8, paddingBottom: 10, borderBottom: `1px solid ${T.line}`, fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 500, color: T.inkDim }}>
                <div>Section</div><div>Carbs</div><div>Na</div><div>Fluid</div>
              </div>
              {(() => {
                const bench = fuelingBenchmarks(race.finishTime);
                return race.fueling.sections.map((s, i) => {
                  const low = bench.needsCarbs && s.carbsPerHr < bench.carbsLow;
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 0.8fr 0.8fr", gap: 8, padding: "10px 0", borderBottom: i < race.fueling.sections.length - 1 ? `1px solid ${T.line}88` : "none", alignItems: "baseline", fontFamily: FONT_MONO, fontSize: 12.5 }}>
                      <span style={{ color: T.ink }}>km {s.fromKm}–{s.toKm}</span>
                      <span style={{ color: low ? T.ember : T.paper }}>{s.carbsPerHr} g/hr</span>
                      <span style={{ color: T.ink }}>{s.sodiumPerHr}</span>
                      <span style={{ color: T.ink }}>{s.fluidsPerHr}</span>
                    </div>
                  );
                });
              })()}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 11.5, color: T.inkDim }}>
                Race avg · {race.fueling.carbsPerHr} g/hr carbs · {race.fueling.caffeine} mg caffeine
              </div>
            </Card>
          ) : (
            <Card>
              {[
                ["Carbohydrate", `${race.fueling.carbsPerHr} g/hr`],
                ["Sodium", `${race.fueling.sodiumPerHr} mg/hr`],
                ["Fluids", `${race.fueling.fluidsPerHr} ml/hr`],
                ["Caffeine", `${race.fueling.caffeine} mg total`],
              ].map(([k, v], i) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "11px 0", borderBottom: i < 3 ? `1px solid ${T.line}` : "none" }}>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim }}>{k}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13.5, color: T.paper }}>{v}</span>
                </div>
              ))}
            </Card>
          )}

          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, letterSpacing: -0.2, color: T.paper, marginBottom: 10 }}>Fueling context</div>
            {(() => {
              const bench = fuelingBenchmarks(race.finishTime);
              if (!bench.needsCarbs) {
                return (
                  <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.6 }}>
                    At this duration ({Math.round(parseClockToMinutes(race.finishTime))} min), exogenous carbohydrate is{" "}
                    <span style={{ color: T.brass, fontWeight: 600 }}>not required</span> — glycogen stores are sufficient. Water is the main priority.
                  </div>
                );
              }
              return (
                <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.6 }}>
                  For {Math.round(parseClockToMinutes(race.finishTime))}-minute efforts, the evidence-backed carbohydrate target is{" "}
                  <span style={{ color: T.brass, fontWeight: 600 }}>{bench.carbsLabel}</span>
                  {bench.peerAvg != null && (
                    <> (athletes at your level in {race.sport.toLowerCase()} average <span style={{ color: T.brass, fontWeight: 600 }}>{bench.peerAvg}g/hr</span>)</>
                  )}
                  . {bench.rationale}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 48 }}>
        <SectionHeader title="Recommendations for next time" sub="Specific, evidence-backed changes — not general advice." note={analysisNote} />
        <div>
          {shownRecs.map((r, i) => (
            <Recommendation key={i} index={i + 1} action={r.action} why={r.why} evidence={r.evidence} />
          ))}
        </div>
      </div>

      <Card style={{ marginTop: 40, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: T.surfaceHi }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink }}>
          Have a follow-up about this race? Ask the AI coach — <span style={{ color: T.paper, fontWeight: 500 }}>"Why did I bonk?"</span> or{" "}
          <span style={{ color: T.paper, fontWeight: 500 }}>"Am I improving?"</span>
        </div>
        <Button onClick={onAskCoach} style={{ flexShrink: 0 }}>Ask the coach</Button>
      </Card>
    </div>
  );
}
