import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, COMPARE_COLORS } from "../constants.js";
import { fmtDate, shortDate } from "../utils/time.js";
import { parseClockToMinutes } from "../utils/time.js";
import { fmtClock } from "../utils/clock.js";
import { verdictColor, verdictKey } from "../utils/ratings.js";
import { heatPenalty, heatAdjustedTime } from "../utils/weather.js";
import PaceCompareStrip from "./PaceCompareStrip.jsx";

export default function CompareView({ races, onBack, onOpenDebrief, onAskCoach }) {
  const { t } = useTranslation();
  const sorted = useMemo(
    () => [...races].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [races]
  );

  const distMin = Math.min(...sorted.map((r) => r.distanceKm));
  const distMax = Math.max(...sorted.map((r) => r.distanceKm));
  const distancesMismatched = (distMax - distMin) / distMin > 0.15;

  const refRace = sorted[0];
  const colCount = sorted.length;
  const hasDelta = colCount >= 2;
  const tableCols = `160px ${sorted.map(() => "1fr").join(" ")}${hasDelta ? " 100px" : ""}`;

  function timeDeltaDisplay(aTime, bTime) {
    const diff = parseClockToMinutes(bTime) - parseClockToMinutes(aTime);
    const sign = diff < 0 ? "−" : "+";
    // A finish-time gap, so h:mm:ss past an hour ("−2:23:21", not "−143:21").
    return { label: `${sign}${fmtClock(Math.abs(diff))}`, color: diff < 0 ? T.green : T.ember };
  }

  function numDelta(a, b, higherIsBetter = true) {
    const d = b - a;
    if (d === 0) return { label: "—", color: T.inkDim };
    const good = higherIsBetter ? d > 0 : d < 0;
    const label = `${d > 0 ? "+" : ""}${Number.isInteger(d) ? d : d.toFixed(1)}`;
    return { label, color: good ? T.green : T.ember };
  }

  function pacingDrift(race) {
    const splits = race.splits;
    if (splits.length < 2) return null;
    const key = race.usesGap ? "gapPace" : "pace";
    return ((splits[splits.length - 1][key] - splits[0][key]) / splits[0][key] * 100);
  }

  const narrative = useMemo(() => {
    if (sorted.length < 2) return "";
    const a = sorted[0], b = sorted[sorted.length - 1];
    const pctDelta = b.percentile - a.percentile;
    const condDiff = b.tempC < a.tempC - 3 ? "Cooler" : b.tempC > a.tempC + 3 ? "Warmer" : "Similar";
    const driftA = pacingDrift(a);
    const driftB = pacingDrift(b);

    // One catalog entry per sentence — never assembled from fragments, so each
    // can be restructured for the target language.
    const parts = [];
    parts.push(t("compare.narrative.headline", {
      context: pctDelta >= 0 ? "improvement" : "drop",
      later: b.name, laterDate: shortDate(b.date),
      earlier: a.name, earlierDate: shortDate(a.date),
      delta: pctDelta,
      conditions: t(`compare.narrative.conditions${condDiff}`),
      earlierTemp: a.tempC, laterTemp: b.tempC,
    }));
    if (driftA != null && driftB != null) {
      parts.push(t("compare.narrative.drift", {
        context: driftB < driftA ? "better" : "worse",
        from: driftA, to: driftB,
      }));
    }
    const fuelDelta = (b.fueling?.carbsPerHr ?? NaN) - (a.fueling?.carbsPerHr ?? NaN);
    if (Math.abs(fuelDelta) >= 10) {
      parts.push(t("compare.narrative.fuel", { context: fuelDelta > 0 ? "up" : "down", delta: fuelDelta }));
    }
    const heatDiff = heatPenalty(a.tempC) - heatPenalty(b.tempC);
    if (heatDiff > 0.04) {
      parts.push(t("compare.narrative.heat", { pct: heatDiff * 100, date: shortDate(a.date) }));
    }
    return parts.join(" ");
  }, [sorted, t]);

  const statRows = useMemo(() => {
    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    return [
      { label: t("compare.row.finishTime"), values: sorted.map((r) => r.finishTime), delta: hasDelta ? timeDeltaDisplay(first.finishTime, last.finishTime) : null },
      { label: t("compare.row.percentile"), values: sorted.map((r) => t("compare.percentileShort", { pct: r.percentile })), delta: hasDelta ? numDelta(first.percentile, last.percentile, true) : null },
      { label: t("compare.row.placement"), values: sorted.map((r) => `${r.placement}/${r.field}`), delta: null },
      { label: t("compare.row.score"), values: sorted.map((r) => r.rating), delta: hasDelta ? numDelta(first.rating, last.rating, true) : null },
      { label: t("compare.row.tempHumidity"), values: sorted.map((r) => `${r.tempC}°C / ${r.humidity}%`), delta: null },
      { label: t("compare.row.verdict"), values: sorted.map((r) => t(`verdict.${verdictKey(r.verdict)}`)), valueColors: sorted.map((r) => verdictColor(r.verdict)), delta: null },
    ];
  }, [sorted, hasDelta, t]);

  const fuelRows = [
    { label: t("compare.row.carbs"), key: "carbsPerHr", unit: "g/hr" },
    { label: t("compare.row.sodium"), key: "sodiumPerHr", unit: "mg/hr" },
    { label: t("compare.row.fluids"), key: "fluidsPerHr", unit: "ml/hr" },
    { label: t("compare.row.caffeine"), key: "caffeine", unit: "mg" },
  ];

  const condRows = [
    { label: t("compare.row.temp"), values: sorted.map((r) => `${r.tempC}°C`) },
    { label: t("compare.row.humidity"), values: sorted.map((r) => `${r.humidity}%`) },
    { label: t("compare.row.wind"), values: sorted.map((r) => `${r.wind} km/h`) },
    { label: t("compare.row.adjTime"), values: sorted.map((r) => heatAdjustedTime(r.finishTime, r.tempC, refRace.tempC)), note: true },
  ];

  const labelCellStyle = { padding: "12px 16px 12px 0", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.6, color: T.inkDim, borderRight: `1px solid ${T.line}` };
  const headerCellStyle = { padding: "10px 16px 10px 0", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5 };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.inkDim, fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 0.5, cursor: "pointer", padding: 0, marginBottom: 28 }}>
        {t("compare.back")}
      </button>

      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5, color: T.brass, marginBottom: 6 }}>{t("compare.eyebrow")}</div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600, margin: "0 0 6px", color: T.paper, maxWidth: 780 }}>
        {sorted.map((r) => r.name).join(t("compare.vs"))}
      </h1>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.inkDim, marginBottom: 28 }}>
        {t(`sport.${sorted[0].sport}`)} · {distMin === distMax ? `${distMin} km` : `${distMin}–${distMax} km`}
      </div>

      {distancesMismatched && (
        <div style={{ marginBottom: 24, padding: "10px 16px", background: `${T.ember}14`, border: `1px solid ${T.emberDim}`, borderRadius: 3, color: T.ember, fontFamily: FONT_BODY, fontSize: 13.5 }}>
          {t("compare.distanceWarning")}
        </div>
      )}

      <div className="compare-table" role="region" tabIndex={0} aria-label={t("compare.tableAria")} style={{ marginBottom: 44 }}>
        <div className="compare-row" style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
          <div style={{ ...headerCellStyle, color: T.inkDim }} />
          {sorted.map((r, i) => (
            <div key={r.id} style={{ ...headerCellStyle, color: COMPARE_COLORS[i] }}>
              <div>{r.name.toUpperCase()}</div>
              <div style={{ color: T.inkDim, fontSize: 11, marginTop: 2 }}>{fmtDate(r.date)}</div>
            </div>
          ))}
          {hasDelta && <div style={{ ...headerCellStyle, color: T.inkDim }}>{t("compare.deltaHeader", { later: shortDate(sorted[sorted.length - 1].date), earlier: shortDate(sorted[0].date) })}</div>}
        </div>
        {statRows.map((row, ri) => (
          <div key={ri} className="compare-row" style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
            <div style={labelCellStyle}>{row.label}</div>
            {sorted.map((r, i) => (
              <div key={r.id} style={{ padding: "14px 16px 14px 0", fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: row.valueColors ? row.valueColors[i] : COMPARE_COLORS[i] }}>
                {row.values[i]}
              </div>
            ))}
            {hasDelta && (
              <div style={{ padding: "14px 0", fontFamily: FONT_MONO, fontSize: 12, color: row.delta ? row.delta.color : T.inkDim, alignSelf: "center" }}>
                {row.delta ? row.delta.label : "—"}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 4 }}>{t("compare.paceOverlay.title")}</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 16, maxWidth: 620 }}>
          {t(distancesMismatched ? "compare.paceOverlay.subPercent" : "compare.paceOverlay.subDirect")}
        </div>
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, padding: "16px 12px 8px" }}>
          <PaceCompareStrip races={sorted} />
        </div>
      </div>

      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 4 }}>{t("compare.conditions.title")}</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.inkDim, marginBottom: 16, maxWidth: 620 }}>
          {t("compare.conditions.sub", { race: refRace.name, tempC: refRace.tempC })}
        </div>
        <div className="compare-table" role="region" tabIndex={0} aria-label={t("compare.tableAria")} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
          <div className="compare-row" style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ ...headerCellStyle, padding: "10px 16px", color: T.inkDim }} />
            {sorted.map((r, i) => (
              <div key={r.id} style={{ ...headerCellStyle, padding: "10px 16px", color: COMPARE_COLORS[i] }}>{shortDate(r.date)}</div>
            ))}
            {hasDelta && <div style={{ ...headerCellStyle, padding: "10px 16px", color: T.inkDim }}>Δ</div>}
          </div>
          {condRows.map((row, ri) => {
            const first = row.values[0];
            const last = row.values[row.values.length - 1];
            const isLast = ri === condRows.length - 1;
            return (
              <div key={ri} className="compare-row" style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: isLast ? "none" : `1px solid ${T.line}` }}>
                <div style={{ ...labelCellStyle, padding: "12px 16px" }}>
                  {row.label}
                  {row.note && <div style={{ fontSize: 11, color: T.inkDim, opacity: 0.7, marginTop: 2 }}>{t("compare.conditions.normalizedNote", { date: shortDate(refRace.date) })}</div>}
                </div>
                {sorted.map((r, i) => (
                  <div key={r.id} style={{ padding: "12px 16px", fontFamily: FONT_MONO, fontSize: 13, color: row.note ? COMPARE_COLORS[i] : T.paper }}>{row.values[i]}</div>
                ))}
                {hasDelta && (
                  <div style={{ padding: "12px 16px", fontFamily: FONT_MONO, fontSize: 12, color: T.inkDim }}>
                    {row.note ? timeDeltaDisplay(first, last).label : "—"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 44 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.paper, marginBottom: 16 }}>{t("compare.fueling.title")}</div>
        <div className="compare-table" role="region" tabIndex={0} aria-label={t("compare.tableAria")} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden" }}>
          <div className="compare-row" style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ ...headerCellStyle, padding: "10px 16px", color: T.inkDim }} />
            {sorted.map((r, i) => (
              <div key={r.id} style={{ ...headerCellStyle, padding: "10px 16px", color: COMPARE_COLORS[i] }}>{shortDate(r.date)}</div>
            ))}
            {hasDelta && <div style={{ ...headerCellStyle, padding: "10px 16px", color: T.inkDim }}>Δ</div>}
          </div>
          {fuelRows.map((row, ri) => {
            const vals = sorted.map((r) => r.fueling[row.key]);
            const delta = hasDelta ? vals[vals.length - 1] - vals[0] : 0;
            const deltaColor = delta > 0 ? T.green : delta < 0 ? T.ember : T.inkDim;
            const isLast = ri === fuelRows.length - 1;
            return (
              <div key={ri} className="compare-row" style={{ display: "grid", gridTemplateColumns: tableCols, borderBottom: isLast ? "none" : `1px solid ${T.line}` }}>
                <div style={{ ...labelCellStyle, padding: "12px 16px" }}>{row.label}</div>
                {sorted.map((r, i) => (
                  <div key={r.id} style={{ padding: "12px 16px", fontFamily: FONT_MONO, fontSize: 13, color: COMPARE_COLORS[i] }}>
                    {r.fueling[row.key]} {row.unit}
                  </div>
                ))}
                {hasDelta && (
                  <div style={{ padding: "12px 16px", fontFamily: FONT_MONO, fontSize: 12, color: delta !== 0 ? deltaColor : T.inkDim }}>
                    {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta} ${row.unit}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 44, padding: "20px 24px", background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 4 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1, color: T.brass, marginBottom: 10 }}>{t("compare.analysisEyebrow")}</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.65, color: T.ink }}>{narrative}</div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 8 }}>
        <button onClick={onAskCoach} style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, padding: "10px 18px", borderRadius: 3, border: `1px solid ${T.brass}`, background: `${T.brass}1A`, color: T.brass, cursor: "pointer" }}>
          {t("compare.askAbout")}
        </button>
        {sorted.map((r, i) => (
          <button key={r.id} onClick={() => onOpenDebrief(r.id)} style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, padding: "10px 18px", borderRadius: 3, border: `1px solid ${T.line}`, background: "transparent", color: COMPARE_COLORS[i], cursor: "pointer" }}>
            {t("compare.openDebrief", { date: shortDate(r.date) })}
          </button>
        ))}
      </div>
    </div>
  );
}
