import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { T, R, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../constants.js";
import { fmtDate } from "../utils/time.js";
import { fmtSigned } from "../i18n/format.js";
import { parseClockToMinutes } from "../utils/time.js";
import { verdictColor, verdictKey } from "../utils/ratings.js";
import { fuelingBenchmarks } from "../utils/fueling.js";
import { buildDebrief, toThreeFindings } from "../utils/analysis.js";
import { findingText, recText, headlineText } from "../i18n/render.js";
import { useNarrative } from "../hooks/useNarrative.js";
import PaceHeatStrip from "./PaceHeatStrip.jsx";
import { FindingCard, Recommendation, Card, Button, Pill } from "./ui.jsx";
import RowSparkline from "./RowSparkline.jsx";

function SectionHeader({ title, sub, note }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, letterSpacing: -0.3, color: T.paper }}>{title}</div>
        {note && <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>{note}</span>}
      </div>
      {sub && <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginTop: 4, maxWidth: 620 }}>{sub}</div>}
    </div>
  );
}

export default function RaceDebrief({ race, allRaces, plan, onBack, onAskCoach, onEdit }) {
  const { t } = useTranslation();
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
  //
  // Exactly three, always: they lay out as a fixed row of three cards. The
  // schema pins Claude's side to three; toThreeFindings() pins the engine's.
  // The slice is a net against a malformed response, which would otherwise
  // silently break the grid rather than fail loudly.
  const allFindings = narrative?.findings?.length
    ? narrative.findings.slice(0, 3)
    : toThreeFindings(strengths, limiters, race);
  const shownRecs = narrative?.recommendations?.length ? narrative.recommendations : recs;
  // Claude's headline arrives already written in the athlete's language; the
  // engine's is a catalog key. headlineText() handles both, plus the literal
  // stored on races saved before this change.
  const headline = narrative?.headline || headlineText(t, race);
  const analysisNote = status === "loading" ? t("debrief.analysing") : status === "ready" ? t("debrief.aiAnalysis") : null;
  const vColor = verdictColor(race.verdict);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.inkDim, fontFamily: FONT_BODY, fontSize: 13.5, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {t("actions.backToRaces")}
        </button>
        {onEdit && (
          <Button variant="secondary" onClick={onEdit} style={{ padding: "8px 16px", fontSize: 13 }}>{t("debrief.editRace")}</Button>
        )}
      </div>

      {/* Narrative lead — the "why" comes first */}
      <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: T.brass, marginBottom: 10 }}>{t("debrief.eyebrow")}</div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 700, margin: "0 0 8px", color: T.paper, letterSpacing: -0.7, maxWidth: 760 }}>{race.name}</h1>
      <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 22 }}>
        {fmtDate(race.date)} · {t(`sport.${race.sport}`)} · {race.distanceKm} km · +{race.elevationM} m
      </div>

      {/* The headline is the page's thesis, so it outranks the race name above
          it. The course silhouette sits behind it as a watermark — the shape of
          the day, at a weight low enough not to compete with the text. */}
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 40 }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none", overflow: "hidden" }} aria-hidden="true">
          <RowSparkline race={race} width={760} height={110} variant="watermark" />
        </div>
        <div style={{ width: 3, alignSelf: "stretch", background: vColor, borderRadius: 2, flexShrink: 0 }} />
        <div style={{ position: "relative" }}>
          <div style={{ marginBottom: 12 }}><Pill color={vColor}>{t(`verdict.${verdictKey(race.verdict)}`)}</Pill></div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500, lineHeight: 1.3, color: T.paper, maxWidth: 700, letterSpacing: -0.4 }}>{headline}</div>
        </div>
      </div>

      {/* The three takeaways lead the page — they are what the athlete came for. */}
      <div style={{ marginBottom: 56 }}>
        <SectionHeader title={t("debrief.findings.title")} sub={t("debrief.findings.sub")} note={analysisNote} />
        <div className="takeaway-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {allFindings.map((f, i) => {
            const { title, body, evidence } = findingText(t, f);
            return (
              <FindingCard
                key={i}
                className="stat-enter"
                style={{ animationDelay: `${i * 70}ms` }}
                kind={f.kind}
                kindLabel={t(`debrief.kind.${f.kind ?? "context"}`)}
                title={title}
                body={body}
                evidence={evidence}
              />
            );
          })}
        </div>
      </div>

      {/* Key figures. One strip with dividers rather than four bordered boxes:
          with the takeaway cards above, a second row of cards read as noise and
          left the RaceIQ score with nothing to stand out against. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: `1px solid ${T.line}`, background: T.surface, borderRadius: R.lg, overflow: "hidden", marginBottom: 56 }}>
        {[
          { label: t("debrief.stat.finishTime"), value: race.finishTime, sub: null, accent: T.paper, hero: false },
          { label: t("debrief.stat.placement"), value: `${race.placement}/${race.field}`, sub: t("debrief.percentile", { pct: race.percentile }), accent: T.paper, hero: false },
          { label: t("debrief.stat.score"), value: race.rating, sub: fmtSigned(race.ratingDelta), accent: T.brass, hero: true },
          { label: t("debrief.stat.conditions"), value: `${race.tempC}°C`, sub: t("debrief.humidity", { pct: race.humidity }), accent: T.paper, hero: false },
        ].map(({ label, value, sub, accent, hero }, i) => (
          <div key={label} className="stat-enter" style={{ animationDelay: `${i * 70}ms`, background: hero ? `${T.brass}12` : "transparent", borderLeft: i ? `1px solid ${T.line}` : "none", padding: "18px 20px" }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500, color: T.inkDim, marginBottom: 12 }}>{label}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1, letterSpacing: -0.5 }}>{value}</div>
            {sub && <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: T.inkDim, marginTop: 8 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* No splits, no chart — and no orphan section header above an empty card.
          The takeaways say what is missing (context.noSplits) instead. */}
      {(race.splits?.length ?? 0) >= 2 && (
        <div style={{ marginBottom: 56 }}>
          <SectionHeader title={t("debrief.chart.title")} sub={t("debrief.chart.sub")} />
          <Card style={{ padding: "18px 14px 10px" }}>
            <PaceHeatStrip race={race} />
          </Card>
        </div>
      )}

      <div style={{ marginBottom: 56 }}>
        <SectionHeader
          title={t("debrief.fuelingLog.title")}
          sub={t(race.fueling.inputMode === "sections" && race.fueling.sections?.length
            ? "debrief.fuelingLog.subSections"
            : "debrief.fuelingLog.subTotals")}
        />
        <div className="fueling-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "start" }}>
          <div>
            {race.fueling.inputMode === "sections" && race.fueling.sections?.length ? (
              <Card style={{ padding: "16px 18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 0.8fr 0.8fr", gap: 8, paddingBottom: 10, borderBottom: `1px solid ${T.line}`, fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 500, color: T.inkDim }}>
                  <div>{t("debrief.fuelingLog.colSection")}</div><div>{t("debrief.fuelingLog.colCarbs")}</div><div>{t("debrief.fuelingLog.colSodium")}</div><div>{t("debrief.fuelingLog.colFluid")}</div>
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
                  {t("debrief.fuelingLog.raceAvg", { carbs: race.fueling.carbsPerHr, caffeine: race.fueling.caffeine })}
                </div>
              </Card>
            ) : (
              <Card>
                {[
                  // An unlogged value renders "—", not zero. i18next leaves the
                  // raw "{{value, number}}" in place when the value is
                  // undefined, and "0 g/hr" would assert something the athlete
                  // never told us.
                  ["debrief.fuelingLog.carbohydrate", "debrief.fuelingLog.carbsValue", race.fueling.carbsPerHr],
                  ["debrief.fuelingLog.sodium", "debrief.fuelingLog.sodiumValue", race.fueling.sodiumPerHr],
                  ["debrief.fuelingLog.fluids", "debrief.fuelingLog.fluidsValue", race.fueling.fluidsPerHr],
                  ["debrief.fuelingLog.caffeine", "debrief.fuelingLog.caffeineValue", race.fueling.caffeine],
                ].map(([labelKey, valueKey, value]) => [
                  t(labelKey),
                  value == null ? "—" : t(valueKey, { value }),
                ]).map(([k, v], i) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "11px 0", borderBottom: i < 3 ? `1px solid ${T.line}` : "none" }}>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim }}>{k}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 13.5, color: T.paper }}>{v}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, letterSpacing: -0.2, color: T.paper, marginBottom: 10 }}>{t("debrief.fuelingContext.title")}</div>
            {(() => {
              const bench = fuelingBenchmarks(race.finishTime);
              const durationMin = Math.round(parseClockToMinutes(race.finishTime));
              // <1> is the emphasised phrase; the sentence is one catalog entry
              // so French can place the emphasis where the grammar wants it.
              const em = <span style={{ color: T.brass, fontWeight: 600 }} />;
              if (!bench.needsCarbs) {
                return (
                  <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.6 }}>
                    <Trans i18nKey="debrief.fuelingContext.notRequired" values={{ durationMin }} components={[em, em]} />
                  </div>
                );
              }
              return (
                <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.6 }}>
                  <Trans
                    i18nKey="debrief.fuelingContext.target"
                    values={{ durationMin, carbsLabel: bench.carbsLabel }}
                    components={[em, em]}
                  />
                  {bench.peerAvg != null && (
                    <Trans
                      i18nKey="debrief.fuelingContext.peerAvg"
                      values={{ sport: t(`sport.${race.sport}`).toLowerCase(), peerAvg: bench.peerAvg }}
                      components={[em, em]}
                    />
                  )}
                  . {t(bench.rationaleKey, { ns: "plan" })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* A race the engine has no recommendation for should not leave a heading
          and a subtitle sitting over nothing. */}
      {shownRecs.length > 0 && (
        <div style={{ marginBottom: 56 }}>
          <SectionHeader title={t("debrief.recommendations.title")} sub={t("debrief.recommendations.sub")} note={analysisNote} />
          <div>
            {shownRecs.map((r, i) => {
              const { action, why, evidence } = recText(t, r);
              return <Recommendation key={i} index={i + 1} action={action} why={why} evidence={evidence} />;
            })}
          </div>
        </div>
      )}

      <Card style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: T.surfaceHi }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink }}>
          <Trans
            i18nKey="debrief.askCoach.prompt"
            components={[<span style={{ color: T.paper, fontWeight: 500 }} />, <span style={{ color: T.paper, fontWeight: 500 }} />]}
          />
        </div>
        <Button onClick={onAskCoach} style={{ flexShrink: 0 }}>{t("debrief.askCoach.cta")}</Button>
      </Card>
    </div>
  );
}
