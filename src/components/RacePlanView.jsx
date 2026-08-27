import { useState, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../constants.js";
import { Recommendation } from "./ui.jsx";
import { recText, legNoteText, fuelNoteText } from "../i18n/render.js";
import CourseMap from "./CourseMap.jsx";
import ElevationProfile from "./ElevationProfile.jsx";
import { buildSegments } from "../utils/courseColors.js";
import { FUEL_ITEMS, tallyKit } from "../utils/fuelKit.js";
import { printPlan } from "../utils/planPdf.js";
import { useNarrative } from "../hooks/useNarrative.js";

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
  const { t } = useTranslation();
  const colors = { manual: T.green, history: T.brass, generic: T.inkDim };
  const color = colors[source];
  if (!color) return null;
  const s = { text: t(`source.${source}`, { ns: "plan" }), color };
  return (
    <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: s.color, border: `1px solid ${s.color}`, borderRadius: 2, padding: "1px 4px", opacity: 0.85 }}>
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

export default function RacePlanView({ plan, allRaces, onBack, onLogRace, onAskCoach }) {
  const { t } = useTranslation();
  const { course, targetClock, pacing, pacingSections, nutrition, carryPlan, recommendations, referenceRace, weather, raceDate } = plan;

  // Rule-engine recommendations render immediately; the analysis — which reads
  // this athlete's full race history against this course and forecast —
  // replaces them once it arrives, and is skipped entirely when the athlete is
  // signed out or the service is unavailable.
  const args = useMemo(() => ({ plan, races: allRaces ?? [] }), [plan, allRaces]);
  const { narrative, status } = useNarrative("plan", args);
  const shownRecs = narrative?.recommendations?.length ? narrative.recommendations : recommendations;
  const narrativeNote = status === "loading" ? t("debrief.analysing") : status === "ready" ? t("debrief.aiAnalysis") : null;

  // Segment colours are shared with the map, so a row in the pacing table and a
  // line on the course are recognisably the same segment.
  const segments = useMemo(
    () => buildSegments(course.distanceKm, course.stations ?? []),
    [course.distanceKm, course.stations]
  );
  const [showProfile, setShowProfile] = useState(true);
  const [activeSegment, setActiveSegment] = useState(null);

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

  const elev = course.elevationM || 0;
  const profileLabel = t(`view.profile.${elev > 800 ? "mountain" : elev > 300 ? "hilly" : "rolling"}`, { ns: "plan" });

  const summaryCards = [
    { label: t("view.summary.targetTime", { ns: "plan" }), value: targetClock, accent: T.brass },
    { label: t("view.summary.courseProfile", { ns: "plan" }), value: profileLabel, sub: t("view.elevGain", { ns: "plan", elevationM: course.elevationM ?? 0 }), accent: T.paper },
    { label: t("view.summary.conditions", { ns: "plan" }), value: weather?.tempC != null ? `${weather.tempC}°C` : "—", sub: weather?.wind != null ? t("view.windSub", { ns: "plan", wind: weather.wind }) : undefined, accent: T.paper },
    { label: t("view.summary.basedOn", { ns: "plan" }), value: referenceRace ? referenceRace.name : t("view.genericPace", { ns: "plan" }), sub: referenceRace ? t("view.referenceSub", { ns: "plan", finishTime: referenceRace.finishTime, distanceKm: referenceRace.distanceKm }) : undefined, accent: T.paper },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.7, color: T.inkDim, marginBottom: 8 }}>
          {t("view.eyebrow", { ns: "plan" })} · {raceDate ?? ""}
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
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.inkDim, marginBottom: 8 }}>{label.toUpperCase()}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: accent, lineHeight: 1.1 }}>{value}</div>
            {sub && <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 4 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Course */}
      {course.path?.length > 1 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper }}>{t("view.course.title", { ns: "plan" })}</div>
            <button
              onClick={() => setShowProfile((v) => !v)}
              style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, padding: "6px 11px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.inkDim, cursor: "pointer" }}
            >
              {t(showProfile ? "view.course.hideElevation" : "view.course.showElevation", { ns: "plan" })}
            </button>
          </div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 16px", lineHeight: 1.5 }}>
            {t("view.course.sub", { ns: "plan", count: segments.length })}
            {showProfile ? t("view.course.gradientNote", { ns: "plan" }) : ""}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <CourseMap
              path={course.path}
              distanceKm={course.distanceKm}
              stations={course.stations ?? []}
              height={340}
              activeSegment={activeSegment}
            />
            {showProfile && (
              <ElevationProfile
                splits={course.splits ?? []}
                distanceKm={course.distanceKm}
                elevationM={course.elevationM}
                stations={course.stations ?? []}
                colorByGradient
                readOnly
              />
            )}
          </div>
        </div>
      )}

      {/* Pacing Plan */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: pacingSections?.length ? 6 : 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
          {t("view.pacing.title", { ns: "plan" })}
        </div>

        {pacingSections?.length ? (
          <>
            <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 16px", lineHeight: 1.5 }}>
              {t("view.pacing.sub", { ns: "plan" })}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.7fr 0.7fr 1.1fr 0.7fr", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.7, color: T.inkDim }}>
              <div>{t("view.pacing.colSection", { ns: "plan" })}</div><div>{t("view.pacing.colDist", { ns: "plan" })}</div><div>{t("view.pacing.colGrade", { ns: "plan" })}</div><div>{t("view.pacing.colTargetPace", { ns: "plan" })}</div><div>{t("view.pacing.colTime", { ns: "plan" })}</div>
            </div>
            {pacingSections.map((sec, i) => (
              <div
                key={i}
                onMouseEnter={() => setActiveSegment(i)}
                onMouseLeave={() => setActiveSegment(null)}
                style={{ display: "grid", gridTemplateColumns: "1.5fr 0.7fr 0.7fr 1.1fr 0.7fr", gap: 8, padding: "11px 0", borderBottom: `1px solid ${T.line}22`, alignItems: "baseline", background: activeSegment === i ? T.surfaceHi : "transparent" }}
              >
                <div style={{ display: "flex", gap: 9 }}>
                  {/* Same colour this segment wears on the map above. */}
                  <span style={{ width: 3, borderRadius: 2, background: segments[i]?.color ?? T.line, alignSelf: "stretch", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.paper }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginRight: 6 }}>{segments[i]?.label}</span>
                      {sec.fromName} → {sec.toName}
                    </div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: labelColor(sec.label), marginTop: 2 }}>
                      km {sec.fromKm}–{sec.toKm} · {t(`segment.${sec.label}`, { ns: "plan" })}{sec.elevGainM > 0 ? ` · +${sec.elevGainM}m` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{sec.distanceKm} km</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: sec.gradePct > 4 ? T.brass : sec.gradePct < -4 ? T.green : T.ink }}>
                  {sec.gradePct > 0 ? "+" : ""}{sec.gradePct}%
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, color: T.paper }}>
                  {fmtPace(sec.suggestedPace)}<span style={{ fontSize: 11, color: T.inkDim }}> /km</span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{fmtDuration(sec.minutes)}</div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.2fr 0.8fr", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.7, color: T.inkDim }}>
              <div>{t("view.pacing.colKm", { ns: "plan" })}</div><div>{t("view.pacing.colElev", { ns: "plan" })}</div><div>{t("view.pacing.colGrade", { ns: "plan" })}</div><div>{t("view.pacing.colTargetPace", { ns: "plan" })}</div><div>{t("view.pacing.colSegment", { ns: "plan" })}</div>
            </div>
            {pacing.map((split, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.2fr 0.8fr", gap: 8, padding: "10px 0", borderBottom: `1px solid ${T.line}22`, alignItems: "center" }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.paper }}>{split.km}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{split.elevM != null ? split.elevM : "—"}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: split.gradePct > 4 ? T.brass : split.gradePct < -4 ? T.green : T.ink }}>
                  {split.gradePct > 0 ? "+" : ""}{split.gradePct}%
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, color: T.paper }}>
                  {fmtPace(split.suggestedPace)}<span style={{ fontSize: 11, color: T.inkDim }}> /km</span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: labelColor(split.label) }}>
                  {t(`segment.${split.label}`, { ns: "plan" })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Nutrition Plan */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
          {t("view.nutrition.title", { ns: "plan" })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "18px 20px" }}>
            {[
              { label: t("view.nutrition.carbsPerHr", { ns: "plan" }), value: nutrition.carbsPerHr, source: nutrition.sources?.carbs },
              { label: t("view.nutrition.sodiumPerHr", { ns: "plan" }), value: `${nutrition.sodiumMgHr} mg`, source: nutrition.sources?.sodium },
              { label: t("view.nutrition.fluidsPerHr", { ns: "plan" }), value: `${nutrition.fluidsMlHr} ml`, source: nutrition.sources?.fluids },
              ...(nutrition.caffeineMg ? [{ label: t("view.nutrition.caffeine", { ns: "plan" }), value: `${nutrition.caffeineMg} mg`, source: nutrition.sources?.caffeine }] : []),
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
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.inkDim, marginBottom: 8 }}>{t("view.nutrition.rationale", { ns: "plan" })}</div>
            {t(nutrition.rationaleKey, { ns: "plan" })}
            {nutrition.basedOnRaces > 0 && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.brass, marginTop: 12 }}>
                {t("view.nutrition.personalised", { ns: "plan", count: nutrition.basedOnRaces })}
              </div>
            )}
            {nutrition.notes?.map((note, i) => (
              <div key={i} style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.inkDim, marginTop: 8, lineHeight: 1.5 }}>{fuelNoteText(t, note)}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Fuel & Carry Plan */}
      {carryPlan?.legs?.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: 6, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
            {t("view.carry.title", { ns: "plan" })}
          </div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 16px", lineHeight: 1.5 }}>
            {t("view.carry.sub", {
              ns: "plan",
              count: carryPlan.stationCount,
              capacityPart: carryPlan.carryCapacityMl
                ? t("view.carry.capacityPart", { ns: "plan", capacity: carryPlan.carryCapacityMl })
                : "",
            })}
          </p>

          {/* Pack at the start */}
          {carryPlan.packAtStart && (
            <div style={{ background: T.bg2, border: `1px solid ${T.brassDim}`, borderRadius: 4, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.brass, marginBottom: 8 }}>{t("view.carry.packAtStart", { ns: "plan" })}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, color: T.ink, lineHeight: 1.5 }}>
                <Trans
                  i18nKey={carryPlan.packAtStart.gels > 0 ? "plan:view.carry.packLine" : "plan:view.carry.packLine_none"}
                  count={carryPlan.packAtStart.gels}
                  values={{
                    carbsG: carryPlan.packAtStart.carbsG,
                    gels: carryPlan.packAtStart.gels,
                    fluidsMl: carryPlan.packAtStart.fluidsMl,
                    toName: carryPlan.packAtStart.toName,
                    toKm: carryPlan.packAtStart.toKm,
                  }}
                  components={[<strong style={{ color: T.paper }} />, <strong style={{ color: T.paper }} />]}
                />
              </div>
            </div>
          )}

          {/* Per-leg table */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.7fr 1fr 1fr", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${T.line}`, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.7, color: T.inkDim }}>
            <div>{t("view.carry.colLeg", { ns: "plan" })}</div><div>{t("view.carry.colDist", { ns: "plan" })}</div><div>{t("view.carry.colTime", { ns: "plan" })}</div><div>{t("view.carry.colCarbs", { ns: "plan" })}</div><div>{t("view.carry.colFluid", { ns: "plan" })}</div>
          </div>
          {carryPlan.legs.map((leg, i) => (
            <div key={i} style={{ padding: "12px 0", borderBottom: `1px solid ${T.line}22` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.7fr 1fr 1fr", gap: 8, alignItems: "baseline" }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.paper }}>
                  {leg.fromName} → {leg.toName}
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, display: "block", marginTop: 2 }}>
                    km {leg.fromKm}–{leg.toKm}
                  </span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{leg.legKm} km</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.ink }}>{fmtDuration(leg.minutes)}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.paper }}>
                  {leg.carbsG} g
                  {leg.gels > 0 && <span style={{ fontSize: 11, color: T.inkDim }}> · {t("view.carry.gels", { ns: "plan", count: leg.gels })}</span>}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: leg.overCapacity ? T.ember : T.paper }}>
                  {leg.fluidsMl} ml
                  <span style={{ fontSize: 11, color: T.inkDim }}> · {leg.sodiumMg} mg Na</span>
                </div>
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: leg.overCapacity ? T.ember : T.inkDim, marginTop: 6, lineHeight: 1.45 }}>
                {legNoteText(t, leg)}
              </div>
            </div>
          ))}

          {/* Totals */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.7fr 1fr 1fr", gap: 8, padding: "12px 0 0", alignItems: "baseline" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.inkDim }}>{t("view.carry.raceTotal", { ns: "plan" })}</div>
            <div />
            <div />
            <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, color: T.brass }}>{carryPlan.totals.carbsG} g</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, color: T.brass }}>
              {carryPlan.totals.fluidsMl} ml
              <span style={{ fontSize: 11, color: T.inkDim }}> · {carryPlan.totals.sodiumMg} mg Na</span>
            </div>
          </div>
        </div>
      )}

      {/* Build Your Kit */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper, marginBottom: 6, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
          {t("view.kit.title", { ns: "plan" })}
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: T.inkDim, margin: "0 0 16px", lineHeight: 1.5 }}>
          {t("view.kit.sub", { ns: "plan" })}
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
                <div key={item.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < FUEL_ITEMS.length - 1 ? `1px solid ${T.line}33` : "none", background: qty > 0 ? `${T.brass}0D` : "transparent" }}>
                  <div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: qty > 0 ? T.paper : T.ink }}>{t(`fuelItem.${item.key}`, { ns: "plan" })}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 2 }}>{macro || "—"}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => bumpKit(item.key, -1)} aria-label={`Remove one ${t(`fuelItem.${item.key}`, { ns: "plan" })}`} style={stepperStyle(qty > 0)}>−</button>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: qty > 0 ? T.brass : T.inkDim, minWidth: 18, textAlign: "center" }}>{qty}</span>
                    <button onClick={() => bumpKit(item.key, 1)} aria-label={`Add one ${t(`fuelItem.${item.key}`, { ns: "plan" })}`} style={stepperStyle(true)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tally vs targets */}
          <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "16px 18px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.inkDim, marginBottom: 12 }}>
              {t(carryPlan ? "view.kit.vsTargetRaceTotal" : "view.kit.vsTarget", { ns: "plan" })}
            </div>
            <KitProgress label={t("view.kit.carbs", { ns: "plan" })} value={kit.totals.carbsG} target={kitTargets.carbsG} unit="g" />
            <KitProgress label={t("view.kit.fluids", { ns: "plan" })} value={kit.totals.fluidsMl} target={kitTargets.fluidsMl} unit="ml" />
            <KitProgress label={t("view.kit.sodium", { ns: "plan" })} value={kit.totals.sodiumMg} target={kitTargets.sodiumMg} unit="mg" />
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.inkDim, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
              {kit.totals.count > 0 ? t("view.kit.packed", { ns: "plan", count: kit.totals.count }) : t("view.kit.empty", { ns: "plan" })}
            </div>
          </div>
        </div>
      </div>

      {/* Tactical Recommendations */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.paper }}>
            {t("view.recommendations.title", { ns: "plan" })}
          </div>
          {narrativeNote && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5, color: T.inkDim }}>{narrativeNote}</span>
          )}
        </div>
        {narrative?.headline && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: T.ink, margin: "14px 0 6px", maxWidth: 680 }}>
            {narrative.headline}
          </div>
        )}
        {shownRecs.map((rec, i) => {
          const { action, why, evidence } = recText(t, rec, "plan");
          return <Recommendation key={i} index={i + 1} action={action} why={why} evidence={evidence} />;
        })}
      </div>

      {/* Footer CTAs */}
      <div style={{ display: "flex", gap: 12, paddingTop: 24, borderTop: `1px solid ${T.line}`, flexWrap: "wrap" }}>
        <button
          onClick={onLogRace}
          style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, fontWeight: 600, padding: "11px 22px", borderRadius: 3, border: "none", background: T.brass, color: T.bg, cursor: "pointer" }}
        >
          {t("view.logRace", { ns: "plan" })}
        </button>
        <button
          onClick={() => printPlan(plan, kit, t)}
          style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "11px 18px", borderRadius: 3, border: `1px solid ${T.brassDim}`, background: `${T.brass}1A`, color: T.brass, cursor: "pointer" }}
        >
          {t("view.downloadPdf", { ns: "plan" })}
        </button>
        <button
          onClick={onAskCoach}
          style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.4, padding: "11px 18px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: T.ink, cursor: "pointer" }}
        >
          {t("view.askCoach", { ns: "plan" })}
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
